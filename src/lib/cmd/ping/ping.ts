
import { ChildProcess } from 'child_process';

import { ipProc } from '../net/ip';
import { logger } from '../../logger';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { config } from '../../../config';
import { PingService } from '../../service/ping-service';
import { spawnProc } from '../proc';
import { isString } from '../../util/validate-primitives';
import { NetService } from '../../service/net-service';

const PING_INFO_LOG_INTERVAL_MS = (config.ENVIRONMENT === 'development')
  ? 0.25e3
  : 5e3
;
let activePingProc: ChildProcess | undefined;

type PingResult = {
  bytes: number;
  addr: string;
  seq: number;
  ttl: number;
  time: number;
  timeUnit: string;
};

type PingProcOpts = {
  addr: string;
  count?: number;
  wait?: number;
  I?: string;
  pingCb: (pingRes: PingResult) => void;
};

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

function spawnPingProc(opts: PingProcOpts): [ ChildProcess, Promise<string | void> ] {
  let procArgs: string[];

  procArgs = [];

  procArgs.push(opts.addr);

  if(opts.count !== undefined) {
    procArgs.push(
      '-c',
      `${opts.count}`,
    );
  }
  if(opts.wait !== undefined) {
    procArgs.push(
      '-i',
      `${opts.wait}`,
    );
  }
  if(opts.I !== undefined) {
    procArgs.push(
      '-I',
      `${opts.I}`,
    );
  }
  logger.info(`ping ${procArgs.join(' ')}`);

  const lineCb = (line: string) => {
    let pingRes: PingResult;
    if(line.startsWith('PING')) {
      return;
    }
    if(/^[0-9]+ bytes/.test(line)) {
      pingRes = parsePingLine(line);

      opts.pingCb(pingRes);
    }
  };

  let procRes = spawnProc('ping', procArgs, {
    onData: (data) => {
      let dataStr: string;
      let lines: string[];
      dataStr = `${data}`;
      lines = dataStr.split('\n').filter(line => line.trim().length > 0);
      lines.forEach(line => {
        lineCb(line);
      });
    },
  });

  return [ procRes.proc, procRes.promise ];
}

function parsePingLine(line: string): PingResult {
  let pingRes: PingResult;
  let bytesStr: string | undefined;
  let bytes: number;
  bytesStr = /([0-9]+) bytes/.exec(line)?.[1];
  if(
    (bytesStr === undefined)
    || isNaN(+bytesStr)
  ) {
    throw new Error(`Unexpected bytes for line: ${line}`);
  }
  bytes = +bytesStr;

  let addr: string | undefined;
  addr = /from ([\S]+):/.exec(line)?.[1];
  if(addr === undefined) {
    throw new Error(`Unexpected addr for line: ${line}`);
  }

  let seqStr: string | undefined;
  let seq: number;
  seqStr = /(?:icmp_seq|seq)=([0-9]+) /.exec(line)?.[1];
  if(
    (seqStr === undefined)
    || isNaN(+seqStr)
  ) {
    throw new Error(`Unexpected icmp_seq for line: ${line}`);
  }
  seq = +seqStr;

  let ttlStr: string | undefined;
  let ttl: number;
  ttlStr = /ttl=([0-9]+) /.exec(line)?.[1];
  if(
    (ttlStr === undefined)
    || (isNaN(+ttlStr))
  ) {
    throw new Error(`Unexpected ttl for line: ${line}`);
  }
  ttl = +ttlStr;

  let timeRxRes: RegExpExecArray | null;
  timeRxRes = /([0-9]+\.[0-9]+) ([a-z]+)/.exec(line);
  if(timeRxRes === null) {
    throw new Error(`Unexpected time for line: ${line}`);
  }
  let timeStr: string | undefined;
  let time: number;
  timeStr = timeRxRes[1];
  if(
    (timeStr === undefined)
    || isNaN(+timeStr)
  ) {
    throw new Error(`Unexpected time number for line: ${line}`);
  }
  time = +timeStr;

  let timeUnitStr: string | undefined;
  timeUnitStr = timeRxRes[2];
  if(timeUnitStr === undefined) {
    throw new Error(`Unexpected time unit for line: ${line}`);
  }
  pingRes = {
    bytes,
    addr,
    seq,
    ttl,
    time,
    timeUnit: timeUnitStr,
  };
  return pingRes;
}
