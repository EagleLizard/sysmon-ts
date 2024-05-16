
import { MathNumericType, std } from 'mathjs';
import { PingStatDto } from '../../models/ping-stat-dto';
import { isNumber } from '../../util/validate-primitives';
import { PingStatOpts } from './ping-stat-opts';
import { PingService } from '../../service/ping-service';
import { WriteStream } from 'fs';
import { getDateStr, getDayStr } from '../../util/datetime-util';

export type AggregatePingStats = {
  minAvg: number;
  maxAvg: number;
  avgSum: number;
  stdDev: number;
  totalPings: number;
  totalAvg: number;
};

const PRINT_STATS_SCALE = 50;

export class PingStatsService {

  static async getPingStats(opts: PingStatOpts): Promise<PingStatDto[]> {
    let pingStats: PingStatDto[] | undefined;
    let addrId: number | undefined;

    if(opts.addr !== undefined) {
      addrId = await PingService.getAddrIdByVal(opts.addr);
    }

    if(addrId === undefined) {
      pingStats = await PingService.getStats({
        addrType: opts.network,
        bucketVal: opts.bucket?.bucketVal,
        bucketUnit: opts.bucket?.bucketUnit,
        start: opts.start,
      });
    } else {
      pingStats = await PingService.getStatsByAddr(addrId);
    }

    if(pingStats === undefined) {
      throw new Error('Error getting ping stats.');
    }
    return pingStats;
  }

  static getAggregateStats(pingStats: PingStatDto[]): AggregatePingStats {
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

  static sortPingStats(pingStats: PingStatDto[]): PingStatDto[] {
    let sortedPingStats: PingStatDto[];
    sortedPingStats = pingStats.slice();
    sortedPingStats.sort((a, b) => {
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
    return sortedPingStats;
  }

  static printStats(
    pingStats: PingStatDto[],
    aggStats: AggregatePingStats,
    ws: WriteStream,
  ) {
    ws.write(JSON.stringify({
      maxAvg: aggStats.maxAvg,
      minAvg: aggStats.minAvg,
      totalAvg: aggStats.totalAvg,
      totalAvgFixed: Math.round((aggStats.totalAvg) * 1e3) / 1e3,
      stdDev: aggStats.stdDev,
    }, null, 2));
    ws.write('\n');
    for(let i = 0; i < pingStats.length; ++i) {
      let pingStat: PingStatDto;
      let currLine: string;
      pingStat = pingStats[i];
      currLine = getStatLine(pingStat, aggStats);
      ws.write(`${currLine}\n`);
    }
  }
}

function getStatLine(pingStat: PingStatDto, aggStats: AggregatePingStats): string {
  let baseRange: number;
  let avgVal: number;
  let avgMod: number;
  let avgOutVal: number;
  let avgOutStr: string;
  let currLine: string;
  baseRange = aggStats.maxAvg - aggStats.minAvg;
  avgVal = pingStat.avg - aggStats.minAvg;
  avgMod = avgVal / baseRange;
  avgOutVal = avgMod * PRINT_STATS_SCALE;
  avgOutStr = '='.repeat(Math.round(avgOutVal));
  currLine = `${getDayStr(pingStat.time_bucket)} ${getDateStr(pingStat.time_bucket)} ${avgOutStr} ${pingStat.avg}`;
  return currLine;
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
