
import fs, { WriteStream } from 'fs';
import path from 'path';

import { SysmonCommand } from '../sysmon-args';
import { PingStatDto } from '../../models/ping-stat-dto';
import { ADDR_TYPE_ENUM } from '../../models/ping-args';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { OUT_DATA_DIR_PATH } from '../../../constants';
import { PingStatOpts, getPingStatOpts } from './ping-stat-opts';
import { PingStatsService } from './ping-stats-service';

type AggregatePingStats = {
  minAvg: number;
  maxAvg: number;
  avgSum: number;
  stdDev: number;
  totalPings: number;
  totalAvg: number;
};

type RunPingStatOpts = {
  pingStats: PingStatDto[];
  ws: WriteStream;
} & PingStatOpts;

export const LOCAL_PING_STATS_OUTFILE_NAME = 'out_local.txt';
export const GLOBAL_PING_STATS_OUTFILE_NAME = 'out_global.txt';
export const DEFAULT_PING_STATS_OUTFILE_NAME = 'out.txt';

export async function pingStatsMain(cmd: SysmonCommand) {
  let opts: PingStatOpts;
  let runOpts: RunPingStatOpts;
  let outFilePath: string;
  let ws: WriteStream;
  let pingStats: PingStatDto[];

  let getStatsMs: number;
  let timer: Timer;

  opts = getPingStatOpts(cmd);

  outFilePath = getOutFilePath(opts);
  ws = fs.createWriteStream(outFilePath);
  ws.write(`${(new Date).toISOString()}\n`);

  timer = Timer.start();
  pingStats = await PingStatsService.getPingStats(opts);
  getStatsMs = timer.stop();

  ws.write(`get stats took: ${getIntuitiveTimeString(getStatsMs)}\n\n`);

  runOpts = {
    ...opts,
    pingStats,
    ws,
  };

  await runPingStats(runOpts);
}

async function runPingStats(opts: RunPingStatOpts) {
  let aggStats: AggregatePingStats;
  let devPings: PingStatDto[];
  let sortedDevPings: PingStatDto[];

  aggStats = PingStatsService.getAggregateStats(opts.pingStats);
  // printStats(pingStats, minAvg, maxAvg, scale);

  devPings = opts.pingStats.filter(pingStat => {
    // return true;
    // return pingStat.avg > aggStats.totalAvg;
    return (pingStat.avg - aggStats.totalAvg) > (aggStats.stdDev * opts.numStdDevs);
    // return Math.abs(pingStat.avg - totalAvg) > (stdDev * numStdDeviations);
  });

  sortedDevPings = PingStatsService.sortPingStats(devPings);

  if(opts.network !== undefined) {
    opts.ws.write(JSON.stringify({
      network: opts.network,
    }));
    opts.ws.write('\n');
  }

  PingStatsService.printStats(sortedDevPings, aggStats, opts.ws);
}

function getOutFilePath(opts: PingStatOpts): string {
  let outFileName: string;
  let outFilePath: string;
  switch(opts.network) {
    case ADDR_TYPE_ENUM.LOCAL:
      outFileName = LOCAL_PING_STATS_OUTFILE_NAME;
      break;
    case ADDR_TYPE_ENUM.GLOBAL:
      outFileName = GLOBAL_PING_STATS_OUTFILE_NAME;
      break;
    default:
      outFileName = DEFAULT_PING_STATS_OUTFILE_NAME;
  }
  outFilePath = [
    OUT_DATA_DIR_PATH,
    outFileName,
  ].join(path.sep);
  return outFilePath;
}
