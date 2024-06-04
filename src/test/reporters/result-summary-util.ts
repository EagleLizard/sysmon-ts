
import { File, Task, Vitest } from 'vitest';
import { TaskResultsOutput, TaskUtil } from './task-util';
import { getIntuitiveTime } from '../../lib/util/format-util';
import { Formatter } from './ezd-reporter-colors';
import { get24HourTimeStr } from '../../lib/util/datetime-util';

export type ResultSummary = {
  testFilesResults: TaskResultsOutput;
  testsResults: TaskResultsOutput;
  timers: {
    collectTime: number;
    setupTime: number;
    testsTime: number;
    transformTime: number;
    envTime: number;
    prepareTime: number;
    // threadTime: number;
  };
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

export type FormatResultSummaryOpts = {
  isWatcherRerun: boolean;
  startTimeMs: number;
  execTimeMs: number;
  colors: {
    dim: Formatter;
    duration_label: Formatter;
    failed_tasks: Formatter;
    fail: Formatter;
    pass: Formatter;
    skipped_tasks: Formatter;
    todo_tasks: Formatter;
    task_result_count: Formatter;
  };
};

type FormatTaskResultsOpts = {
  name?: string;
  showTotal?: boolean;
  colors: {
    dim: Formatter;
    failed_tasks: Formatter;
    pass: Formatter;
    skipped_tasks: Formatter;
    todo_tasks: Formatter;
    task_result_count: Formatter;
  }
};

export class ResultSummaryUtil {

  static formatResultSummary(resultSummary: ResultSummary, opts: FormatResultSummaryOpts): string[] {
    let execTimeStr: string;
    let testFilesResultsStr: string;
    let testsResultsStr: string;
    let startAtStr: string;
    let durationStr: string;
    let timersStr: string;
    let outputLineTuples: [string, string][];
    let outputLineLabelLen: number;
    let outputLines: string[];

    outputLineTuples = [];

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

    const formatTaskResultsColors = {
      dim: opts.colors.dim,
      failed_tasks: opts.colors.failed_tasks,
      pass: opts.colors.pass,
      skipped_tasks: opts.colors.skipped_tasks,
      todo_tasks: opts.colors.todo_tasks,
      task_result_count: opts.colors.task_result_count,
    };

    execTimeStr = timeFmt(opts.execTimeMs);
    timersStr = [
      `transform: ${timeFmt(resultSummary.timers.transformTime)}`,
      `setup: ${timeFmt(resultSummary.timers.setupTime)}`,
      `collect: ${timeFmt(resultSummary.timers.collectTime)}`,
      `tests: ${timeFmt(resultSummary.timers.testsTime)}`,
      `environment: ${timeFmt(resultSummary.timers.envTime)}`,
      `prepare: ${timeFmt(resultSummary.timers.prepareTime)}`,
    ].join(', ');
    testFilesResultsStr = formatTaskResults(resultSummary.testFilesResults, {
      colors: formatTaskResultsColors,
    });
    testsResultsStr = formatTaskResults(resultSummary.testsResults, {
      colors: formatTaskResultsColors,
    });
    startAtStr = ` ${get24HourTimeStr(new Date(opts.startTimeMs))}`;
    durationStr = (opts.isWatcherRerun)
      ? execTimeStr
      : `${execTimeStr} ${opts.colors.dim(`(${timersStr})`)}`
    ;

    outputLineTuples = [
      [ 'Test Files', testFilesResultsStr ],
      [ 'Tests', testsResultsStr ],
      [ 'Start at', startAtStr ],
      [ 'Duration', durationStr ],
    ];

    outputLineLabelLen = -Infinity;
    for(let i = 0; i < outputLineTuples.length; ++i) {
      let [ title, ] = outputLineTuples[i];
      if(title.length > outputLineLabelLen) {
        outputLineLabelLen = title.length;
      }
    }
    outputLines = [];
    for(let i = 0; i < outputLineTuples.length; ++i) {
      let title: string;
      let text: string;
      let leftPad: number;
      [ title, text ] = outputLineTuples[i];
      leftPad = outputLineLabelLen - title.length;
      outputLines.push(`${' '.repeat(leftPad)} ${opts.colors.duration_label(title)} ${text}`);
    }
    return outputLines;
  }

  static getResultSummary(files: File[], opts: GetResultSummaryOpts): ResultSummary {
    let transformTimeMs: number;
    let testFilesResults: TaskResultsOutput;
    let tests: Task[];
    let testsResults: TaskResultsOutput;
    let timers: ResultSummary['timers'];

    let resultSummary: ResultSummary;
    transformTimeMs = 0;
    for(let i = 0; i < opts.projects.length; ++i) {
      /*
        TODO: vitest PR to remove unecessary flatMap call: https://github.com/vitest-dev/vitest/blob/b84f1721df66aad9685645084b33e8313a5cffd7/packages/vitest/src/node/reporters/base.ts#L240
      */
      let projectDuration = opts.projects[i].vitenode.getTotalDuration();
      transformTimeMs += projectDuration;
    }
    testFilesResults = getTaskResults(files);
    tests = TaskUtil.getTests(files);
    testsResults = getTaskResults(tests);

    timers = {
      transformTime: transformTimeMs,
      setupTime: testFilesResults.setupTime,
      collectTime: testFilesResults.collectTime,
      testsTime: testFilesResults.testsTime,
      envTime: testFilesResults.envTime,
      prepareTime: testFilesResults.prepareTime,
    };
    resultSummary = {
      testFilesResults,
      testsResults,
      timers,
    };
    return resultSummary;
  }
}

/*
    see: https://github.com/vitest-dev/vitest/blob/a820e7ac6efa89b9944094ccc1a7f11ec2afb7ac/packages/vitest/src/node/reporters/renderers/utils.ts#L98
  */
function getTaskResults(tasks: Task[]): TaskResultsOutput {
  let taskResults: TaskResultsOutput;
  taskResults = {
    taskCount: tasks.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    todo: 0,

    collectTime: 0,
    setupTime: 0,
    testsTime: 0,
    // transformTime: 0,
    envTime: 0,
    prepareTime: 0,
    threadTime: 0,
  };
  for(let i = 0; i < tasks.length; ++i) {
    let task = tasks[i];
    if(task.result?.state === 'pass') {
      taskResults.passed = taskResults.passed + 1;
    } else if(task.result?.state === 'fail') {
      taskResults.failed = taskResults.failed + 1;
    } else if(task.mode === 'skip') {
      taskResults.skipped = taskResults.skipped + 1;
    } else if(task.mode === 'todo') {
      taskResults.todo = taskResults.todo + 1;
    }

    if(
      (task.type === 'suite')
      && (task.filepath !== undefined)
    ) {
      if(((task as any)?.collectDuration ?? 0) > taskResults.collectTime) {
        taskResults.collectTime += ((task as any)?.collectDuration ?? 0);
      }
      if(((task as any)?.setupDuration ?? 0) > taskResults.setupTime) {
        taskResults.setupTime += (task as any)?.setupDuration ?? 0;
      }
      if((task.result?.duration ?? 0) > taskResults.testsTime) {
        taskResults.testsTime += task.result?.duration ?? 0;
      }
      if(((task as any)?.environmentLoad ?? 0) > taskResults.envTime) {
        taskResults.envTime += (task as any)?.environmentLoad ?? 0;
      }
      if(((task as any)?.prepareDuration ?? 0) > taskResults.prepareTime) {
        taskResults.prepareTime += (task as any)?.prepareDuration ?? 0;
      }
    }
  }
  taskResults.threadTime = (
    taskResults.collectTime
    + taskResults.testsTime
    + taskResults.setupTime
  );
  return taskResults;
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
