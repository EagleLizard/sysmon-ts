
import { describe, it, expect, beforeEach, Task, File, Suite, Test, vi, ErrorWithDiff } from 'vitest';
import { GetStateSymbolOpts, STATE_SYMBOL_MAP, TaskUtil } from './task-util';

describe('task-util tests', () => {

  let projectNameMock: string;

  let testMock: Task;
  let suiteMock: Suite;
  let fileMock: File;

  let getStateSymbolOptsMock: GetStateSymbolOpts;

  beforeEach(() => {
    getStateSymbolOptsMock = {
      colors: {
        pass: vi.fn(),
        suite: vi.fn(),
        fail: vi.fn(),
        skip: vi.fn(),
        run: vi.fn(),
      },
    } as unknown as GetStateSymbolOpts;

    projectNameMock = 'project_mock_name';
    fileMock = {
      type: 'suite',
      id: 'mock_file_id',
      filepath: '/path/to/file/mock_file',
      projectName: projectNameMock,
      name: 'mock_file',
      tasks: [],
      mode: 'run',
      meta: {},
    };
    suiteMock = {
      type: 'suite',
      id: 'mock_suite_id',
      file: fileMock,
      projectName: projectNameMock,
      name: 'suite_mock_name',
      tasks: [],
      mode: 'run',
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
      meta: {},
    };
    suiteMock.tasks.push(testMock);
  });

  it('tests getTests()', () => {
    let tests: Task[];
    tests = TaskUtil.getTests(fileMock);
    expect(tests).toEqual(suiteMock.tasks);
  });

  it('tests getTests() when called on a test', () => {
    let tests: Task[];
    tests = TaskUtil.getTests(testMock);
    expect(tests).toEqual([ testMock ]);
  });

  it('tests getSuites()', () => {
    let suites: Task[];
    suites = TaskUtil.getSuites(fileMock);
    expect(suites).toHaveLength(2);
    expect(suites[0]).toEqual(fileMock);
    expect(suites[1]).toEqual(suiteMock);
  });

  it('tests getFullName()', () => {
    let fullName: string;
    fullName = TaskUtil.getFullName(testMock);
    expect(fullName).toEqual([
      fileMock.name,
      suiteMock.name,
      testMock.name,
    ].join(' > '));
  });

  it('test getErrors()', () => {
    let testsWithErrors: Task[];
    let errors: [ErrorWithDiff | undefined, Task[]][];
    testsWithErrors = Array(2).fill(0).map(() => {
      let testWithErrors: Task;
      let err: Error;
      err = new Error('etc');
      (err as any).stackStr = err.stack;
      testWithErrors = Object.assign({}, testMock, {
        result: {
          errors: [
            err,
          ],
        },
      });
      return testWithErrors;
    });
    errors = TaskUtil.getErrors(testsWithErrors);
    expect(errors).toHaveLength(1);
  });

  it('test getErrors() where errors don\'t have same message', () => {
    let testsWithErrors: Task[];
    let errors: [ErrorWithDiff | undefined, Task[]][];
    testsWithErrors = Array(2).fill(0).map((v, idx) => {
      let testWithErrors: Task;
      let err: Error;
      err = new Error(`etc ${idx}`);
      (err as any).stackStr = err.stack;
      testWithErrors = Object.assign({}, testMock, {
        result: {
          errors: [
            err,
          ],
        },
      });
      return testWithErrors;
    });
    errors = TaskUtil.getErrors(testsWithErrors);
    expect(errors).toHaveLength(testsWithErrors.length);
  });

  it('test getErrors() with errors in suite', () => {
    let suitesWithErrors: Suite[];
    let errors: [ErrorWithDiff | undefined, Task[]][];
    suitesWithErrors = Array(10).fill(0).map(() => {
      let suiteWithErrors: Suite;
      let err: Error;
      err = new Error('mock suite error');
      (err as any).stackStr = err.stack;
      suiteWithErrors = Object.assign({}, suiteMock, {
        result: {
          errors: [
            err,
          ],
        },
      });
      return suiteWithErrors;
    });
    errors = TaskUtil.getErrors(suitesWithErrors);
    expect(errors).toHaveLength(1);
  });

  it('tests taskComparator()', () => {
    let tasksToSort: Task[];
    const getTaskToSort = (mode?: string) => Object.assign({}, testMock, {
      mode: mode ?? 'run',
    });
    tasksToSort = [
      getTaskToSort(),
      getTaskToSort('skip'),
      getTaskToSort(),
      getTaskToSort('todo'),
    ];
    tasksToSort.sort(TaskUtil.taskComparator);
    expect(tasksToSort.map(task => task.mode)).toEqual([
      'skip', 'todo', 'run', 'run'
    ]);
  });

  it('tests isSkippedTask()', () => {
    let tasksToCheck: Task[];
    const getTaskToCheck = (mode?: string) => Object.assign({}, testMock, {
      mode: mode ?? 'run',
    });
    tasksToCheck = [
      getTaskToCheck(),
      getTaskToCheck('todo'),
      getTaskToCheck('skip'),
    ];
    expect(tasksToCheck.map(task => TaskUtil.isSkippedTask(task))).toEqual([
      false, true, true,
    ]);
  });

  it('tests getStateSymbol() passed test', () => {
    TaskUtil.getStateSymbol(getGetStateSymbolTestMock('pass'), getStateSymbolOptsMock);
    expect(getStateSymbolOptsMock.colors.pass).toHaveBeenCalledOnce();
    expect(getStateSymbolOptsMock.colors.pass).toHaveBeenCalledWith(STATE_SYMBOL_MAP.pass);
  });

  it('tests getStateSymbol() failed test', () => {
    TaskUtil.getStateSymbol(getGetStateSymbolTestMock('fail'), getStateSymbolOptsMock);
    expect(getStateSymbolOptsMock.colors.fail).toHaveBeenCalledOnce();
    expect(getStateSymbolOptsMock.colors.fail).toHaveBeenCalledWith(STATE_SYMBOL_MAP.testFail);
  });

  it('tests getStateSymbol() failed suite', () => {
    TaskUtil.getStateSymbol(getGetStateSymbolTestMock('fail', 'suite'), getStateSymbolOptsMock);
    expect(getStateSymbolOptsMock.colors.suite).toHaveBeenCalledOnce();
    expect(getStateSymbolOptsMock.colors.suite).toHaveBeenCalledWith(STATE_SYMBOL_MAP.suiteFail);
  });

  it('tests getStateSymbol() skipped test', () => {
    TaskUtil.getStateSymbol(getGetStateSymbolTestMock('skip'), getStateSymbolOptsMock);
    expect(getStateSymbolOptsMock.colors.skip).toHaveBeenCalledOnce();
    expect(getStateSymbolOptsMock.colors.skip).toHaveBeenCalledWith(STATE_SYMBOL_MAP.skip);
  });

  it('tests getStateSymbol() running test', () => {
    TaskUtil.getStateSymbol(getGetStateSymbolTestMock('run'), getStateSymbolOptsMock);
    expect(getStateSymbolOptsMock.colors.run).toHaveBeenCalledOnce();
    expect(getStateSymbolOptsMock.colors.run).toHaveBeenCalledWith(STATE_SYMBOL_MAP.run);
  });

  function getGetStateSymbolTestMock(state: string, type?: string): Task {
    return Object.assign({}, testMock, {
      type,
      result: {
        state,
      }
    });
  }
});
