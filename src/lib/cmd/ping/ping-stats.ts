
import fs, { WriteStream } from 'fs';
import path from 'path';

import { MathNumericType, std } from 'mathjs';

import { PingService } from '../../service/ping-service';
import { SysmonCommand } from '../sysmon-args';
import { isNumber } from '../../util/validate-primitives';
import { PingStatDto } from '../../models/ping-stat-dto';
import { getDateStr, getDayStr } from '../../util/datetime-util';
import { ADDR_TYPE_ENUM } from '../../models/ping-args';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { OUT_DATA_DIR_PATH } from '../../../constants';
import { PingStatOpts, getPingStatOpts } from './ping-stat-opts';

const PRINT_STATS_SCALE = 50;

type AggregatePingStats = {
  minAvg: number;
  maxAvg: number;
  avgSum: number;
  stdDev: number;
  totalPings: number;
  totalAvg: number;
};

export async function runPingStat(cmd: SysmonCommand) {
  let addrId: number | undefined;
  let startParam: string | undefined;
  let timer: Timer;
  let getStatsMs: number;

  let aggStats: AggregatePingStats;
  let printStatsLines: string[];

  let pingStats: PingStatDto[] | undefined;
  let devPings: PingStatDto[];
  let sortedDevPings: PingStatDto[];

  let opts: PingStatOpts;
  let outFilePath: string;
  let ws: WriteStream;

  opts = getPingStatOpts(cmd);

  outFilePath = getOutFilePath(opts);
  ws = fs.createWriteStream(outFilePath);
  ws.write(`${(new Date).toISOString()}\n`);

  if(opts.addr !== undefined) {
    addrId = await PingService.getAddrIdByVal(opts.addr);
  }

  timer = Timer.start();
  if(addrId === undefined) {
    pingStats = await PingService.getStats({
      addrType: opts.network,
      bucketVal: opts.bucket?.bucketVal,
      bucketUnit: opts.bucket?.bucketUnit,
      start: startParam,
    });
  } else {
    pingStats = await PingService.getStatsByAddr(addrId);
  }
  getStatsMs = timer.stop();
  console.log(`get stats took: ${getIntuitiveTimeString(getStatsMs)}`);
  if(pingStats === undefined) {
    throw new Error('Error getting ping stats.');
  }

  aggStats = getAggregateStats(pingStats);
  // printStats(pingStats, minAvg, maxAvg, scale);

  devPings = pingStats.filter(pingStat => {
    // return true;
    // return pingStat.avg > aggStats.totalAvg;
    return (pingStat.avg - aggStats.totalAvg) > (aggStats.stdDev * opts.numStdDevs);
    // return Math.abs(pingStat.avg - totalAvg) > (stdDev * numStdDeviations);
  });

  sortedDevPings = devPings.slice();

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

    return dayCompare;

    // return b.time_bucket.toTimeString().localeCompare(a.time_bucket.toTimeString());
  });

  console.log({ stdDev: aggStats.stdDev });
  console.log({
    maxAvg: aggStats.maxAvg,
    minAvg: aggStats.minAvg,
    totalAvg: aggStats.totalAvg,
    totalAvgFixed: Math.round((aggStats.totalAvg) * 1e3) / 1e3,
    stdDev: aggStats.stdDev,
  });
  if(opts.network !== undefined) {
    console.log({
      network: opts.network,
    });
  }

  printStatsLines = printStats(sortedDevPings, aggStats.minAvg, aggStats.maxAvg);

  ws.write(JSON.stringify({
    stdDev: aggStats.stdDev,
    maxAvg: aggStats.maxAvg,
    minAvg: aggStats.minAvg,
    totalAvg: aggStats.totalAvg,
    totalAvgFixed: Math.round((aggStats.totalAvg) * 1e3) / 1e3,
  }, null, 2));
  ws.write('\n');
  for(let i = 0; i < printStatsLines.length; ++i) {
    let currLine: string;
    currLine = printStatsLines[i];
    ws.write(`${currLine}\n`);
  }
}

function getAggregateStats(pingStats: PingStatDto[]): AggregatePingStats {
  let maxAvg = -Infinity;
  let minAvg = Infinity;
  let avgSum = 0;
  let stdDevRaw: MathNumericType;
  let stdDev: number;
  let totalPings = 0;
  let totalAvg: number;
  for(let i = 0; i < pingStats.length; ++i) {
    let pingStat = pingStats[i];
    if(pingStat.avg > maxAvg) {
      maxAvg = pingStat.avg;
    }
    if(pingStat.avg < minAvg) {
      minAvg = pingStat.avg;
    }
    avgSum += pingStat.avg;
    // totalPings += pingStat.count;
    totalPings++;
  }
  stdDevRaw = std(
    pingStats.map(pingStat => pingStat.avg),
    'unbiased'
  );
  if(!isNumber(stdDevRaw)) {
    throw new Error(`Unexpected std() result: ${std}`);
  }
  stdDev = stdDevRaw;

  totalAvg = avgSum / totalPings;

  return {
    minAvg,
    maxAvg,
    avgSum,
    stdDev,
    totalPings,
    totalAvg,
  };
}

function printStats(
  pingStats: PingStatDto[],
  minAvg: number,
  maxAvg: number,
): string[] {
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
    avgOutVal = avgMod * PRINT_STATS_SCALE;
    avgOutStr = '='.repeat(Math.round(avgOutVal));
    currLine = `${getDayStr(pingStat.time_bucket)} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`;
    // console.log(`${pingStat.time_bucket.toLocaleString()} ${avgOutStr}`);
    // console.log(`${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
    // console.log(`${getDayStr(pingStat.time_bucket)} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
    // console.log(currLine);
    // console.log(`${pingStat.time_bucket.getDay()} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
    statsLines.push(currLine);
  });
  return statsLines;
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

function getOutFilePath(opts: PingStatOpts): string {
  let outFileName: string;
  let outFilePath: string;
  switch(opts.network) {
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
  return outFilePath;
}
