
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

export type CmdDef<T extends SYSMON_CMD_ENUM = SYSMON_CMD_ENUM> = {
  long: CmdLong;
  short: CmdShort;
  arg?: [string, ArgKind];
  flags?: Record<keyof CmdFlagArgs[T], CmdFlagDef>
};

export type CmdFlagDef = {
  long: string;
  short: string;
  arg: [string, ArgKind] | 'boolean';
}

export type CmdArgs = {
  [SYSMON_CMD_ENUM.PING]: string,
  [SYSMON_CMD_ENUM.SCAN_DIR]: string[],
};

export type CmdArgType = CmdArgs[keyof CmdArgs];

export type CmdFlagArgs = {
  [SYSMON_CMD_ENUM.PING]: {
    wait?: number;
    count?: number;
    iface?: string;
  };
  [SYSMON_CMD_ENUM.SCAN_DIR]: {
    find_duplicates?: boolean;
    find_dirs?: string[];
  };
};

type KeyOfUnion<T> = T extends T ? keyof T : never;

export type CmdFlagArgKey = KeyOfUnion<CmdFlagArgs[keyof typeof SYSMON_CMD_ENUM]>;

// export type CmdFlagArgs = {
//   [SYSMON_CMD_ENUM.PING]: keyof typeof SYSMON_CMDS[SYSMON_CMD_ENUM.PING]['flags'],
//   [SYSMON_CMD_ENUM.SCAN_DIR]: string[],
// }
// let etc: CmdFlagArgs[SYSMON_CMD_ENUM.PING];
export const SYSMON_CMDS = {
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
} satisfies Record<SYSMON_CMD_ENUM, CmdDef>;
