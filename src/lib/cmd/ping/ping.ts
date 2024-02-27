
import child_process, { ChildProcess } from 'child_process';
import { PostgresClient } from '../../db/pg-client';
import { ipProc } from '../net/ip';
import { logger } from '../../logger';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { config } from '../../../config';
import { PingService } from '../../service/ping-service';

type PingResult = {
  bytes: number;
  addr: string;
  seq: number;
  ttl: number;
  time: number;
  timeUnit: string;
};

type PingProcOpts = {
  addr: string,
  count?: number,
  wait?: number,
  pingCb: (pingRes: PingResult) => void;
};

export async function pingMain(cmd: SysmonCommand) {
  let pingTimer: Timer;
  let addr: string;
  let waitStr: string | undefined;
  let wait: number | undefined;
  let countStr: string | undefined;
  let count: number | undefined;
  let pingProcOpts: PingProcOpts;

  let srcAddrId: number;
  let addrId: number;
  if(cmd.arg === undefined) {
    throw new Error(`at least 1 positional argument required for command '${cmd.command}'`);
  }
  addr = cmd.arg;
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

  const pgClient = await PostgresClient.getClient();

  const srcAddr = await ipProc();

  let rawSrcAddrId: number | undefined;
  rawSrcAddrId = await PingService.getAddrIdByVal(srcAddr);
  if(rawSrcAddrId === undefined) {
    srcAddrId = await PingService.insertAddr(srcAddr);
  } else {
    srcAddrId = rawSrcAddrId;
  }

  let rawAddrId: number | undefined;
  rawAddrId = await PingService.getAddrIdByVal(addr);
  if(rawAddrId === undefined) {
    addrId = await PingService.insertAddr(addr);
  } else {
    addrId = rawAddrId;
  }

  const pingCb = async (pingRes: PingResult) => {
    let queryString: string;
    let queryParams: [ number, number, number, number, number, number, string];
    let col_names = [
      'src_addr_id',
      'bytes',
      'addr_id',
      'seq',
      'ttl',
      'time',
      'time_unit',
    ];
    let col_nums = col_names.map((col_name, idx) => {
      return `$${idx + 1}`;
    }).join(', ');
    if(pingRes.addr !== addr) {
      throw new Error(`received ip '${pingRes.addr}', expected '${srcAddr}'`);
    }
    queryString = `INSERT INTO ping (${col_names.join(', ')}) VALUES(${col_nums})`;
    queryParams = [
      srcAddrId,
      pingRes.bytes,
      addrId,
      pingRes.seq,
      pingRes.ttl,
      pingRes.time,
      pingRes.timeUnit,
    ];

    await pgClient.query(queryString, queryParams);
    if(
      ((pingRes.seq % 3) === 0)
      && (config.ENVIRONMENT === 'development')
    ) {
      logger.info({
        srcAddr,
        ...pingRes
      });
    }
    if(pingTimer.currentMs() > 1.5e4) {
      if(config.ENVIRONMENT === 'development') {
        logger.info(`${'~'.repeat(100)}`);
      }
      logger.info({
        srcAddr,
        ...pingRes
      });
      pingTimer.reset();
    }
  };

  await ipProc();

  pingProcOpts = {
    addr: addr ?? 'localhost',
    pingCb,
  };
  if(wait !== undefined) {
    pingProcOpts.wait = wait;
  }
  if(count !== undefined) {
    pingProcOpts.count = count;
  }
  console.log(pingProcOpts);
  pingTimer = Timer.start();
  await pingProc(pingProcOpts);
  // await pingProc({
  //   addr: addr ?? 'localhost',
  //   // count: 3,
  //   wait: 0.5,
  //   pingCb,
  // });
  await pgClient.release();
}

function pingProc(opts: PingProcOpts): Promise<void> {
  let proc: ChildProcess;
  let procPromise: Promise<void>;
  let procArgs: string[];

  procArgs = [];
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
  procArgs.push(opts.addr);
  logger.info(`ping ${procArgs.join(' ')}`);
  proc = child_process.spawn('ping', procArgs);

  procPromise = new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      console.log(code);
      resolve();
    });
    proc.on('error', err => {
      logger.error(err);
      reject(err);
    });
  });

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

  proc.stdout?.on('data', (data) => {
    let dataStr: string;
    let lines: string[];
    dataStr = `${data}`;
    lines = dataStr.split('\n').filter(line => line.trim().length > 0);
    lines.forEach(line => {
      lineCb(line);
    });
  });
  proc.stderr?.on('data', (data) => {
    logger.error(`${data}`);
  });

  return procPromise;
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
