
import { ChildProcess } from 'child_process';

import { ipProc } from '../net/ip-proc';
import { logger } from '../../logger';
import { Timer } from '../../util/timer';
import { config } from '../../../config';
import { PingService } from '../../service/ping-service';
import { isString } from '../../util/validate-primitives';
import { NetService } from '../../service/net-service';
import { PingProcOpts, PingResult, spawnPingProc } from './ping-proc';
import { PingOpts, getPingArgs, getPingOpts } from '../parse-sysmon-args';
import { ParsedArgv2 } from '../parse-argv';

const PING_INFO_LOG_INTERVAL_MS = (config.ENVIRONMENT === 'development')
  ? 0.25e3
  : 5e3
;
let activePingProc: ChildProcess | undefined;

export async function pingMain(parsedArgv: ParsedArgv2) {
  let addr: string;
  let opts: PingOpts;

  let pingTimer: Timer;
  let resolvedAddr: string | undefined;
  let wait: number | undefined;
  let count: number | undefined;
  let pingProcOpts: PingProcOpts;
  let iface: string | undefined;

  addr = getPingArgs(parsedArgv.args);
  opts = getPingOpts(parsedArgv.opts);

  resolvedAddr = await NetService.dnsLookup(addr);
  wait = opts.wait;
  count = opts.count;
  iface = opts.iface;

  const srcAddr = await ipProc();

  if(!isString(resolvedAddr)) {
    throw new Error(`Failed to resolve: ${addr}`);
  }

  console.log({
    addr,
    resolvedAddr,
  });

  const pingCb = async (pingRes: PingResult) => {
    if(pingRes.addr !== resolvedAddr) {
      // throw new Error(`received ip '${pingRes.addr}', expected '${srcAddr}'`);
      throw new Error(`received ip '${pingRes.addr}', expected '${resolvedAddr}'`);
    }
    await PingService.postPing({
      srcAddr,
      ...pingRes,
    });

    if(pingTimer.currentMs() > PING_INFO_LOG_INTERVAL_MS) {
      // if(config.ENVIRONMENT === 'development') {
      //   logger.info(`${'~'.repeat(100)}`);
      // }
      logger.info({
        srcAddr,
        ...pingRes
      });
      pingTimer.reset();
    }
  };

  pingProcOpts = {
    addr: resolvedAddr,
    pingCb,
  };

  if(wait !== undefined) {
    pingProcOpts.wait = wait;
  }
  if(count !== undefined) {
    pingProcOpts.count = count;
  }
  if(iface !== undefined) {
    pingProcOpts.I = iface;
  }

  pingTimer = Timer.start();
  const [ pingProc, pingProcPromise ] = spawnPingProc(pingProcOpts);

  activePingProc = pingProc;

  await pingProcPromise;
}

export function killActivePingProc() {
  if(activePingProc === undefined) {
    return;
  }
  activePingProc.kill('SIGINT');
}
