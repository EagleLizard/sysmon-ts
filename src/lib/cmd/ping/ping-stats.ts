
import { std } from 'mathjs';

import { PingService } from '../../service/ping-service';
import { SysmonCommand } from '../sysmon-args';
import { isNumber, isString } from '../../util/validate-primitives';
import { PingStatDto } from '../../models/ping-stat-dto';
import { getDateStr } from '../../util/datetime-util';

const DEFAULT_NUM_STD_DEVIATIONS = 5;

export async function runPingStat(cmd: SysmonCommand) {
  let numStdDeviations: number;

  if(
    (cmd.opts?.s !== undefined)
    || (cmd.opts?.stats !== undefined)
  ) {
    let statsOpt = cmd.opts?.s ?? cmd.opts?.stats;
    numStdDeviations = (
      isString(statsOpt.value[0])
      && !isNaN(+statsOpt.value[0])
    )
      ? +statsOpt.value[0]
      : DEFAULT_NUM_STD_DEVIATIONS
    ;
  }

  let pingStats = await PingService.getStats();
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
    // return a.time_bucket.valueOf() - b.time_bucket.valueOf();
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
