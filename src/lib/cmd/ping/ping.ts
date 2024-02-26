
import child_process, { ChildProcess } from 'child_process';
import { PostgresClient } from '../../db/pg-client';
import { ipProc } from '../net/ip';

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
  pingCb: (pingRes: PingResult) => void;
};

export async function pingMain(addr?: string) {

  const pgClient = await PostgresClient.getClient();

  const srcAddr = await ipProc();

  const pingCb = async (pingRes: PingResult) => {
    let queryString: string;
    let queryParams: [ string, number, string, number, number, number, string];
    let col_names = [
      'src_addr',
      'bytes',
      'addr',
      'seq',
      'ttl',
      'time',
      'time_unit',
    ];
    let col_nums = col_names.map((col_name, idx) => {
      return `$${idx + 1}`;
    }).join(', ');
    queryString = `INSERT INTO ping (${col_names.join(', ')}) VALUES(${col_nums})`;
    queryParams = [
      srcAddr,
      pingRes.bytes,
      pingRes.addr,
      pingRes.seq,
      pingRes.ttl,
      pingRes.time,
      pingRes.timeUnit,
    ];
    await pgClient.query(queryString, queryParams);
  };

  await ipProc();

  await pingProc({
    addr: addr ?? 'localhost',
    // count: 3,
    pingCb,
  });
  await pgClient.end();
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
  procArgs.push(opts.addr);
  proc = child_process.spawn('ping', procArgs);

  procPromise = new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      console.log(code);
      resolve();
    });
    proc.on('error', err => {
      console.error(err);
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
    console.error(`${data}`);
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
