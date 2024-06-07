
import { ParsedArgv2, parseArgv2 } from './parse-argv';
import { ArgKind, CmdArgs, CmdArgType, CmdDef, CmdFlagArgs, CmdFlagArgKey, CmdFlagDef, CmdStr, FlagArgType, SYSMON_CMD_ENUM, SYSMON_CMD_STRS, SYSMON_CMDS } from './sysmon-cmd-defs';

type CmdFlag = {
  flagDef: CmdFlagDef;
  args: FlagArgType;
};

export type Cmd<T extends SYSMON_CMD_ENUM = SYSMON_CMD_ENUM> = {
  kind: T;
  cmdDef: CmdDef;
  args?: CmdArgs[T];
  opts: CmdFlagArgs[T];
  // opts: Record<CmdOptKey, CmdFlag>;
}

SYSMON_CMDS[SYSMON_CMD_ENUM.PING].long;

export function parseSysmonArgs2(argv: string[]) {
  let parsedArgv: ParsedArgv2;
  let cmd: string;
  console.log(argv);
  parsedArgv = parseArgv2(argv);
  console.log('parsedArgv:');
  console.log(parsedArgv);
  cmd = parsedArgv.cmd;
  // console.log('-- Parsed:');
  let sysmonCmd = parseSysmonCmd(cmd, parsedArgv);
  console.log(sysmonCmd);
  return sysmonCmd;
}

function parseSysmonCmd(cmdStr: string, parsedArgv: ParsedArgv2): Cmd {
  let cmdKind: SYSMON_CMD_ENUM;
  let cmdDef: CmdDef;
  let cmdArgs: CmdArgType | undefined;
  let cmdFlags: [flagKey: CmdFlagArgKey, CmdFlag][];
  // let cmdOpts: Partial<Record<CmdFlagArgKey, CmdFlag>>;
  let cmdOpts: CmdFlagArgs[keyof typeof SYSMON_CMD_ENUM];
  let cmd: Cmd;

  cmdFlags = [];

  if(!validateCmdStr(cmdStr)) {
    throw new Error(`Invalid command: ${cmdStr}`);
  }
  switch(cmdStr) {
    case 'ping':
    case 'p':
      cmdKind = SYSMON_CMD_ENUM.PING;
      break;
    case 'scan-dir':
    case 'sd':
      cmdKind = SYSMON_CMD_ENUM.SCAN_DIR;
      break;
    default:
      throw new Error(`No command def found for '${cmdStr}'`);
  }

  cmdDef = SYSMON_CMDS[cmdKind];

  if(cmdDef.arg !== undefined) {
    let argDef: [string, ArgKind];
    // let argKey: string;
    let argKind: string;
    argDef = cmdDef.arg;
    [ , argKind ] = argDef;
    // console.log(`${argKey}: ${argKind}`);
    switch(argKind) {
      case 'number':
        break;
      case 'number[]':
        break;
      case 'string':
        if(parsedArgv.args.length > 1) {
          throw new Error(`Expected one argument, received ${parsedArgv.args.length}`);
        }
        cmdArgs = parsedArgv.args[0];
        break;
      case 'string[]':
        cmdArgs = parsedArgv.args;
        break;
    }
  }

  if(cmdDef.flags !== undefined) {
    for(let i = 0; i < parsedArgv.opts.length; ++i) {
      let currOpt: [string, string[]];
      let optKey: string;
      let flagDefTuple: [flagKey: CmdFlagArgKey, CmdFlagDef] | undefined;
      let flagDef: CmdFlagDef;
      let flagKey: CmdFlagArgKey;
      let cmdFlag: CmdFlag;
      currOpt = parsedArgv.opts[i];
      optKey = currOpt[0];
      flagDefTuple = findFlagDef(optKey, cmdDef);
      if(flagDefTuple === undefined) {
        throw new Error(`Invalid flag: ${optKey}`);
      }
      [ flagKey, flagDef ] = flagDefTuple;
      cmdFlag = parseCmdFlag(flagDef, currOpt);
      cmdFlags.push([ flagKey, cmdFlag ]);
    }
  }
  cmdOpts = {};
  for(let i = 0; i < cmdFlags.length; ++i) {
    let flagKey: CmdFlagArgKey;
    let cmdFlag: CmdFlag;
    [ flagKey, cmdFlag ] = cmdFlags[i];
    // kind of gross but should be typesafe
    (cmdOpts as Record<any, CmdFlag>)[flagKey] = cmdFlag;
  }
  cmd = {
    kind: cmdKind,
    cmdDef,
    args: cmdArgs,
    opts: cmdOpts,
  };
  return cmd;
}

function parseCmdFlag(flagDef: CmdFlagDef, flagOpt: [string, string[]]): CmdFlag {
  let optKey: string;
  let opts: string[];
  let flagArg: FlagArgType;
  let cmdFlag: CmdFlag;
  // let argLabel: string;
  let argKind: ArgKind;
  let flagStr: string;
  [ optKey, opts ] = flagOpt;
  if(flagDef.arg === 'boolean') {
    let flagVal: boolean;
    if(opts.length === 0) {
      /*
        --flag
      */
      flagVal = true;
    } else if(opts.length === 1) {
      let flagStr: string;
      /*
        --flag=<value>
      */
      flagStr = opts[0];
      if(flagStr === 'true') {
        flagVal = true;
      } else if(flagStr === 'false') {
        flagVal = false;
      } else {
        /*
          --flag=1
          --flag=str
        */
        throw new Error(`Invalid boolean flag assignment: ${optKey}=${flagStr}`);
      }
    } else {
      /*
        --flag=true false
      */
      throw new Error(`Invalid flag assignment: ${optKey}=${opts.join(' ')}`);
    }
    flagArg = flagVal;
    cmdFlag = {
      flagDef,
      args: flagArg,
    };
    return cmdFlag;
  }
  // console.log(optKey);
  // console.log(opts);
  [ , argKind ] = flagDef.arg;
  switch(argKind) {
    case 'number':
      if(opts.length !== 1) {
        /*
            --flag
            --flag 1 2
        */
        throw new Error(`Invalid flag: expected one argument, received ${opts.length}: ${optKey} ${opts.join(' ')}`);
      }
      flagStr = opts[0];
      if(isNaN(+flagStr)) {
        throw new Error(`Invalid flag: expected a number: ${optKey} ${flagStr}`);
      }
      flagArg = +flagStr;
      break;
    case 'number[]':
      let flagVals: number[];
      flagVals = [];
      if(opts.length < 1) {
        /*
          --flag=
        */
        throw new Error(`Invalid flag: ${optKey} expects at least one argument`);
      }
      for(let k = 0; k < opts.length; ++k) {
        let opt = opts[k];
        if(isNaN(+opt)) {
          throw new Error(`Invalid flag: '${opt}' is NaN: ${optKey} ${opts.join(' ')}`);
        }
        flagVals.push(+opt);
      }
      flagArg = flagVals;
      break;
    case 'string':
      if(opts.length !== 1) {
        throw new Error(`Invalid flag: expected one argument, received: ${opts.length}: ${optKey} ${opts.join(' ')}`);
      }
      flagArg = opts[0];
      break;
    case 'string[]':
      if(opts.length < 1) {
        throw new Error(`Invalid flag: ${optKey} expects at least one argument`);
      }
      flagArg = opts;
  }
  cmdFlag = {
    flagDef,
    args: flagArg,
  };
  return cmdFlag;
}

function findFlagDef(flag: string, cmdDef: CmdDef): [CmdFlagArgKey, CmdFlagDef] | undefined {
  let flagTuples: [string, CmdFlagDef][];
  let opt: string;
  opt = stripOpt(flag);
  if(cmdDef.flags === undefined) {
    return;
  }
  flagTuples = Object.entries(cmdDef.flags);
  for(let i = 0; i < flagTuples.length; ++i) {
    let flagKey: string;
    let flagDef: CmdFlagDef;
    [ flagKey, flagDef ] = flagTuples[i];
    // console.log(flagDef);
    if(
      (flagDef.long === opt)
      || (flagDef.short === opt)
    ) {
      return [ flagKey, flagDef ] as [CmdFlagArgKey, CmdFlagDef];
    }
  }
}

function stripOpt(opt: string) {
  return opt.replaceAll(/^[-]+/g, '');
}

function validateCmdStr(cmd: string): cmd is CmdStr {
  return (SYSMON_CMD_STRS as string[]).includes(cmd);
}
