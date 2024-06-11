
import { describe, it, expect, beforeEach, vi, File, Suite, Task, Test, ErrorWithDiff, Mock } from 'vitest';
import { ErrorSummaryUtil, ErrorsSummary, FormatErrorsOpts, GetErrorBannerOpts } from './error-summary-util';

const errorFmtUtilMocks = vi.hoisted(() => {
  return {
    formatErrorCodeFrame: vi.fn(),
    getNearestStackTrace: vi.fn(),
  };
});

vi.mock('./error-fmt-util', () => {
  return {
    ErrorFmtUtil: {
      formatErrorCodeFrame: errorFmtUtilMocks.formatErrorCodeFrame,
      getNearestStackTrace: errorFmtUtilMocks.getNearestStackTrace,
    },
  };
});

describe('error-summary-util tests', () => {
  let rootPathMock: string;
  let projectNameMock: string;
  let taskMocks: TaskMocks;
  beforeEach(() => {
    rootPathMock = '/path/to/file';
    projectNameMock = 'mock_project';
    taskMocks = getTaskMocks({
      rootPath: rootPathMock,
      projectName: projectNameMock,
    });

    errorFmtUtilMocks.formatErrorCodeFrame.mockReset();
    errorFmtUtilMocks.getNearestStackTrace.mockReset();
  });

  it('tests getErrorBanner()', () => {
    let label: string;
    let errorCount: number;
    let banner: string;
    let cols: number;

    let colorsMock = {
      line: getFormatterMock(),
      label: getFormatterMock(),
    };
    label = 'Mock';
    errorCount = 11;
    cols = 30;
    banner = ErrorSummaryUtil.getErrorBanner(label, errorCount, {
      cols,
      colors: colorsMock as unknown as GetErrorBannerOpts['colors'],
    });
    expect(banner).toHaveLength(cols);
    expect(banner).toContain(label);
    expect(banner).toContain(errorCount);
    expect(colorsMock.line).toHaveBeenCalled();
    expect(colorsMock.label).toHaveBeenCalled();
  });

  it('tests getErrorsSummary()', () => {
    let errorSummary: ErrorsSummary;
    let testErrorCount: number;
    errorSummary = ErrorSummaryUtil.getErrorsSummary([ taskMocks.file ], []);
    testErrorCount = 0;
    for(let i = 0; i < taskMocks.tests.length; ++i) {
      testErrorCount += taskMocks.tests[i].result?.errors?.length ?? 0;
    }
    expect(errorSummary.suites).toContain(taskMocks.suite);
    expect(errorSummary.tests).toContain(taskMocks.tests[0]);
    expect(errorSummary.tests).toContain(taskMocks.tests[1]);
    expect(errorSummary.suitesCount).toBe(taskMocks.suite.result?.errors?.length);
    expect(errorSummary.testsCount).toBe(testErrorCount);
  });

  it('tests getErrorResult()', async () => {
    let errorResult: string[];
    let errorResultStr: string;
    let getErrorDividerMock: Mock;
    let errorMock: ErrorWithDiff;
    let dividerStrMock: string;

    let codeFrameStrMock: string;
    let traceFileNameMock: string;
    let tracePathMock: string;
    let traceLineMock: string;
    let traceColMock: string;
    let nearestTraceMock: string;

    let colorsMock = {
      dim: getFormatterMock(),
      fail: getFormatterMock(),
      fail_label: getFormatterMock(),
      pass: getFormatterMock(),
      error_name: getFormatterMock(),
      failed_tasks_label: getFormatterMock(),
      trace: getFormatterMock(),
      error_pos: getFormatterMock(),
    };
    let formatCodeFrameColorsMock = {
      fail: getFormatterMock(),
      dim: getFormatterMock(),
      syntax: {
        string: getFormatterMock(),
        function: getFormatterMock(),
        literal: getFormatterMock(),
        number: getFormatterMock(),
        keyword: getFormatterMock(),
        built_in: getFormatterMock(),
      },
    };
    errorMock = taskMocks.errors[0];
    dividerStrMock = '_mock-divider_';
    codeFrameStrMock = 'mock code frame';
    traceFileNameMock = 'file-path-mock.ts';
    tracePathMock = `${rootPathMock}/${traceFileNameMock}`;
    traceLineMock = '10';
    traceColMock = '13';
    nearestTraceMock = [
      tracePathMock,
      traceLineMock,
      traceColMock,
    ].join(':');
    getErrorDividerMock = vi.fn().mockImplementation(() => dividerStrMock);

    errorFmtUtilMocks.formatErrorCodeFrame.mockResolvedValueOnce(codeFrameStrMock);
    errorFmtUtilMocks.getNearestStackTrace.mockReturnValueOnce(nearestTraceMock);

    errorResult = await ErrorSummaryUtil.getErrorResult(errorMock, taskMocks.tests, {
      rootPath: rootPathMock,
      getErrorDivider: getErrorDividerMock as unknown as FormatErrorsOpts['getErrorDivider'],
      colors: colorsMock as unknown as FormatErrorsOpts['colors'],
      formatCodeFrameColors: formatCodeFrameColorsMock as unknown as FormatErrorsOpts['formatCodeFrameColors'],
    });
    errorResultStr = errorResult.join('\n');

    expect(errorResultStr).toContain(errorMock.name);
    expect(errorResultStr).toContain(errorMock.message);
    expect(errorResultStr).toContain(traceFileNameMock);
    expect(errorResultStr).toContain(traceLineMock);
    expect(errorResultStr).toContain(traceColMock);
    expect(errorResultStr).toContain(dividerStrMock);
    expect(errorResultStr).toContain(errorMock.expected ?? NaN);
    expect(errorResultStr).toContain(errorMock.actual ?? NaN);
  });
});

function getFormatterMock() {
  return vi.fn().mockImplementation((val: string) => val);
}

type TaskMocks = {
  file: File;
  suite: Suite;
  tests: Task[];
  errors: ErrorWithDiff[];
};

function getTaskMocks(opts: {
  projectName: string;
  rootPath: string;
}): TaskMocks {
  let errorsMock: ErrorWithDiff[];
  let fileMock: File;
  let suiteMock: Suite;
  let testMock1: Task;
  let testMock2: Task;
  let taskMocks: TaskMocks;
  let testMocks: Task[];

  let errorMock1: ErrorWithDiff;
  let errorMock2: ErrorWithDiff;

  errorMock1 = {
    name: 'MockError1',
    message: 'mock error message 1',
    stack: 'mock stack',
    diff: 'mock_diff',
    expected: 'mock_expected',
    actual: 'mock_actual',
  };
  errorMock2 = {
    name: 'MockError1',
    message: 'mock error message 1',
  };
  errorsMock = [
    errorMock1,
    errorMock2,
  ];

  fileMock = {
    type: 'suite',
    id: 'mock_file_id',
    filepath: `${opts.rootPath}/mock_file`,
    projectName: opts.projectName,
    name: 'mock_file',
    tasks: [],
    mode: 'run',
    meta: {},
  };
  suiteMock = {
    type: 'suite',
    id: 'mock_suite_id',
    file: fileMock,
    projectName: opts.projectName,
    name: 'suite_mock_name',
    tasks: [],
    mode: 'run',
    result: {
      errors: [
        errorsMock[0],
      ],
      state: 'fail',
    },
    meta: {},
  };
  fileMock.tasks.push(suiteMock);
  testMock1 = {
    type: 'test',
    id: 'mock_test_id_1',
    context: undefined as unknown as Test['context'],
    suite: suiteMock,
    file: fileMock,
    name: 'mock_test_1',
    mode: 'run',
    result: {
      errors: [
        errorsMock[0],
      ],
      state: 'fail',
    },
    meta: {},
  };
  testMock2 = {
    type: 'test',
    id: 'mock_test_id_2',
    context: undefined as unknown as Test['context'],
    suite: suiteMock,
    file: fileMock,
    name: 'mock_test_2',
    mode: 'run',
    result: {
      errors: [
        errorsMock[1],
      ],
      state: 'fail',
    },
    meta: {},
  };
  suiteMock.tasks.push(testMock1);
  suiteMock.tasks.push(testMock2);
  testMocks = [
    testMock1,
    testMock2,
  ];
  taskMocks = {
    file: fileMock,
    suite: suiteMock,
    tests: testMocks,
    errors: errorsMock,
  };
  return taskMocks;
}
