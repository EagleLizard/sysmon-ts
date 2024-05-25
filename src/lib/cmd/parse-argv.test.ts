
import { describe, it, expect, beforeEach } from 'vitest';
import { ParsedArgv2, parseArgv2 } from './parse-argv';

describe('parse-argv tests', () => {
  let argvMock: string[];

  beforeEach(() => {
    argvMock = [
      'node',
      'main.js',
    ];
  });

  it('tests parseArgv() parses command', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    cmd = 'test';
    argvMock = [
      ...argvMock,
      cmd,
    ];
    parsedArgv = parseArgv2(argvMock);
    expect(parsedArgv.cmd).toBe(cmd);
  });

  it('tests parseArgv() parses command with arg', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let cmdArg: string;
    cmd = 'test';
    cmdArg = './file1';
    argvMock = [
      ...argvMock,
      cmd, cmdArg,
    ];
    parsedArgv = parseArgv2(argvMock);
    expect(parsedArgv.args).toEqual([ cmdArg ]);
  });

  it('tests parseArgv() parses correct command with a boolean flag', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let flag: string;
    cmd = 'test';
    flag = '-b';
    argvMock = [
      ...argvMock,
      cmd,
      flag,
    ];
    parsedArgv = parseArgv2(argvMock);
    expect(parsedArgv.opts[0]).toBeDefined;
    expect(parsedArgv.opts[0][1]).toEqual([]);
  });

  it('tests parseArgv() parses correct command with a long boolean flag', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let flag: string;
    cmd = 'test';
    flag = '--boolean';
    argvMock = [
      ...argvMock,
      cmd,
      flag,
    ];
    parsedArgv = parseArgv2(argvMock);
    expect(parsedArgv.opts[0]).toBeDefined;
    expect(parsedArgv.opts[0][1]).toEqual([]);
  });

  it('tests parseArgv() parses correct command with a flag that has an arg', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let flag: string;
    let flagArg: string;
    cmd = 'test';
    flag = '-n';
    flagArg = '1';
    argvMock = [
      ...argvMock,
      cmd,
      flag, flagArg,
    ];
    parsedArgv = parseArgv2(argvMock);
    expect(parsedArgv.opts[0]).toBeDefined;
    expect(parsedArgv.opts[0][1]).toEqual([ flagArg ]);
  });

  it('tests parseArgv() parses correct command with a long flag that has an arg', () => {
    let parsedArgv: ParsedArgv2;
    let cmd: string;
    let flag: string;
    let flagArg: string;
    cmd = 'test';
    flag = '--number';
    flagArg = '1';
    argvMock = [
      ...argvMock,
      cmd,
      flag, flagArg,
    ];
    parsedArgv = parseArgv2(argvMock);
    expect(parsedArgv.opts[0]).toBeDefined;
    expect(parsedArgv.opts[0][1]).toEqual([ flagArg ]);
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
    argvMock = [
      ...argvMock,
      cmd, ...cmdArgs,
    ];
    for(let i = 0; i < flags.length; ++i) {
      let flagTuple = flags[i];
      argvMock.push(flagTuple[0]);
      for(let k = 0; k < flagTuple[1].length; ++k) {
        let arg = flagTuple[1][k];
        argvMock.push(arg);
      }
    }
    parsedArgv = parseArgv2(argvMock);
    expect(parsedArgv.cmd).toBe(cmd);
    expect(parsedArgv.args).toEqual(cmdArgs);
    expect(parsedArgv.opts).toEqual(flags);
  });

  // #region !!! ERROR PATHS !!!!
  it('tests parseArgv() throws when no args', () => {
    expect(() => parseArgv2(argvMock)).toThrowError('cmd is undefined');
  });
  it('tests parseArgv() throws when command string is invalid', () => {
    let invalidCmd: string;
    invalidCmd = '-test';
    argvMock = [
      ...argvMock,
      invalidCmd,
    ];

    expect(() => parseArgv2(argvMock)).toThrowError('Unexpected Token: command not set. Expected CMD');
  });
  // #endregion
});
