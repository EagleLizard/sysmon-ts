
import fs, { WriteStream } from 'fs';
import path from 'path';

import { PingStatDto } from '../../models/ping-stat-dto';
import { ADDR_TYPE_ENUM } from '../../models/ping-args';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { OUT_DATA_DIR_PATH } from '../../../constants';
import { _PingStatOpts, _getPingStatOpts } from './ping-stat-opts';
import { PingStatsService } from './ping-stats-service';
import { getPingStatOpts } from '../parse-sysmon-args';
import { ParsedArgv2 } from '../parse-argv';

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
} & _PingStatOpts;

export const LOCAL_PING_STATS_OUTFILE_NAME = 'out_local.txt';
export const GLOBAL_PING_STATS_OUTFILE_NAME = 'out_global.txt';
export const DEFAULT_PING_STATS_OUTFILE_NAME = 'out.txt';

export async function pingStatsMain(parsedArgv: ParsedArgv2) {
  let opts: _PingStatOpts;
  let runOpts: RunPingStatOpts;
  let outFilePath: string;
  let ws: WriteStream;
  let pingStats: PingStatDto[];

  let getStatsMs: number;
  let timer: Timer;

  opts = _getPingStatOpts(getPingStatOpts(parsedArgv.opts));

  outFilePath = getOutFilePath(opts);
  ws = fs.createWriteStream(outFilePath);
  ws.write(`${(new Date).toISOString()}\n`);

  timer = Timer.start();
  pingStats = await PingStatsService.getPingStats(opts);
  getStatsMs = timer.stop();
  let statsTimeStr = `get stats took: ${getIntuitiveTimeString(getStatsMs)}`;
  console.log(statsTimeStr);
  ws.write(`${statsTimeStr}\n\n`);

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
    // return Math.abs(pingStat.avg - aggStats.totalAvg) > (aggStats.stdDev * opts.numStdDevs);
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

function getOutFilePath(opts: _PingStatOpts): string {
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
