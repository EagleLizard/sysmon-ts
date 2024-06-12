
import { describe, it, expect, beforeEach, Task, vi, Vitest } from 'vitest';
import { TaskFmtUtil } from './task-fmt-util';
import { TaskMocks, getTaskMocks } from '../task-mocks';

const reporterFmtUtilMocks = vi.hoisted(() => {
  return {
    formatResult: vi.fn(),
  };
});

const taskUtilMocks = vi.hoisted(() => {
  return {
    taskComparator: vi.fn(),
    isSkippedTask: vi.fn(),
  };
});

vi.mock('./reporter-fmt-util', () => {
  return {
    ReporterFmtUtil: {
      formatResult: reporterFmtUtilMocks.formatResult,
    },
  };
});

vi.mock('./task-util', () => {
  return {
    TaskUtil: {
      taskComparator: taskUtilMocks.taskComparator,
      isSkippedTask: taskUtilMocks.isSkippedTask,
    }
  };
});

describe('task-fmt-util tests', () => {
  let projectNameMock: string;
  let filepathMock: string;
  let taskMocks: TaskMocks;
  let getResultsConfigMock: Vitest['config'];

  beforeEach(() => {
    reporterFmtUtilMocks.formatResult.mockReset();
    taskUtilMocks.taskComparator.mockReset();
    taskUtilMocks.isSkippedTask.mockReset();

    projectNameMock = 'mock_project_name';
    filepathMock = '/path/to/file/path_mock.ts';
    taskMocks = getTaskMocks({
      projectName: projectNameMock,
      filepath: filepathMock,
    });
    getResultsConfigMock = {
      hideSkippedTests: true,
    } as unknown as Vitest['config'];

    reporterFmtUtilMocks.formatResult.mockImplementation((task: Task) => task.name);
  });

  it('tests getResults()', () => {
    let results: string[];
    let resultsStr: string;
    results = TaskFmtUtil.getResults([ taskMocks.file ], {
      config: getResultsConfigMock,
    });
    resultsStr = results.join('\n');

    expect(resultsStr).toContain(taskMocks.file.name);
    expect(resultsStr).toContain(taskMocks.suite.name);
    expect(resultsStr).toContain(taskMocks.test.name);
    expect(resultsStr).toContain(taskMocks.failedTest.name);
  });

  it('tests getResults() with onlyFailed = true', () => {
    let results: string[];
    let resultsStr: string;
    results = TaskFmtUtil.getResults([ taskMocks.file ], {
      config: getResultsConfigMock,
      onlyFailed: true,
    });
    resultsStr = results.join('\n');

    expect(resultsStr).not.toContain(taskMocks.file.name);
    expect(resultsStr).not.toContain(taskMocks.suite.name);
    expect(resultsStr).not.toContain(taskMocks.test.name);
    expect(resultsStr).toContain(taskMocks.failedTest.name);
  });

  it('tests getResults() with a failed suite', () => {
    let results: string[];
    let resultsStr: string;
    if(taskMocks.suite.result === undefined) {
      throw new Error('suite.result is undefined');
    }
    taskMocks.suite.result.state = 'fail';
    results = TaskFmtUtil.getResults([ taskMocks.file ], {
      config: getResultsConfigMock,
      onlyFailed: true,
    });
    resultsStr = results.join('\n');

    expect(resultsStr).not.toContain(taskMocks.file.name);
    expect(resultsStr).toContain(taskMocks.suite.name);
    expect(resultsStr).not.toContain(taskMocks.test.name);
  });
  it('tests getResults() with hideSkippedTtests = false', () => {
    let results: string[];
    let resultsStr: string;
    if(taskMocks.suite.result === undefined) {
      throw new Error('suite.result is undefined');
    }

    getResultsConfigMock.hideSkippedTests = false;
    results = TaskFmtUtil.getResults([ taskMocks.file ], {
      config: getResultsConfigMock,
    });
    resultsStr = results.join('\n');

    expect(resultsStr).toContain(taskMocks.suite.name);
  });
});
