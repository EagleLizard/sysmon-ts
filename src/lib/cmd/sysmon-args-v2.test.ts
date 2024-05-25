
import { describe, it, expect, beforeEach } from 'vitest';
import { ParsedArgv2, parseArgv2 } from './sysmon-args-v2';

describe('sysmon-args-v2 tests', () => {
  let testArgv: string[];

  beforeEach(() => {
    testArgv = [
      'node',
      'main.js',
    ];
  });

  it('tests parseArgv() parses command', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    cmd = 'test';
    testArgv = [
      ...testArgv,
      cmd,
    ];
    parsedArgv = parseArgv2(testArgv);
    expect(parsedArgv.cmd).toBe(cmd);
  });

  it('tests parseArgv() parses command with arg', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let cmdArg: string;
    cmd = 'test';
    cmdArg = './file1';
    testArgv = [
      ...testArgv,
      cmd, cmdArg,
    ];
    parsedArgv = parseArgv2(testArgv);
    expect(parsedArgv.args).toEqual([ cmdArg ]);
  });

  it('tests parseArgv() parses correct command with a boolean flag', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let flag: string;
    cmd = 'test';
    flag = '-b';
    testArgv = [
      ...testArgv,
      cmd,
      flag,
    ];
    parsedArgv = parseArgv2(testArgv);
    expect(parsedArgv.opts.has(flag)).toBe(true);
    expect(parsedArgv.opts.get(flag)).toEqual([]);
  });

  it('tests parseArgv() parses correct command with a flag that has an arg', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let flag: string;
    let flagArg: string;
    cmd = 'test';
    flag = '-b';
    flagArg = '1';
    testArgv = [
      ...testArgv,
      cmd,
      flag, flagArg,
    ];
    parsedArgv = parseArgv2(testArgv);
    expect(parsedArgv.opts.has(flag)).toBe(true);
    expect(parsedArgv.opts.get(flag)).toEqual([ flagArg ]);
  });

  it('tests parseArgv() with multiple command args and flag args', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let cmdArgs: string[];
    let flags: [string, string[]][];
    cmd = 'test';
    cmdArgs = [
      './file1', './file2',
    ];
    flags = [
      [ '-a', [ '1', '2' ]],
      [ '-b', []],
      [ '-c', [ '3' ]],
      [ '-d', []]
    ];
    testArgv = [
      ...testArgv,
      cmd, ...cmdArgs,
    ];
    for(let i = 0; i < flags.length; ++i) {
      let flagTuple = flags[i];
      testArgv.push(flagTuple[0]);
      for(let k = 0; k < flagTuple[1].length; ++k) {
        let arg = flagTuple[1][k];
        testArgv.push(arg);
      }
    }
    parsedArgv = parseArgv2(testArgv);
    expect(parsedArgv.cmd).toBe(cmd);
    expect(parsedArgv.args).toEqual(cmdArgs);
    expect([ ...parsedArgv.opts.entries() ]).toEqual(flags);
  });

  // #region !!! ERROR PATHS !!!!
  it('tests parseArgv() throws when no args', () => {
    expect(() => parseArgv2(testArgv)).toThrowError('cmd is undefined');
  });
  it('tests parseArgv() throws when command string is invalid', () => {
    let invalidCmd: string;
    invalidCmd = '-test';
    testArgv = [
      ...testArgv,
      invalidCmd,
    ]
    expect(() => parseArgv2(testArgv)).toThrowError(`invalid cmd: '${invalidCmd}'`);
  });
  // #endregion
});
