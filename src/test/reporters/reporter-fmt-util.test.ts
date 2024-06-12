
import { describe, it, expect, beforeEach, UserConsoleLog, vi, Suite, Task, Vitest } from 'vitest';
import { FormatResultOpts, FormatUserConsoleLogOpts, ReporterFmtUtil } from './reporter-fmt-util';
import { Formatter } from './ezd-reporter-colors';
import { GetStateSymbolOpts } from './task-util';
import { TaskMocks, getTaskMocks } from '../task-mocks';

describe('reporter-fmt-util tests', () => {
  let projectNameMock: string;
  let filepathMock: string;
  let taskMocks: TaskMocks;
  let slowTestThresholdMock: number;

  let userConsoleLogMock: UserConsoleLog;
  let formatUserConsoleLogColors: FormatUserConsoleLogOpts['colors'];

  beforeEach(() => {
    projectNameMock = 'mock_project_name';
    filepathMock = '/path/to/mock/filepath.ts';
    slowTestThresholdMock = 100;
    taskMocks = getTaskMocks({
      projectName: projectNameMock,
      filepath: filepathMock,
    });

    userConsoleLogMock = {
      content: 'mock_content',
      type: 'stdout',
      taskId: 'mock_task_id',
      time: (new Date('9/11/2001 5:37:00 am')).valueOf(),
      size: 1
    };
    formatUserConsoleLogColors = {
      user_log: getFormatterMock(),
      user_error_log: getFormatterMock(),
      user_log_task_path: getFormatterMock(),
    };
  });

  it('tests formatUserConsoleLog()', () => {
    let formattedLog: string;
    let userConsoleLog: UserConsoleLog;
    let colorsMock: FormatUserConsoleLogOpts['colors'];
    userConsoleLog = userConsoleLogMock;
    colorsMock = formatUserConsoleLogColors;
    formattedLog = ReporterFmtUtil.formatUserConsoleLog(userConsoleLog, taskMocks.test, {
      colors: colorsMock,
    });
    expect(formattedLog).toContain(userConsoleLog.content);
    expect(formattedLog).toContain('stdout');
    expect(formattedLog).toContain(taskMocks.file.name);
    expect(formattedLog).toContain(taskMocks.suite.name);
    expect(formattedLog).toContain(taskMocks.test.name);
    expect(colorsMock.user_log).toHaveBeenCalledOnce();
    expect(colorsMock.user_error_log).toHaveBeenCalledTimes(0);
  });

  it('tests formatUserConsoleLog() when test fails', () => {
    let formattedLog: string;
    let userConsoleLog: UserConsoleLog;
    let colorsMock: FormatUserConsoleLogOpts['colors'];
    userConsoleLog = userConsoleLogMock;
    colorsMock = formatUserConsoleLogColors;
    userConsoleLog.type = 'stderr';
    formattedLog = ReporterFmtUtil.formatUserConsoleLog(userConsoleLog, taskMocks.failedTest, {
      colors: colorsMock,
    });
    expect(formattedLog).toContain(userConsoleLog.content);
    expect(formattedLog).toContain('stderr');
    expect(formattedLog).toContain(taskMocks.file.name);
    expect(formattedLog).toContain(taskMocks.suite.name);
    expect(formattedLog).toContain(taskMocks.failedTest.name);
    expect(colorsMock.user_error_log).toHaveBeenCalledOnce();
    expect(colorsMock.user_log).toHaveBeenCalledTimes(0);
  });

  it('tests formatFilePath()', () => {
    let formattedFilePath: string;
    let colorsMock: { dim: Formatter };
    colorsMock = {
      dim: getFormatterMock(),
    };
    formattedFilePath = ReporterFmtUtil.formatFilePath(filepathMock, {
      colors: colorsMock,
    });

    expect(formattedFilePath).toContain(filepathMock);
    expect(colorsMock.dim).toHaveBeenCalled();
  });

  describe('ReporterFmtUtil.formatResult() tests', () => {
    let testMock: Task;
    let getStateSymbolColors: GetStateSymbolOpts['colors'];
    let colorsMock: FormatResultOpts['colors'];
    let formatResultConfigMock: Vitest['config'];
    beforeEach(() => {
      testMock = taskMocks.test;
      getStateSymbolColors = {
        pass: getFormatterMock(),
        fail: getFormatterMock(),
        suite: getFormatterMock(),
        run: getFormatterMock(),
        skip: getFormatterMock(),
      };
      colorsMock = {
        dim: getFormatterMock(),
        dimmer: getFormatterMock(),
        italic: getFormatterMock(),
        count: getFormatterMock(),
        heapUsage: getFormatterMock(),
        duration: getFormatterMock(),
        duration_slow: getFormatterMock(),
        getStateSymbolColors,
      };
      formatResultConfigMock = {
        logHeapUsage: false,
        slowTestThreshold: slowTestThresholdMock,
      } as unknown as Vitest['config'];
    });

    it('tests formatResult() with a duration < slowTestThreshold', () => {
      let formattedResult: string;

      if(testMock.result === undefined) {
        throw new Error('testMock.result is undefined');
      }
      testMock.result.duration = slowTestThresholdMock / 2;
      formattedResult = ReporterFmtUtil.formatResult(testMock, {
        config: formatResultConfigMock,
        colors: colorsMock,
      });

      expect(formattedResult).toContain(testMock.name);

      expect(colorsMock.duration).toHaveBeenCalledTimes(0);
      expect(colorsMock.getStateSymbolColors.pass).toHaveBeenCalledOnce();
    });

    it('tests formatResult() with a duration > slowTestThreshold', () => {
      let formattedResult: string;
      if(testMock.result === undefined) {
        throw new Error('testMock.result is undefined');
      }
      testMock.result.duration = slowTestThresholdMock * 1.5;
      formattedResult = ReporterFmtUtil.formatResult(testMock, {
        config: formatResultConfigMock,
        colors: colorsMock,
      });

      expect(formattedResult).toContain(testMock.name);
      expect(formattedResult).toContain(testMock.result?.duration);

      expect(colorsMock.duration_slow).toHaveBeenCalledOnce();
      expect(colorsMock.getStateSymbolColors.pass).toHaveBeenCalledOnce();
    });

    it('tests formatResult() with logHeapUsage = true', () => {
      let formattedResult: string;
      let heapMb: number;
      formatResultConfigMock.logHeapUsage = true;
      if(testMock.result === undefined) {
        throw new Error('testMock.result is undefined');
      }
      heapMb = 2;
      testMock.result.heap = heapMb * 1024 * 1024;
      formattedResult = ReporterFmtUtil.formatResult(testMock, {
        config: formatResultConfigMock,
        colors: colorsMock,
      });

      expect(formattedResult).toContain(testMock.name);
      expect(formattedResult).toContain(heapMb);

      expect(colorsMock.heapUsage).toHaveBeenCalledOnce();
    });

    it('tests formatResult() with showAllDurations = true', () => {
      let formattedResult: string;
      if(testMock.result === undefined) {
        throw new Error('testMock.result is undefined');
      }
      testMock.result.duration = slowTestThresholdMock / 2;
      formattedResult = ReporterFmtUtil.formatResult(testMock, {
        showAllDurations: true,
        config: formatResultConfigMock,
        colors: colorsMock,
      });

      expect(formattedResult).toContain(testMock.result.duration);
      expect(colorsMock.duration).toHaveBeenCalledOnce();
    });

    it('tests formatResult() with a suite', () => {
      let formattedResult: string;
      let suiteMock: Suite;
      suiteMock = taskMocks.suite;
      formattedResult = ReporterFmtUtil.formatResult(suiteMock, {
        config: formatResultConfigMock,
        colors: colorsMock,
      });

      expect(formattedResult).toContain(suiteMock.name);
      expect(formattedResult).toContain(suiteMock.tasks.length);

      expect(colorsMock.dim).toHaveBeenCalledTimes(2);
    });
  });
});

function getFormatterMock() {
  return vi.fn().mockImplementation((val: string) => val);
}
