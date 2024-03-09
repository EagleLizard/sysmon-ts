
import { std } from 'mathjs';

import { PingService } from '../../service/ping-service';
import { PING_CMD_FLAG_MAP, SysmonCommand } from '../sysmon-args';
import { isNumber, isString } from '../../util/validate-primitives';
import { PingStatDto } from '../../models/ping-stat-dto';
import { getDateStr } from '../../util/datetime-util';
import { ADDR_TYPE_ENUM } from '../../models/addr-network';

const DEFAULT_NUM_STD_DEVIATIONS = 5;

export async function runPingStat(cmd: SysmonCommand) {
  let numStdDeviations: number;
  let addrOpt: string | undefined;
  let networkOpt: ADDR_TYPE_ENUM | undefined;
  let addrId: number | undefined;

  if(
    (cmd.opts?.[PING_CMD_FLAG_MAP.STDDEV.flag] !== undefined)
  ) {
    let stdDevOpt = cmd.opts[PING_CMD_FLAG_MAP.STDDEV.flag];
    numStdDeviations = (
      isString(stdDevOpt.value[0])
      && !isNaN(+stdDevOpt.value[0])
    )
      ? +stdDevOpt.value[0]
      : DEFAULT_NUM_STD_DEVIATIONS
    ;
  }
  if(
    (cmd.opts?.[PING_CMD_FLAG_MAP.NETWORK.flag] !== undefined)
    && (isString(cmd.opts[PING_CMD_FLAG_MAP.NETWORK.flag].value[0]))
  ) {
    /*
      check if network string is valid ADDR_TYPE
    */
    let rawAddrType = cmd.opts[PING_CMD_FLAG_MAP.NETWORK.flag].value[0];
    if(
      (rawAddrType === ADDR_TYPE_ENUM.GLOBAL)
      || (rawAddrType === ADDR_TYPE_ENUM.LOCAL)
    ) {
      networkOpt = rawAddrType;
    } else {
      throw new Error(`Invalid network option: ${rawAddrType}`);
    }
  }

  addrOpt = cmd.opts?.[PING_CMD_FLAG_MAP.IP.flag]?.value?.[0];

  if(addrOpt !== undefined) {
    addrId = await PingService.getAddrIdByVal(addrOpt);
  }

  let pingStats: PingStatDto[] | undefined;
  if(addrId === undefined) {
    pingStats = await PingService.getStats(networkOpt);
  } else {
    pingStats = await PingService.getStatsByAddr(addrId);
  }
  if(pingStats === undefined) {
    throw new Error('Error getting ping stats.');
  }
  console.log('stats');
  let maxAvg = -Infinity;
  let minAvg = Infinity;
  let avgSum = 0;
  let totalPings = 0;
  pingStats.forEach(pingStat => {
    if(pingStat.avg > maxAvg) {
      maxAvg = pingStat.avg;
    }
    if(pingStat.avg < minAvg) {
      minAvg = pingStat.avg;
    }
    avgSum += pingStat.avg;
    totalPings += pingStat.count;
  });
  let scale = 50;
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

  // printStats(pingStats, minAvg, maxAvg, scale);

  let totalAvg = avgSum / totalPings;
  let stdDevRaw = std(
    pingStats.map(pingStat => pingStat.avg),
    'unbiased'
  );
  if(!isNumber(stdDevRaw)) {
    throw new Error(`Unexpected std() result: ${std}`);
  }
  let stdDev = stdDevRaw;
  console.log({ stdDev });
  console.log({
    maxAvg,
    minAvg,
    totalAvg,
    totalAvgFixed: Math.round((totalAvg) * 1e3) / 1e3,
    stdDev,
  });

  let devPings = pingStats.filter(pingStat => {
    // return true;
    return (pingStat.avg - totalAvg) > (stdDev * numStdDeviations);
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
    return aHm.localeCompare(bHm);

    // return b.time_bucket.toTimeString().localeCompare(a.time_bucket.toTimeString());
  });

  printStats(sortedDevPings, minAvg, maxAvg, scale);
}

function printStats(pingStats: PingStatDto[], minAvg: number, maxAvg: number, scale: number) {
  let baseRange = maxAvg - minAvg;
  pingStats.forEach((pingStat) => {
    let avgVal: number;
    let avgMod: number;
    let avgOutVal: number;
    let avgOutStr: string;
    avgVal = pingStat.avg - minAvg;
    avgMod = avgVal / baseRange;
    avgOutVal = avgMod * scale;
    avgOutStr = '='.repeat(Math.round(avgOutVal));
    // console.log(`${pingStat.time_bucket.toLocaleString()} ${avgOutStr}`);
    console.log(`${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
    // console.log(`${pingStat.time_bucket.getDay()} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`);
  });
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
