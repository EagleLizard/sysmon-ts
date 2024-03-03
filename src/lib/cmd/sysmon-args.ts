
import { checkDir, getPathRelativeToCwd } from '../util/files';
import { isString } from '../util/validate-primitives';

export enum SYSMON_COMMAND_ENUM {
  SCAN_DIR = 'SCAN_DIR',
  PING = 'PING',
}

export type SysmonCommand = {
  kind: SYSMON_COMMAND_ENUM,
  command: string,
  short?: string,
  args?: string[];
  opts?: Record<string, ArgvOpt>
};

type ArgvOpt = {
  flag: string;
  value: string[];
};

type ParsedArgv = {
  cmd: string;
  args: string[];
  opts: Record<string, ArgvOpt>;
};

const SYSMON_COMMANDS: Record<SYSMON_COMMAND_ENUM, SysmonCommand> = {
  [SYSMON_COMMAND_ENUM.SCAN_DIR]: {
    kind: SYSMON_COMMAND_ENUM.SCAN_DIR,
    command: 'scandir',
    short: 'sd',
  },
  [SYSMON_COMMAND_ENUM.PING]: {
    kind: SYSMON_COMMAND_ENUM.PING,
    command: 'ping',
    short: 'p',
  }
};

const SYSMON_CMD_KEYS: SYSMON_COMMAND_ENUM[] = [
  SYSMON_COMMAND_ENUM.SCAN_DIR,
  SYSMON_COMMAND_ENUM.PING,
];

enum SCANDIR_CMD_FLAG_ENUM {
  FIND_DUPLICATES = 'FIND_DUPLICATES',
}

type SysmonCommandFlag<T> = {
  kind: T,
  flag: string;
  short: string;
};

enum PING_CMD_FLAG_ENUM {
  WAIT = 'WAIT', // i
  COUNT = 'COUNT', // c
  INTERFACE = 'INTERFACE', // I
  STATS = 'STATS', // s, stats
  IP = 'IP', // ip, ip
  STDDEV = 'STDDEV', // sd, stddev
}

export const PING_CMD_FLAG_MAP: Record<PING_CMD_FLAG_ENUM, SysmonCommandFlag<PING_CMD_FLAG_ENUM>> = {
  [PING_CMD_FLAG_ENUM.WAIT]: {
    kind: PING_CMD_FLAG_ENUM.WAIT,
    flag: 'wait',
    short: 'i',
  },
  [PING_CMD_FLAG_ENUM.COUNT]: {
    kind: PING_CMD_FLAG_ENUM.COUNT,
    flag: 'count',
    short: 'c',
  },
  [PING_CMD_FLAG_ENUM.INTERFACE]: {
    kind: PING_CMD_FLAG_ENUM.INTERFACE,
    flag: 'iface',
    short: 'I',
  },
  [PING_CMD_FLAG_ENUM.STATS]: {
    kind: PING_CMD_FLAG_ENUM.STATS,
    flag: 'stats',
    short: 's',
  },
  [PING_CMD_FLAG_ENUM.IP]: {
    kind: PING_CMD_FLAG_ENUM.IP,
    flag: 'ip',
    short: 'ip',
  },
  [PING_CMD_FLAG_ENUM.STDDEV]: {
    kind: PING_CMD_FLAG_ENUM.STDDEV,
    flag: 'stddev',
    short: 'sd',
  }
};

const PING_CMD_FLAG_KEYS: PING_CMD_FLAG_ENUM[] = [
  PING_CMD_FLAG_ENUM.WAIT,
  PING_CMD_FLAG_ENUM.COUNT,
  PING_CMD_FLAG_ENUM.INTERFACE,
  PING_CMD_FLAG_ENUM.STATS,
  PING_CMD_FLAG_ENUM.IP,
  PING_CMD_FLAG_ENUM.STDDEV,
];

export const FIND_DUPLICATES_FLAG_CMD: SysmonCommandFlag<SCANDIR_CMD_FLAG_ENUM> = {
  kind: SCANDIR_CMD_FLAG_ENUM.FIND_DUPLICATES,
  flag: 'find-duplicates',
  short: 'd'
};

export const SCANDIR_CMD_FLAGS: Record<SCANDIR_CMD_FLAG_ENUM, SysmonCommandFlag<SCANDIR_CMD_FLAG_ENUM>> = {
  [SCANDIR_CMD_FLAG_ENUM.FIND_DUPLICATES]: FIND_DUPLICATES_FLAG_CMD,
};

export const FIND_DUPLICATES_FLAG = 'find-duplicates';

export function parseSysmonArgs(): SysmonCommand {
  let cmdStr: string;
  let restPositionals: string[];
  let parsedArgv: ParsedArgv;
  parsedArgv = parseArgv(process.argv);
  console.log({
    parsedArgv,
  });

  cmdStr = parsedArgv.cmd;
  restPositionals = parsedArgv.args;
  let cmd = {
    ...getCommand(cmdStr)
  };

  switch(cmd.kind) {
    case SYSMON_COMMAND_ENUM.SCAN_DIR:
      // expects a string arg
      if(restPositionals.length < 1) {
        throw new Error(`Too few args: ${cmd.command} command requires 1 argument.`);
      }
      let dirPath = parsePathArg(restPositionals[0]);
      if(!checkDir(dirPath)) {
        throw new Error(`${cmd.command} expects a directory argument, found: ${dirPath}`);
      }
      console.log(dirPath);
      // cmd.args = dirPath;
      cmd.args = restPositionals;
      cmd.opts = {};
      if(hasSysmonCmdFlag(parsedArgv, FIND_DUPLICATES_FLAG_CMD)) {
        cmd.opts[FIND_DUPLICATES_FLAG_CMD.flag] = {
          ...parsedArgv.opts[FIND_DUPLICATES_FLAG_CMD.flag],
        };
      }
      break;
    case SYSMON_COMMAND_ENUM.PING:
      let addr: string | undefined;
      cmd.args = [];
      if(isString(restPositionals[0])) {
        addr = restPositionals[0];
        cmd.args.push(addr);
      }
      const flagOpts = {} as Record<string, ArgvOpt>;
      PING_CMD_FLAG_KEYS.forEach(flagKey => {
        let pingFlag = PING_CMD_FLAG_MAP[flagKey];
        if(
          (parsedArgv.opts[pingFlag.flag] !== undefined)
          || (parsedArgv.opts[pingFlag.short] !== undefined)
        ) {
          flagOpts[pingFlag.flag] = {
            ...(parsedArgv.opts[pingFlag.flag] ?? parsedArgv.opts[pingFlag.short])
          };
        }
      });
      cmd.opts = flagOpts;
      break;
    default:
      throw new Error(`unhandled command kind: ${cmd.kind}`);
  }
  return cmd;
}

function hasSysmonCmdFlag<T>(parsedArgv: ParsedArgv, sysmonCmdflag: SysmonCommandFlag<T> | undefined) {
  return (
    (sysmonCmdflag !== undefined)
    && (
      (parsedArgv.opts[sysmonCmdflag.flag] !== undefined)
      || (parsedArgv.opts[sysmonCmdflag.short] !== undefined)
    )
  );
}

function parseArgv(argv: string[]): ParsedArgv {
  let args: string[];
  let cmd: string;
  let cmdArgs: string[];
  let restArgs: string[];

  let parsedArgv: ParsedArgv;
  let opts: Record<string, ArgvOpt>;

  args = argv.slice(2);
  cmd = args[0];
  cmdArgs = [];
  restArgs = [];
  args.slice(1).some((arg, idx) => {
    if(isFlagArg(arg)) {
      restArgs = args.slice(idx + 1);
      return true;
    }
    cmdArgs.push(arg);
  });
  // if(isFlagArg(args[1])) {
  //   restArgs = args.slice(1);
  // } else {
  //   // cmdArgs = args[1];
  //   cmdArgs.push(args[1]);
  //   restArgs = args.slice(2);
  // }
  console.log({
    cmdArgs,
    restArgs,
  });

  opts = {};
  let flagFlag = false;
  let currFlag: string | undefined;
  let currVals: string[];
  currVals = [];
  restArgs.forEach((restArg, idx) => {
    let flag: string | undefined;
    if(!flagFlag) {
      if(!isFlagArg(restArg)) {
        throw new Error(`Expected flag, found: '${restArg}' at position ${idx}`);
      }
      flagFlag = true;
      flag = parseFlag(restArg);
      currFlag = flag;
      currVals = [];
    } else {
      if(isFlagArg(restArg)) {
        if(currFlag !== undefined) {
          opts[currFlag] = {
            flag: currFlag,
            value: currVals,
          };
        }
        flag = parseFlag(restArg);
        currFlag = flag;
        currVals = [];
      } else {
        currVals.push(restArg);
      }
    }
  });
  if(currFlag !== undefined) {
    opts[currFlag] = {
      flag: currFlag,
      value: currVals,
    };
  }

  parsedArgv = {
    cmd,
    args: [],
    opts,
  };
  if(cmdArgs !== undefined) {
    cmdArgs.forEach(arg => {
      parsedArgv.args.push(arg);
    });
    // parsedArgv.args.push(cmdArgs);
  }
  return parsedArgv;
}

function parseFlag(flagStr: string): string {
  let flag: string | undefined;
  flag = /[-]{1,2}([a-zA-Z-]+)/.exec(flagStr)?.[1];
  if(flag === undefined) {
    throw new Error(`Unexpected flag: '${flagStr}'`);
  }
  return flag;
}

function isFlagArg(argStr: string): boolean {
  return (
    argStr.startsWith('-')
    || argStr.startsWith('--')
  );
}

function parsePathArg(cmdArg: string): string {
  let cwdPath: string;
  cwdPath = getPathRelativeToCwd(cmdArg);
  return cwdPath;
}

function getCommand(cmdStr: string): SysmonCommand {
  let foundSmCmd: SysmonCommand | undefined;
  let cmdArr: SysmonCommand[];

  cmdArr = SYSMON_CMD_KEYS.map(cmdKey => {
    return SYSMON_COMMANDS[cmdKey];
  });

  foundSmCmd = cmdArr.find(smCmd => {
    return (smCmd.command === cmdStr)
      || (smCmd.short === cmdStr);
  });

  if(foundSmCmd === undefined) {
    throw new Error(`invalid command: ${cmdStr}`);
  }

  return foundSmCmd;
}
