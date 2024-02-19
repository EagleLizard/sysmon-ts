
import { parseArgs } from 'util';
import { checkDir, getPathRelativeToCwd } from '../util/files';

export enum SYSMON_COMMAND_ENUM {
  SCAN_DIR = 'SCAN_DIR',
}

export type SysmonCommand = {
  kind: SYSMON_COMMAND_ENUM,
  command: string,
  short?: string,
  arg?: string;
};

const SYSMON_COMMANDS: Record<SYSMON_COMMAND_ENUM, SysmonCommand> = {
  [SYSMON_COMMAND_ENUM.SCAN_DIR]: {
    kind: SYSMON_COMMAND_ENUM.SCAN_DIR,
    command: 'scandir',
    short: 'sd',
  },
};

const SYSMON_CMD_KEYS: SYSMON_COMMAND_ENUM[] = [
  SYSMON_COMMAND_ENUM.SCAN_DIR,
];

export function parseSysmonArgs(): SysmonCommand {
  let cmdStr: string;
  let positionals: string[];
  let restPositionals: string[];
  let parsedArgs = parseArgs({
    // args: argv,
    allowPositionals: true,
  });

  positionals = parsedArgs.positionals;

  cmdStr = positionals[0];
  restPositionals = positionals.slice(1);
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
      break;
    default:
      throw new Error(`unhandled command kind: ${cmd.kind}`);
  }
  return cmd;
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
