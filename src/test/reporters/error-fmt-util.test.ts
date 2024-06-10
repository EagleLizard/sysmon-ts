
import path from 'path';

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ErrorFmtUtil, FormatErrorCodeFrameOpts } from './error-fmt-util';

const ROOT_PATH_MOCK = path.resolve(__dirname, '..');
const STACK_TRACE_MOCK_FILE_PATH = `${ROOT_PATH_MOCK}/stack-trace-test.ts`;
const NEAREST_TRACE_FRAME = `${STACK_TRACE_MOCK_FILE_PATH}:6:3`;

const STACK_TRACE_MOCK = [
  `  ${STACK_TRACE_MOCK_FILE_PATH}:14`,
  '  throw new Error(\'Stack Trace Test\');',
  '        ^',
  'Error: Stack Trace Test',
  `    at throwsAnError (${STACK_TRACE_MOCK_FILE_PATH}:14:9)`,
  `    at stackTraceTestMain (${STACK_TRACE_MOCK_FILE_PATH}:10:3)`,
  `    at ${NEAREST_TRACE_FRAME}`,
  `    at Object.<anonymous> (${STACK_TRACE_MOCK_FILE_PATH}:7:3)`,
  '    at Module._compile (node:internal/modules/cjs/loader:1376:14)',
  '    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1435:10)',
  '    at Module.load (node:internal/modules/cjs/loader:1207:32)',
  '    at Function.Module._load (node:internal/modules/cjs/loader:1023:12)',
  '    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:135:12)',
  '    at node:internal/main/run_main_module:28:49',
].join('\n');

describe('error-fmt-util tests', () => {
  let colorsMock: {
    fail: Mock;
    dim: Mock;
    syntax: {
      string: Mock;
      function: Mock;
      literal: Mock;
      number: Mock;
      keyword: Mock;
      built_in: Mock;
    };
  };
  beforeEach(() => {
    colorsMock = {
      fail: getFormatterMock(),
      dim: getFormatterMock(),
      syntax: {
        string: getFormatterMock(),
        function: getFormatterMock(),
        literal: getFormatterMock(),
        number: getFormatterMock(),
        keyword: getFormatterMock(),
        built_in: getFormatterMock(),
      }
    };
  });

  it('tests getNearestStackTrace()', () => {
    let nearestTrace: string;
    nearestTrace = ErrorFmtUtil.getNearestStackTrace(STACK_TRACE_MOCK);
    expect(nearestTrace).toBe(NEAREST_TRACE_FRAME);
  });

  it('tests formatErrorCodeFrame()', async () => {
    let formattedCodeFrame: string;
    let expectedFormattedCodeFrame: string;
    expectedFormattedCodeFrame = [
      '     4| ',
      '     5| (() => {',
      '     6|   stackTraceTestMain();',
      '      |   ^',
      '     7| })();',
      '     8| ',
    ].join('\n');
    formattedCodeFrame = await ErrorFmtUtil.formatErrorCodeFrame(NEAREST_TRACE_FRAME, {
      rootPath: ROOT_PATH_MOCK,
      colors: colorsMock as unknown as FormatErrorCodeFrameOpts['colors'],
    });
    expect(formattedCodeFrame).toBe(expectedFormattedCodeFrame);
    expect(colorsMock.fail).toHaveBeenCalledTimes(1);
    expect(colorsMock.syntax.function).toHaveBeenCalledTimes(1);
  });
});

function getFormatterMock() {
  return vi.fn().mockImplementation((val: string) => val);
}
