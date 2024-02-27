
import { checkDir, getPathRelativeToCwd } from '../util/files';

export enum SYSMON_COMMAND_ENUM {
  SCAN_DIR = 'SCAN_DIR',
  PING = 'PING',
}

export type SysmonCommand = {
  kind: SYSMON_COMMAND_ENUM,
  command: string,
  short?: string,
  arg?: string;
  opts?: Record<string, ArgvOpt>
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

export const FIND_DUPLICATES_FLAG_CMD:SysmonCommandFlag<SCANDIR_CMD_FLAG_ENUM> = {
  kind: SCANDIR_CMD_FLAG_ENUM.FIND_DUPLICATES,
  flag: 'find-duplicates',
  short: 'd'
};

export const WAIT_FLAG_CMD = {};
export const COUNT_FLAG_CMD = {};

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
  restPositionals = parsedArgv.arg;
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
      cmd.arg = dirPath;
      cmd.opts = {};
      if(hasSysmonCmdFlag(parsedArgv, FIND_DUPLICATES_FLAG_CMD)) {
        cmd.opts[FIND_DUPLICATES_FLAG_CMD.flag] = {
          ...parsedArgv.opts[FIND_DUPLICATES_FLAG_CMD.flag],
        };
      }
      break;
    case SYSMON_COMMAND_ENUM.PING:
      let addr: string | undefined;
      addr = restPositionals[0];
      cmd.arg = addr;
      cmd.opts = {};
      if(parsedArgv.opts['i'] !== undefined) {
        cmd.opts['i'] = {
          ...parsedArgv.opts['i']
        };
      }
      if(parsedArgv.opts['c'] !== undefined) {
        cmd.opts['c'] = {
          ...parsedArgv.opts['c']
        };
      }
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

type ArgvOpt = {
  flag: string;
  value: string[];
};

type ParsedArgv = {
  cmd: string;
  arg: string[];
  opts: Record<string, ArgvOpt>;
};

function parseArgv(argv: string[]): ParsedArgv {
  let args: string[];
  let cmd: string;
  let cmdArg: string | undefined;
  let restArgs: string[];

  let parsedArgv: ParsedArgv;
  let opts: Record<string, ArgvOpt>;

  args = argv.slice(2);
  cmd = args[0];
  if(isFlagArg(args[1])) {
    restArgs = args.slice(1);
  } else {
    cmdArg = args[1];
    restArgs = args.slice(2);
  }

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
    arg: [],
    opts,
  };
  if(cmdArg !== undefined) {
    parsedArgv.arg.push(cmdArg);
  }
  return parsedArgv;
}

function parseFlag(flagStr: string): string {
  let flag: string | undefined;
  flag = /[-]{1,2}([a-z-]+)/.exec(flagStr)?.[1];
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
