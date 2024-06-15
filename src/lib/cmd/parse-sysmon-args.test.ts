
import { describe, it, expect, beforeEach } from 'vitest';
import { SYSMON_CMD_ENUM, getCmdKind } from './parse-sysmon-args';

const CMD_STR_MAP = {
  'ping': SYSMON_CMD_ENUM.PING,
  'p': SYSMON_CMD_ENUM.PING,
  'scan-dir': SYSMON_CMD_ENUM.SCAN_DIR,
  'sd': SYSMON_CMD_ENUM.SCAN_DIR,
  'monitor': SYSMON_CMD_ENUM.MONITOR,
  'm': SYSMON_CMD_ENUM.MONITOR,
  'ping-stat': SYSMON_CMD_ENUM.PING_STAT,
  'ps': SYSMON_CMD_ENUM.PING_STAT,
  'admin': SYSMON_CMD_ENUM.ADMIN,
  'a': SYSMON_CMD_ENUM.ADMIN,
  'speedtest': SYSMON_CMD_ENUM.SPEEDTEST,
  'sp': SYSMON_CMD_ENUM.SPEEDTEST,
  't9': SYSMON_CMD_ENUM.T_NINE,
  'encode': SYSMON_CMD_ENUM.ENCODE,
  'e': SYSMON_CMD_ENUM.ENCODE,
  'nlp': SYSMON_CMD_ENUM.NLP,
};

describe('parse-sysmon-args tests', () => {
  let commandMap: Record<string, SYSMON_CMD_ENUM>;
  beforeEach(() => {
    commandMap = _clone(CMD_STR_MAP);
  });
  it('tests getCmdKind()', () => {
    let expectedEnumVals: SYSMON_CMD_ENUM[];
    let cmdKinds: Set<SYSMON_CMD_ENUM>;
    let cmdMapEntries: [string, SYSMON_CMD_ENUM][];
    expectedEnumVals = [ ...Object.values(SYSMON_CMD_ENUM) ];
    cmdKinds = new Set();
    cmdMapEntries = [ ...Object.entries(commandMap) ];
    for(let i = 0; i < cmdMapEntries.length; ++i) {
      let cmdStr: string;
      let cmdEnumVal: string;
      let currKind: SYSMON_CMD_ENUM;
      [ cmdStr, cmdEnumVal ] = cmdMapEntries[i];
      currKind = getCmdKind(cmdStr);
      expect(currKind).toEqual(cmdEnumVal);
      cmdKinds.add(currKind);
    }
    expect([ ...cmdKinds ]).toEqual(expectedEnumVals);
  });

  it('tests getCmdKind() with an invalid command string', () => {
    let invalidCmd: string;
    invalidCmd = '$$$';
    expect(() => getCmdKind(invalidCmd)).toThrowError(invalidCmd);
  });
});

function _clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}
