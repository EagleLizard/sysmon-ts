
export enum SYSMON_CMD_ENUM {
  PING = 'PING',
  SCAN_DIR = 'SCAN_DIR',
}

export type ArgKind = 'string' | 'string[]' | 'number' | 'number[]';
export type ArgType = string | string[] | number | number[];

export type FlagArgType = ArgType | boolean;

type CmdLong = 'ping' | 'scan-dir';
type CmdShort = 'p' | 'sd';
export type CmdStr = CmdLong | CmdShort;

const cmdLongs: CmdLong[] = [
  'ping',
  'scan-dir',
];
const cmdShorts: CmdShort[] = [
  'p',
  'sd',
];
export const SYSMON_CMD_STRS: CmdStr[] = [
  ...cmdLongs,
  ...cmdShorts,
];

export type CmdDef = {
  long: CmdLong;
  short: CmdShort;
  arg?: [string, ArgKind];
  flags?: Record<string, CmdFlagDef>
};

export type CmdFlagDef = {
  long: string;
  short: string;
  arg: [string, ArgKind] | 'boolean';
}

export const SYSMON_CMDS: Record<SYSMON_CMD_ENUM, CmdDef> = {
  [SYSMON_CMD_ENUM.PING]: {
    long: 'ping',
    short: 'p',
    arg: [ 'address', 'string' ],
    flags: {
      wait: {
        long: 'wait',
        short: 'i',
        arg: [ 'seconds', 'number' ],
      },
      count: {
        long: 'count',
        short: 'c',
        arg: [ 'num_pings', 'number[]' ],
      },
      iface: {
        long: 'iface',
        short: 'I',
        arg: [ 'interface', 'string' ],
      },
    }
  },
  [SYSMON_CMD_ENUM.SCAN_DIR]: {
    long: 'scan-dir',
    short: 'sd',
    arg: [ 'directories', 'string[]' ],
    flags: {
      find_duplicates: {
        long: 'find-duplicates',
        short: 'd',
        arg: 'boolean',
      },
      find_dirs: {
        long: 'find-dirs',
        short: 'fd',
        arg: [ 'directories', 'string[]' ],
      },
    },
  },
};
