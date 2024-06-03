
import { File, Task, Vitest } from 'vitest';
import { TaskResultsOutput, TaskUtil } from './task-util';
import { getIntuitiveTime } from '../../lib/util/format-util';
import { Formatter } from './ezd-reporter-colors';

export type ResultSummary = {
  testFilesResultStr: string;
  testsResultStr: string;
  timersStr: string;
  execTimeStr: string;
}

export type GetResultSummaryOpts = {
  projects: Vitest['projects'];
  execTimeMs: number;
  colors: {
    dim: Formatter;
    failed_tasks: Formatter;
    fail: Formatter;
    pass: Formatter;
    skipped_tasks: Formatter;
    todo_tasks: Formatter;
    task_result_count: Formatter;
  };
};

export class ResultSummaryUtil {
  static getResultSummary(files: File[], opts: GetResultSummaryOpts): ResultSummary {
    let transformTimeMs: number;
    let testFileResults: TaskResultsOutput;
    let testFilesResultStr: string;

    let tests: Task[];
    let testResults: TaskResultsOutput;
    let testsResultStr: string;

    let execTimeStr: string;
    let timersStr: string;

    let resultSummary: ResultSummary;
    transformTimeMs = 0;
    for(let i = 0; i < opts.projects.length; ++i) {
    /*
        TODO: vitest PR to remove unecessary flatMap call: https://github.com/vitest-dev/vitest/blob/b84f1721df66aad9685645084b33e8313a5cffd7/packages/vitest/src/node/reporters/base.ts#L240
      */
      let projectDuration = opts.projects[i].vitenode.getTotalDuration();
      transformTimeMs += projectDuration;
    }
    testFileResults = TaskUtil.getTaskResults(files);
    testFilesResultStr = formatTaskResults(testFileResults, {
      colors: opts.colors,
    });
    tests = TaskUtil.getTests(files);
    testResults = TaskUtil.getTaskResults(tests);
    testsResultStr = formatTaskResults(testResults, {
      colors: opts.colors,
    });

    const timeFmt = (ms: number): string => {
      let timeVal: number;
      let timeUnit: string;
      let timeStr: string;
      [ timeVal, timeUnit ] = getIntuitiveTime(ms);
      timeStr = (ms > 1000)
        ? `${timeVal.toFixed(2)}`
        : `${Math.round(timeVal)}`
      ;
      return `${timeStr}${timeUnit}`;
    };

    execTimeStr = timeFmt(opts.execTimeMs);
    timersStr = [
      `transform: ${timeFmt(transformTimeMs)}`,
      `setup: ${timeFmt(testFileResults.setupTime)}`,
      `collect: ${timeFmt(testFileResults.collectTime)}`,
      `tests: ${timeFmt(testFileResults.testsTime)}`,
      `environment: ${timeFmt(testFileResults.envTime)}`,
      `prepare: ${timeFmt(testFileResults.prepareTime)}`,
    ].join(', ');
    resultSummary = {
      testFilesResultStr,
      testsResultStr,
      timersStr,
      execTimeStr,
    };
    return resultSummary;
  }
}

type FormatTaskResultsOpts = {
  colors: GetResultSummaryOpts['colors'];
  name?: string;
  showTotal?: boolean;
}

function formatTaskResults(taskResults: TaskResultsOutput, opts: FormatTaskResultsOpts): string {
  let testResultsStrs: string[];
  let testResultsStr: string;
  let name: string;
  let showTotal: boolean;

  name = opts.name ?? 'tests';
  showTotal = opts.showTotal ?? true;

  const colorCfg = opts.colors;

  if(taskResults.taskCount === 0) {
    return colorCfg.dim(`no ${name}`);
  }
  testResultsStrs = [];
  if(taskResults.failed > 0) {
    testResultsStrs.push(colorCfg.failed_tasks(` ${taskResults.failed} failed`));
  }
  if(taskResults.passed > 0) {
    testResultsStrs.push(colorCfg.pass(` ${taskResults.passed} passed`));
  }
  if(taskResults.skipped > 0) {
    testResultsStrs.push(colorCfg.skipped_tasks(` ${taskResults.skipped} skipped`));
  }
  if(taskResults.todo > 0) {
    testResultsStrs.push(colorCfg.todo_tasks(` ${taskResults.todo} todo`));
  }
  testResultsStr = testResultsStrs.join(colorCfg.dim(' | '));
  if(showTotal) {
    testResultsStr += ` ${colorCfg.task_result_count(`(${taskResults.taskCount})`)}`;
  }
  return `${testResultsStr}`;
}
