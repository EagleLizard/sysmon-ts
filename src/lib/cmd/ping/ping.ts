
import { ChildProcess } from 'child_process';

import { ipProc } from '../net/ip-proc';
import { logger } from '../../logger';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { config } from '../../../config';
import { PingService } from '../../service/ping-service';
import { isString } from '../../util/validate-primitives';
import { NetService } from '../../service/net-service';
import { PingProcOpts, PingResult, spawnPingProc } from './ping-proc';

const PING_INFO_LOG_INTERVAL_MS = (config.ENVIRONMENT === 'development')
  ? 0.25e3
  : 5e3
;
let activePingProc: ChildProcess | undefined;

export async function pingMain(cmd: SysmonCommand) {
  let pingTimer: Timer;
  let addr: string | undefined;
  let resolvedAddr: string | undefined;
  let waitStr: string | undefined;
  let wait: number | undefined;
  let countStr: string | undefined;
  let count: number | undefined;
  let pingProcOpts: PingProcOpts;
  let iface: string | undefined;

  if(cmd.args === undefined) {
    throw new Error(`at least 1 positional argument required for command '${cmd.command}'`);
  }
  if(isString(cmd.args[0])) {
    addr = cmd.args[0];
    resolvedAddr = await NetService.dnsLookup(addr);
  }
  waitStr = cmd.opts?.['i']?.value[0];
  if(
    waitStr !== undefined
    && !isNaN(+waitStr)
  ) {
    wait = +waitStr;
  }
  countStr = cmd.opts?.['c']?.value[0];
  if(
    (countStr !== undefined)
    && !isNaN(+countStr)
  ) {
    count = +countStr;
  }

  iface = cmd.opts?.['I']?.value[0] ?? undefined;

  const srcAddr = await ipProc();

  if(addr === undefined) {
    logger.error(cmd);
    throw new Error('Invalid ping command');
  }
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
  console.log(pingProcOpts);
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


