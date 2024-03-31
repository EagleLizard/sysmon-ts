
import fs from 'fs';
import path from 'path';

import { std } from 'mathjs';

import { PingService } from '../../service/ping-service';
import { ArgvOpt, PING_STAT_CMD_FLAG_MAP, SysmonCommand } from '../sysmon-args';
import { isNumber, isString } from '../../util/validate-primitives';
import { PingStatDto } from '../../models/ping-stat-dto';
import { getDateStr, getDayStr } from '../../util/datetime-util';
import { ADDR_TYPE_ENUM, TimeBucketUnit, validateTimeBucketUnit } from '../../models/ping-args';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { OUT_DATA_DIR_PATH } from '../../../constants';
import { StartParam, TIME_UNIT_TO_TIME_BUCKET_MAP, isStartParam, parseStartParam } from '../../util/cmd-parse-util';

const DEFAULT_NUM_STD_DEVIATIONS = 1;

type BucketOpt = {
  bucketVal: number | undefined;
  bucketUnit: TimeBucketUnit | undefined;
};

type AggregatePingStats = {
  minAvg: number;
  maxAvg: number;
  avgSum: number;
  totalPings: number;
  totalAvg: number;
};

export async function runPingStat(cmd: SysmonCommand) {
  let numStdDeviations: number;
  let addrOpt: string | undefined;
  let networkOpt: ADDR_TYPE_ENUM | undefined;
  let addrId: number | undefined;
  let bucketOpt: BucketOpt;
  let bucketVal: number | undefined;
  let bucketUnit: TimeBucketUnit | undefined;
  let startParam: string | undefined;
  let timer: Timer;
  let getStatsMs: number;

  let aggStats: AggregatePingStats;
  let printStatsStr: string;

  numStdDeviations = getNumStdDev(cmd);
  networkOpt = getNetworkOpt(cmd);

  bucketOpt = getBucketOpt(cmd);
  bucketVal = bucketOpt.bucketVal;
  bucketUnit = bucketOpt.bucketUnit;

  startParam = getStartOpt(cmd);

  addrOpt = cmd.opts?.[PING_STAT_CMD_FLAG_MAP.IP.flag]?.value?.[0];

  if(addrOpt !== undefined) {
    addrId = await PingService.getAddrIdByVal(addrOpt);
  }

  let pingStats: PingStatDto[] | undefined;
  timer = Timer.start();
  if(addrId === undefined) {
    pingStats = await PingService.getStats({
      addrType: networkOpt,
      bucketVal,
      bucketUnit,
      start: startParam,
    });
  } else {
    pingStats = await PingService.getStatsByAddr(addrId);
  }
  getStatsMs = timer.stop();
  console.log(
    `get stats took: ${getIntuitiveTimeString(getStatsMs)}`
  );
  if(pingStats === undefined) {
    throw new Error('Error getting ping stats.');
  }
  let scale = 50;
  console.log('stats');

  aggStats = getAggregateStats(pingStats);
  // printStats(pingStats, minAvg, maxAvg, scale);

  let stdDevRaw = std(
    pingStats.map(pingStat => pingStat.avg),
    'unbiased'
  );
  if(!isNumber(stdDevRaw)) {
    throw new Error(`Unexpected std() result: ${std}`);
  }
  let stdDev = stdDevRaw;

  let devPings = pingStats.filter(pingStat => {
    // return true;
    // return pingStat.avg > aggStats.totalAvg;
    return (pingStat.avg - aggStats.totalAvg) > (stdDev * numStdDeviations);
    // return Math.abs(pingStat.avg - totalAvg) > (stdDev * numStdDeviations);
  });

  let sortedDevPings = devPings.slice();

  sortedDevPings.sort((a, b) => {
    // let aHm = a.time_bucket.getHours() + '' + a.time_bucket.getMinutes();
    // let bHm = b.time_bucket.getHours() + '' + b.time_bucket.getMinutes();
    let aHm = getHourMinuteString(a.time_bucket);
    let bHm = getHourMinuteString(b.time_bucket);
    // return +aHm - +bHm;

    // return b.time_bucket.valueOf() - a.time_bucket.valueOf();
    // return a.time_bucket.valueOf() - b.time_bucket.valueOf();

    // return aHm.localeCompare(bHm);
    // return aHm.localeCompare(bHm);

    let dayCompare = a.time_bucket.getDay() - b.time_bucket.getDay();
    if(dayCompare === 0) {
      let hourMinCompare = aHm.localeCompare(bHm);
      if(hourMinCompare === 0) {
        let dateCompare = a.time_bucket.getDate() - b.time_bucket.getDate();
        return dateCompare;
      }
      return hourMinCompare;
    }
    // if(compareRes === 0) {
    //   let hourMinCompare = aHm.localeCompare(bHm);
    //   return hourMinCompare;
    // }
    return dayCompare;

    // return b.time_bucket.toTimeString().localeCompare(a.time_bucket.toTimeString());
  });

  console.log({ stdDev });
  console.log({
    maxAvg: aggStats.maxAvg,
    minAvg: aggStats.minAvg,
    totalAvg: aggStats.totalAvg,
    totalAvgFixed: Math.round((aggStats.totalAvg) * 1e3) / 1e3,
    stdDev,
  });

  printStatsStr = printStats(sortedDevPings, aggStats.minAvg, aggStats.maxAvg, scale);
  // console.log(printStatsStr);

  let outFileName: string;
  let outFilePath: string;
  switch(networkOpt) {
    case ADDR_TYPE_ENUM.LOCAL:
      outFileName = 'out_local.txt';
      break;
    case ADDR_TYPE_ENUM.GLOBAL:
      outFileName = 'out_global.txt';
      break;
    default:
      outFileName = 'out.txt';
  }
  outFilePath = [
    OUT_DATA_DIR_PATH,
    outFileName,
  ].join(path.sep);

  let fileData: string;
  let fileDataParts: string[];
  fileDataParts = [];
  fileDataParts.push((new Date).toISOString());
  fileDataParts.push(JSON.stringify({
    stdDev,
    maxAvg: aggStats.maxAvg,
    minAvg: aggStats.minAvg,
    totalAvg: aggStats.totalAvg,
    totalAvgFixed: Math.round((aggStats.totalAvg) * 1e3) / 1e3,
  }, null, 2));
  fileDataParts.push(printStatsStr);

  fileData = fileDataParts.join('\n');
  fs.writeFileSync(outFilePath, fileData);
}

function getAggregateStats(pingStats: PingStatDto[]): AggregatePingStats {
  let maxAvg = -Infinity;
  let minAvg = Infinity;
  let avgSum = 0;
  let totalPings = 0;
  let totalAvg: number;
  pingStats.forEach(pingStat => {
    if(pingStat.avg > maxAvg) {
      maxAvg = pingStat.avg;
    }
    if(pingStat.avg < minAvg) {
      minAvg = pingStat.avg;
    }
    avgSum += pingStat.avg;
    // totalPings += pingStat.count;
    totalPings++;
  });
  // let baseRange = maxAvg - minAvg;
  // pingStats.forEach((pingStat) => {
  //   let avgVal: number;
  //   let avgMod: number;
  //   let avgOutVal: number;
  //   let avgOutStr: string;
  //   avgVal = pingStat.avg - minAvg;
  //   avgMod = avgVal / baseRange;
  //   avgOutVal = avgMod * scale;
  //   avgOutStr = '='.repeat(Math.round(avgOutVal));
  //   console.log(`${avgOutStr}`);
  // });
  totalAvg = avgSum / totalPings;

  return {
    minAvg,
    maxAvg,
    avgSum,
    totalPings,
    totalAvg,
  };
}

function getBucketOpt(cmd: SysmonCommand): BucketOpt {
  let bucketOpt: BucketOpt;
  let bucketVal: number | undefined;
  let bucketUnit: TimeBucketUnit | undefined;
  /*
    Possible input format:
      5 min
      5min
      5m
  */
  if(cmd.opts?.[PING_STAT_CMD_FLAG_MAP.BUCKET.flag] !== undefined) {
    let bucketOpt: ArgvOpt;
    bucketOpt = cmd.opts[PING_STAT_CMD_FLAG_MAP.BUCKET.flag];
    if(bucketOpt.value.length < 1) {
      throw new Error('no values provided to bucket option');
    }
    if(bucketOpt.value.length === 1) {
      let startParam: StartParam;
      startParam = parseStartParam(bucketOpt.value[0]);
      bucketVal = startParam.value;
      bucketUnit = TIME_UNIT_TO_TIME_BUCKET_MAP[startParam.unit];
    } else if(bucketOpt.value.length === 2) {
      let rawBucketVal = bucketOpt.value[0];
      let rawBucketUnit = bucketOpt.value[1];
      if(
        !isString(rawBucketVal)
        || isNaN(+rawBucketVal)
      ) {
        throw new Error(`Invalid bucket option value: ${rawBucketVal}`);
      }
      bucketVal = +rawBucketVal;
      if(!validateTimeBucketUnit(rawBucketUnit)) {
        throw new Error(`Invalid bucket option unit: ${rawBucketUnit}`);
      }
      bucketUnit = rawBucketUnit;
    }
  }
  bucketOpt = {
    bucketVal,
    bucketUnit,
  };
  return bucketOpt;
}

function getStartOpt(cmd: SysmonCommand): string | undefined {
  let startParam: string | undefined;
  if(cmd.opts?.[PING_STAT_CMD_FLAG_MAP.START.flag] !== undefined) {
    let startOpt: ArgvOpt;
    startOpt = cmd.opts[PING_STAT_CMD_FLAG_MAP.START.flag];
    if(startOpt.value.length < 1) {
      throw new Error('no values provided to start option');
    }
    if(startOpt.value.length === 1) {
      startParam = startOpt.value[0];
      if(!isStartParam(startParam)) {
        throw new Error(`Invalid start option: ${startParam}`);
      }
    } else {
      throw new Error(`Invalid number of values provided to start option, received ${startOpt.value.length}`);
    }
  }

  return startParam;
}

function getNetworkOpt(cmd: SysmonCommand): ADDR_TYPE_ENUM | undefined {
  let networkOpt: ADDR_TYPE_ENUM | undefined;

  if(
    (cmd.opts?.[PING_STAT_CMD_FLAG_MAP.NETWORK.flag] !== undefined)
    && (isString(cmd.opts[PING_STAT_CMD_FLAG_MAP.NETWORK.flag].value[0]))
  ) {
    /*
      check if network string is valid ADDR_TYPE
    */
    let rawAddrType = cmd.opts[PING_STAT_CMD_FLAG_MAP.NETWORK.flag].value[0];
    if(
      (rawAddrType === ADDR_TYPE_ENUM.GLOBAL)
      || (rawAddrType === ADDR_TYPE_ENUM.LOCAL)
    ) {
      networkOpt = rawAddrType;
    } else {
      throw new Error(`Invalid network option: ${rawAddrType}`);
    }
  }
  return networkOpt;
}

function getNumStdDev(cmd: SysmonCommand): number {
  let numStdDeviations: number;
  numStdDeviations = DEFAULT_NUM_STD_DEVIATIONS;
  if(
    (cmd.opts?.[PING_STAT_CMD_FLAG_MAP.STDDEV.flag] !== undefined)
  ) {
    let stdDevOpt = cmd.opts[PING_STAT_CMD_FLAG_MAP.STDDEV.flag];
    if(
      isString(stdDevOpt.value[0])
      && !isNaN(+stdDevOpt.value[0])
    ) {
      numStdDeviations = +stdDevOpt.value[0];
    }
  }
  return numStdDeviations;
}

function printStats(
  pingStats: PingStatDto[],
  minAvg: number,
  maxAvg: number,
  scale: number
): string {
  let statsLines: string[];
  let baseRange = maxAvg - minAvg;
  statsLines = [];
  pingStats.forEach((pingStat) => {
    let avgVal: number;
    let avgMod: number;
    let avgOutVal: number;
    let avgOutStr: string;
    let currLine: string;
    avgVal = pingStat.avg - minAvg;
    avgMod = avgVal / baseRange;
    avgOutVal = avgMod * scale;
    avgOutStr = '='.repeat(Math.round(avgOutVal));
    currLine = `${getDayStr(pingStat.time_bucket)} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`;
    // console.log(`${pingStat.time_bucket.toLocaleString()} ${avgOutStr}`);
    // console.log(`${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
    // console.log(`${getDayStr(pingStat.time_bucket)} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
    // console.log(currLine);
    // console.log(`${pingStat.time_bucket.getDay()} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
    statsLines.push(currLine);
  });
  let statsStr: string;
  statsStr = statsLines.join('\n');
  return statsStr;
}

function getHourMinuteString(date: Date) {
  let hoursStr: string;
  let minutesStr: string;
  let hours = date.getHours();
  let minutes = date.getMinutes();

  hoursStr = `${hours}`;
  minutesStr = `${minutes}`;
  if(hoursStr.length < 2) {
    hoursStr = `0${hoursStr}`;
  }
  if(minutesStr.length < 2) {
    minutesStr = `0${minutesStr}`;
  }
  return `${hoursStr}${minutesStr}`;
}
