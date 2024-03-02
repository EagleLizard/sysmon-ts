
import { std } from 'mathjs';

import { PingService } from '../../service/ping-service';
import { SysmonCommand } from '../sysmon-args';
import { isNumber } from '../../util/validate-primitives';
import { PingStatDto } from '../../models/ping-stat-dto';

export async function runPingStat(cmd: SysmonCommand) {
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
    return (pingStat.avg - totalAvg) > (stdDev * 3);
    // return (pingStat.avg - totalAvg) > (stdDev * 4);
    // return (pingStat.avg - totalAvg) > (stdDev * 5);
    // return (pingStat.avg - totalAvg) > (stdDev * 6);
    return (pingStat.avg - totalAvg) > (stdDev * 7);
  });
  // console.log(devPings);
  let sortedDevPings = devPings.slice();

  sortedDevPings.sort((a, b) => {
    // let aHm = a.time_bucket.getHours() + '' + a.time_bucket.getMinutes();
    // let bHm = b.time_bucket.getHours() + '' + b.time_bucket.getMinutes();
    let aHm = getHourMinuteString(a.time_bucket);
    let bHm = getHourMinuteString(b.time_bucket);
    // return +aHm - +bHm;
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
    console.log(`${getDateTimeStr(pingStat.time_bucket)} ${avgOutStr}`);
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

export function getDateTimeStr(date: Date): string {

  // Get the date components
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();

  // Get the time components
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Format the time as AM/PM
  const amOrPm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  // Construct the formatted string
  const formattedDateTime = `[${month}-${day}-${year}] ${formattedHours}:${formattedMinutes} ${amOrPm}`;

  return formattedDateTime;
}

