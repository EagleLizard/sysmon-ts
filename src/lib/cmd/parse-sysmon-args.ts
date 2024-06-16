
import { z } from 'zod';

export enum SYSMON_CMD_ENUM {
  HELP = 'HELP',
  PING = 'PING',
  SCAN_DIR = 'SCAN_DIR',
  MONITOR = 'MONITOR',
  PING_STAT = 'PING_STAT',
  ADMIN = 'ADMIN',
  SPEEDTEST = 'SPEEDTEST',
  T_NINE = 'T_NINE',
  ENCODE = 'ENCODE',
}

const PingOptSchema = z.tuple([
  z.literal('-i').or(z.literal('--wait')).transform(() => 'wait' as const),
  z.array(z.coerce.number()).length(1),
]).or(
  z.tuple([
    z.literal('-c').or(z.literal('--count')).transform(() => 'count' as const),
    z.array(z.coerce.number()).length(1),
  ])
).or(
  z.tuple([
    z.literal('-I').or(z.literal('--iface')).transform(() => 'iface' as const),
    z.array(z.string()).length(1),
  ])
);

const ScanDirOptsSchema = z.tuple([
  z.literal('-d').or(z.literal('--find-duplicates')).transform(() => 'find_duplicates' as const),
  z.tuple([]).transform(() => [ true ]).or(
    z.tuple([
      z.literal('true').or(z.literal('false')).transform(val => {
        return val === 'true' ? true : false;
      }),
    ]),
  ),
]).or(
  z.tuple([
    z.literal('-fd').or(z.literal('--find-dirs')).transform(() => 'find_dirs' as const),
    z.array(z.string()).min(1),
  ])
);

const MonitorOptsSchema = z.tuple([
  z.literal('-si').or(z.literal('--sample-interval')).transform(() => 'sample_interval' as const),
  z.tuple([
    z.coerce.number(),
  ]),
]).or(
  z.tuple([
    z.literal('-sm').or(z.literal('--sample-max')).transform(() => 'sample_max' as const),
    z.tuple([
      z.coerce.number(),
    ]),
  ])
);

const PingStatOptsSchema = z.tuple([
  z.literal('-ip').or(z.literal('--ip')).transform(() => 'ip' as const),
  z.tuple([
    z.string(),
  ]),
]).or(
  z.tuple([
    z.literal('-net').or(z.literal('--network')).transform(() => 'network' as const),
    z.tuple([
      z.string(),
    ]),
  ])
).or(
  z.tuple([
    z.literal('-b').or(z.literal('--bucket')).transform(() => 'bucket' as const),
    z.tuple([
      z.string(),
    ]),
  ])
).or(
  z.tuple([
    z.literal('-sd').or(z.literal('--stddev')).transform(() => 'stddev' as const),
    z.tuple([
      z.coerce.number(),
    ]),
  ])
).or(
  z.tuple([
    z.literal('-s').or(z.literal('--start')).transform(() => 'start' as const),
    z.tuple([
      z.string(),
    ]),
  ])
);

const EncodeOptsSchema = z.tuple([
  z.literal('-d').or(z.literal('--decode')).transform(() => 'decode' as const),
  z.tuple([]).transform(() => [ true ]).or(
    z.tuple([
      z.literal('true').or(z.literal('false')).transform(val => {
        return val === 'true' ? true : false;
      }),
    ]),
  ),
]);

export type PingOpts = {
  wait?: number;
  count?: number;
  iface?: string;
};

export type ScanDirOpts = {
  find_duplicates?: boolean;
  find_dirs?: string[];
}

export type MonitorOpts = {
  sample_interval?: number;
  sample_max?: number;
};

export type EncodeOpts = {
  decode?: boolean;
}

export function getCmdKind(cmdStr: string) {
  switch(cmdStr) {
    case 'ping':
    case 'p':
      return SYSMON_CMD_ENUM.PING;
    case 'scan-dir':
    case 'sd':
      return SYSMON_CMD_ENUM.SCAN_DIR;
    case 'monitor':
    case 'm':
      return SYSMON_CMD_ENUM.MONITOR;
    case 'ping-stat':
    case 'ps':
      return SYSMON_CMD_ENUM.PING_STAT;
    case 'admin':
    case 'a':
      return SYSMON_CMD_ENUM.ADMIN;
    case 'speedtest':
    case 'sp':
      return SYSMON_CMD_ENUM.SPEEDTEST;
    case 't9':
      return SYSMON_CMD_ENUM.T_NINE;
    case 'encode':
    case 'e':
      return SYSMON_CMD_ENUM.ENCODE;
    case 'help':
    case 'h':
      return SYSMON_CMD_ENUM.HELP;
    default:
      throw new Error(`Invalid command: ${cmdStr}`);
  }
}

export function getEncodeArgs(args: string[]): string {
  if(args.length !== 1) {
    throw new Error(`Invalid decode command: expected one argument, received: ${args.length}`);
  }
  return args[0];
}

export function getEncodeOpts(opts: [string, string[]][]) {
  let encodeOpts: EncodeOpts;
  encodeOpts = {};
  for(let i = 0; i < opts.length; ++i) {
    let encodeOpt = EncodeOptsSchema.parse(opts[i]);
    switch(encodeOpt[0]) {
      case 'decode':
        encodeOpts.decode = encodeOpt[1][0];
    }
  }
  return encodeOpts;
}

export function getAdminArgs(args: string[]): string {
  if(args.length !== 1) {
    throw new Error(`Invalid admin command: Expected one argument, received: ${args.length}`);
  }
  return args[0];
}

export function getPingArgs(args: string[]): string {
  if(args.length !== 1) {
    throw new Error(`Invalid ping command: Expected one address argument, received: ${args.length}`);
  }
  return args[0];
}

export function getPingOpts(opts: [string, string[]][]) {
  let pingOpts: PingOpts;
  console.log(opts);
  pingOpts = {};
  for(let i = 0; i < opts.length; ++i) {
    let pingOpt = PingOptSchema.parse(opts[i]);
    switch(pingOpt[0]) {
      case 'wait':
        pingOpts.wait = pingOpt[1][0];
        break;
      case 'count':
        pingOpts.count = pingOpt[1][0];
        break;
      case 'iface':
        pingOpts.iface = pingOpt[1][0];
        break;
    }
  }
  return pingOpts;
}

export function getScanDirArgs(args: string[]): string[] {
  if(args.length < 1) {
    throw new Error('Invalid scan-dir command: expected at least one path argument');
  }
  return args;
}

export function getScanDirOpts(opts: [string, string[]][]) {
  let scanDirOpts: ScanDirOpts;
  console.log(opts);
  scanDirOpts = {};
  for(let i = 0; i < opts.length; ++i) {
    let scanDirOpt = ScanDirOptsSchema.parse(opts[i]);
    switch(scanDirOpt[0]) {
      case 'find_duplicates':
        scanDirOpts.find_duplicates = scanDirOpt[1][0];
        break;
      case 'find_dirs':
        scanDirOpts.find_dirs = scanDirOpt[1];
        break;
    }
  }
  return scanDirOpts;
}

export function getMonitorOpts(opts: [string, string[]][]): MonitorOpts {
  let monitorOpts: MonitorOpts;
  monitorOpts = {};
  for(let i = 0; i < opts.length; ++i) {
    let monitorOpt = MonitorOptsSchema.parse(opts[i]);
    switch(monitorOpt[0]) {
      case 'sample_interval':
        monitorOpts.sample_interval = monitorOpt[1][0];
        break;
      case 'sample_max':
        monitorOpts.sample_max = monitorOpt[1][0];
        break;
    }
  }
  return monitorOpts;
}

export type PingStatOpts = {
  ip?: string;
  network?: string;
  bucket?: string;
  stddev?: number;
  start?: string;
}

export function getPingStatOpts(opts: [string, string[]][]): PingStatOpts {
  let pingStatOpts: PingStatOpts;
  pingStatOpts = {};
  for(let i = 0; i < opts.length; ++i) {
    let pingStatOpt = PingStatOptsSchema.parse(opts[i]);
    switch(pingStatOpt[0]) {
      case 'ip':
        pingStatOpts.ip = pingStatOpt[1][0];
        break;
      case 'network':
        pingStatOpts.network = pingStatOpt[1][0];
        break;
      case 'bucket':
        pingStatOpts.bucket = pingStatOpt[1][0];
        break;
      case 'stddev':
        pingStatOpts.stddev = pingStatOpt[1][0];
        break;
      case 'start':
        pingStatOpts.start = pingStatOpt[1][0];
        break;
    }
  }
  return pingStatOpts;
}
