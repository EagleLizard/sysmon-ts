
import { std } from 'mathjs';

import { PingService } from '../../service/ping-service';
import { PING_CMD_FLAG_MAP, SysmonCommand } from '../sysmon-args';
import { isNumber, isString } from '../../util/validate-primitives';
import { PingStatDto } from '../../models/ping-stat-dto';
import { getDateStr } from '../../util/datetime-util';

const DEFAULT_NUM_STD_DEVIATIONS = 5;

export async function runPingStat(cmd: SysmonCommand) {
  let numStdDeviations: number;
  let addrOpt: string | undefined;
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

  addrOpt = cmd.opts?.[PING_CMD_FLAG_MAP.IP.flag]?.value?.[0];

  if(addrOpt !== undefined) {
    addrId = await PingService.getAddrIdByVal(addrOpt);
  }

  let pingStats: PingStatDto[] | undefined;
  if(addrId === undefined) {
    pingStats = await PingService.getStats();
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
  pingStats.forEach(pingStat => {
    if(pingStat.avg > maxAvg) {
      maxAvg = pingStat.avg;
    }
    if(pingStat.avg < minAvg) {
      minAvg = pingStat.avg;
    }
    avgSum += pingStat.avg;
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

  let totalAvg = avgSum / pingStats.length;
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
    // return Math.floor(pingStat.avg - totalAvg) > (stdDev * 3);
    // return (pingStat.avg - totalAvg) > (stdDev * 1);
    // return (pingStat.avg - totalAvg) > (stdDev * 2);
    // return (pingStat.avg - totalAvg) > (stdDev * 3);
    // return (pingStat.avg - totalAvg) > (stdDev * 4);
    // return true;
    return (pingStat.avg - totalAvg) > (stdDev * numStdDeviations);
    // return (pingStat.avg - totalAvg) > (stdDev * 6);
    // return (pingStat.avg - totalAvg) > (stdDev * 7);
  });
  // console.log(devPings);
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
  // console.log(
  //   sortedDevPings.map(devPing => {
  //     return devPing.time_bucket.toLocaleString() + ' ' + getHourMinuteString(devPing.time_bucket);
  //   }).join('\n')
  // );

  printStats(sortedDevPings, minAvg, maxAvg, scale);

  // console.log(
  //   sortedDevPings.map(pingStat => {
  //     return pingStat.time_bucket.toLocaleString();
  //   }).join('\n')
  // );
  // console.log(devPings.map(pingStat => pingStat.time_bucket.toLocaleString()));
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
    console.log(`${getDateStr(pingStat.time_bucket)} ${avgOutStr}`);
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
