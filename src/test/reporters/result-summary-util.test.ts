
import { describe, it, expect, beforeEach, File, Suite, Test, Task, Vitest, vi, Mock } from 'vitest';
import { FormatResultSummaryOpts, GetResultSummaryOpts, ResultSummary, ResultSummaryUtil } from './result-summary-util';

describe('result-summary-util tests', () => {
  let projectNameMock: string;
  let filepathMock: string;
  let projectMock: {
    vitenode: {
      getTotalDuration: Mock;
    };
  };
  let fileMock: File;

  let collectDurationMock: number;
  let setupDurationMock: number;
  let environmentLoadMock: number;
  let prepareDurationMock: number;

  let resultDurationMock: number;

  let durationMock: number;
  let execTimeMsMock: number;
  let threadTimeMock: number;
  let resultSummaryMock: ResultSummary;
  beforeEach(() => {
    let taskMocks: TaskMocks;
    projectMock = {
      vitenode: {
        getTotalDuration: vi.fn()
      }
    };
    projectNameMock = 'mock_project_name';
    filepathMock = 'mock/file/path';
    resultDurationMock = 20;
    collectDurationMock = 1;
    setupDurationMock = 2;
    environmentLoadMock = 3;
    prepareDurationMock = 4;

    taskMocks = getTaskMocks({
      projectName: projectNameMock,
      resultDuration: resultDurationMock,
      collectDuration: collectDurationMock,
      setupDuration: setupDurationMock,
      environmentLoad: environmentLoadMock,
      prepareDuration: prepareDurationMock,
      filepath: filepathMock,
    });
    fileMock = taskMocks.file;

    durationMock = 1.234;
    execTimeMsMock = 11;
    threadTimeMock = collectDurationMock + resultDurationMock + setupDurationMock;
    resultSummaryMock = getResultSummaryMock({
      collectTime: collectDurationMock,
      setupTime: setupDurationMock,
      testsTime: resultDurationMock,
      envTime: environmentLoadMock,
      transformTime: durationMock,
      prepareTime: prepareDurationMock,
      threadTime: threadTimeMock,
    });
  });

  it('tests ResultSummaryUtil.getResultSummary()', () => {
    let resultSummary: ResultSummary;
    let mockColors = {
      dim: vi.fn(),
      failed_tasks: vi.fn(),
      fail: vi.fn(),
      pass: vi.fn(),
      skipped_tasks: vi.fn(),
      todo_tasks: vi.fn(),
      task_result_count: vi.fn(),
    };

    projectMock.vitenode.getTotalDuration.mockReturnValueOnce(durationMock);
    resultSummary = ResultSummaryUtil.getResultSummary([ fileMock ], {
      projects: [ projectMock as unknown as Vitest['projects'][number] ],
      execTimeMs: execTimeMsMock,
      colors: mockColors as unknown as GetResultSummaryOpts['colors'],
    });
    expect(resultSummary).toEqual(resultSummaryMock);
  });
  it('tests ResultSummaryUtil.formatResultSUmmary()', () => {
    let formattedResultSummary: string[];
    let expectedSummaryStrs: string[];
    const getFormatterMock = () => vi.fn().mockImplementation((val: string) => val);
    let mockColors = {
      dim: getFormatterMock(),
      duration_label: getFormatterMock(),
      failed_tasks: getFormatterMock(),
      fail: getFormatterMock(),
      pass: getFormatterMock(),
      skipped_tasks: getFormatterMock(),
      todo_tasks: getFormatterMock(),
      task_result_count: getFormatterMock(),
    };
    expectedSummaryStrs = [
      ' Test Files  1 passed (1)',
      '      Tests  1 failed |  1 passed (2)',
      '   Start at  17:00:00',
      '   Duration 2ms (transform: 1ms, setup: 2ms, collect: 1ms, tests: 20ms, environment: 3ms, prepare: 4ms)'
    ];
    formattedResultSummary = ResultSummaryUtil.formatResultSummary(resultSummaryMock, {
      isWatcherRerun: false,
      startTimeMs: 0,
      execTimeMs: 2,
      colors: mockColors as unknown as FormatResultSummaryOpts['colors'],
    });

    expect(mockColors.dim).toHaveBeenCalled();
    expect(mockColors.duration_label).toHaveBeenCalled();
    expect(mockColors.failed_tasks).toHaveBeenCalled();
    // expect(mockColors.fail).toHaveBeenCalled();
    expect(mockColors.pass).toHaveBeenCalled();
    // expect(mockColors.skipped_tasks).toHaveBeenCalled();
    // expect(mockColors.todo_tasks).toHaveBeenCalled();
    expect(mockColors.task_result_count).toHaveBeenCalled();
    expect(formattedResultSummary).toEqual(expectedSummaryStrs);
  });
});

type TaskMocks = {
  file: File;
  suite: Suite;
  test: Task;
  failTest: Task;
}

function getTaskMocks(opts: {
  projectName: string;
  resultDuration: number;
  collectDuration: number;
  setupDuration: number;
  environmentLoad: number;
  prepareDuration: number;
  filepath: string;
}): TaskMocks {
  let taskMocks: TaskMocks;
  let fileMock: File;
  let suiteMock: Suite;
  let testMock: Task;
  let failTestMock: Task;
  fileMock = {
    type: 'suite',
    id: 'mock_file_id',
    filepath: '/path/to/file/mock_file',
    projectName: opts.projectName,
    name: 'mock_file',
    tasks: [],
    mode: 'run',
    result: {
      state: 'pass',
      duration: opts.resultDuration
    },
    meta: {},
  };
  Object.assign(fileMock, {
    collectDuration: opts.collectDuration,
    setupDuration: opts.setupDuration,
    environmentLoad: opts.environmentLoad,
    prepareDuration: opts.prepareDuration,
  });
  suiteMock = {
    type: 'suite',
    id: 'mock_suite_id',
    file: fileMock,
    filepath: opts.filepath,
    projectName: opts.projectName,
    name: 'suite_mock_name',
    tasks: [],
    mode: 'run',
    result: {
      state: 'pass',
      duration: 5,
    },
    meta: {},
  };
  fileMock.tasks.push(suiteMock);
  testMock = {
    type: 'test',
    id: 'mock_test_id',
    context: undefined as unknown as Test['context'],
    suite: suiteMock,
    file: fileMock,
    name: 'mock_test',
    mode: 'run',
    result: {
      state: 'pass',
    },
    meta: {},
  };
  failTestMock = {
    type: 'test',
    id: 'mock_failed_test_id',
    context: undefined as unknown as Test['context'],
    suite: suiteMock,
    file: fileMock,
    name: 'mock_test',
    mode: 'run',
    result: {
      state: 'fail',
    },
    meta: {},
  };
  suiteMock.tasks.push(testMock);
  suiteMock.tasks.push(failTestMock);
  taskMocks = {
    file: fileMock,
    suite: suiteMock,
    test: testMock,
    failTest: failTestMock,
  };
  return taskMocks;
}

function getResultSummaryMock(opts: {
  collectTime: number;
  setupTime: number;
  testsTime: number;
  envTime: number;
  transformTime: number;
  prepareTime: number;
  threadTime: number;
}) {
  let resultSummaryMock: ResultSummary;
  resultSummaryMock = {
    testFilesResults: {
      taskCount: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      todo: 0,
      collectTime: opts.collectTime,
      setupTime: opts.setupTime,
      testsTime: opts.testsTime,
      envTime: opts.envTime,
      prepareTime: 4,
      threadTime: 23
    },
    testsResults: {
      taskCount: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      todo: 0,
      collectTime: 0,
      setupTime: 0,
      testsTime: 0,
      envTime: 0,
      prepareTime: 0,
      threadTime: 0
    },
    timers: {
      transformTime: opts.transformTime,
      setupTime: opts.setupTime,
      collectTime: opts.collectTime,
      testsTime: opts.testsTime,
      envTime: opts.envTime,
      prepareTime: opts.prepareTime,
      threadTime: opts.threadTime,
    }
  };
  return resultSummaryMock;
}
