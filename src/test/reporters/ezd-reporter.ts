
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import path from 'path';
import { Awaitable, ErrorWithDiff, File, Reporter, Task, TaskResultPack, UserConsoleLog, Vitest } from 'vitest';

import { TaskUtil } from './task-util';
import { EzdReporterColors } from './ezd-reporter-colors';
import { GetDividerOpts, PrintResultsOpts, ReporterPrintUtil, TaskResultsOutput } from './reporter-print-util';
import { Timer } from '../../lib/util/timer';
import { getIntuitiveTime } from '../../lib/util/format-util';
import { Writable } from 'node:stream';

/*
interface Reporter {
    onInit?: (ctx: Vitest) => void;
    onPathsCollected?: (paths?: string[]) => Awaitable<void>;
    onCollected?: (files?: File[]) => Awaitable<void>;
    onFinished?: (files?: File[], errors?: unknown[]) => Awaitable<void>;
    onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>;
    onTestRemoved?: (trigger?: string) => Awaitable<void>;
    onWatcherStart?: (files?: File[], errors?: unknown[]) => Awaitable<void>;
    onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>;
    onServerRestart?: (reason?: string) => Awaitable<void>;
    onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>;
    onProcessTimeout?: () => Awaitable<void>;
}
*/

const colorCfg = EzdReporterColors.colorCfg;

/*
  see: https://github.com/vitest-dev/vitest/blob/7900f9f89c6a37928df9ea1ae473e526883d6d43/packages/vitest/src/runtime/console.ts#L9
*/
const UNKNOWN_TEST_ID = '__vitest__unknown_test__';

export default class EzdReporter implements Reporter {
  ctx: Vitest = undefined!;
  private watchFiles: string[] = [];

  executionTimer: Timer = Timer.start();

  onInit(ctx: Vitest) {
    this.ctx = ctx;
    this.executionTimer = Timer.start();
  }

  // onPathsCollected?: ((paths?: string[] | undefined) => Awaitable<void>) | undefined;
  // onPathsCollected(paths?: string[] | undefined): Awaitable<void> {
  //   logHook('onPathsCollected()');
  // }

  // onTaskUpdate?: ((packs: TaskResultPack[]) => Awaitable<void>) | undefined;
  onTaskUpdate(packs: TaskResultPack[]): Awaitable<void> | undefined {
    // logHook('onTaskUpdate()');
    for(let i = 0; i < packs.length; ++i) {
      let pack = packs[i];
      let task = this.ctx.state.idMap.get(pack[0]);
      // console.log(task?.name);
      if(
        (task !== undefined)
        && (task.file === undefined) // means the task won't have circular refs
        // && ('filepath' in task) // means the task won't have circular refs
        && (task.result?.state !== 'run')
      ) {
        printResults([ task ], {
          logger: this.ctx.logger,
          config: this.ctx.config,
          onlyFailed: false,
          showAllDurations: true,
        });
      }
    }
  }
  
  // onCollected?: ((files?: File[] | undefined) => Awaitable<void>) | undefined;
  onCollected(files?: File[] | undefined): Awaitable<void> {
    logHook('onCollected()');
  }


  // onWatcherStart?: ((files?: File[] | undefined, errors?: unknown[] | undefined) => Awaitable<void>) | undefined;
  onWatcherStart(): Awaitable<void> | undefined {
    // logHook('onWatcherStart()');
    // let files: File[];
    // let errors: unknown[];
    // files = this.ctx.state.getFiles();
    // errors = this.ctx.state.getUnhandledErrors();
    // for(let i = 0; i < files?.length; ++i) {
    //   let file = files[i];
    //   let runCount: number | undefined;
    //   runCount = this.watchFileMap.get(file.filepath) ?? 0;
    //   this.watchFileMap.set(file.filepath, runCount);
    // }
  }
  // onWatcherRerun?: ((files: string[], trigger?: string | undefined) => Awaitable<void>) | undefined;
  onWatcherRerun(files: string[], trigger?: string | undefined): Awaitable<void> | undefined {
    this.ctx.logger.clearFullScreen('');
    this.watchFiles = files;
    this.executionTimer.reset();
  }

  // onUserConsoleLog?: ((log: UserConsoleLog) => Awaitable<void>) | undefined;
  onUserConsoleLog(log: UserConsoleLog): Awaitable<void> | undefined {
    let task: Task | undefined;
    let taskName: string | undefined;
    let logWs: {
      write: (chunk: string) => boolean;
    };
    let header: string;
    if(!this.shouldLog(log)) {
      return;
    }
    task = (log.taskId === undefined)
      ? undefined
      : this.ctx.state.idMap.get(log.taskId)
    ;
    logWs = (log.type === 'stdout')
      ? this.ctx.logger.outputStream
      : this.ctx.logger.errorStream
    ;
    // task
    //   ? getFullName(task, c.dim(' > '))
    //   : log.taskId !== UNKNOWN_TEST_ID
    //     ? log.taskId
    //     : 'unknown test';
    if(task === undefined) {
      taskName = (log.taskId === UNKNOWN_TEST_ID)
        ? 'unknown test'
        : log.taskId
      ;
    } else {
      taskName = TaskUtil.getFullName(task);
    }
    header = colorCfg.user_log(`${log.type}${colorCfg.dim(` | ${taskName}`)}`);
    // logWs.write(`${header}\n${log.content}\n`);
  }
  shouldLog(log: UserConsoleLog) {
    if(this.ctx.config.silent)
      return false;
    const shouldLog = this.ctx.config.onConsoleLog?.(log.content, log.type);
    if(shouldLog === false)
      return shouldLog;
    return true;
  }

  // onFinished?: ((files?: File[] | undefined, errors?: unknown[] | undefined) => Awaitable<void>) | undefined;
  onFinished(files?: File[] | undefined, errors?: unknown[] | undefined): Awaitable<void> | undefined {
    let execTimeMs: number;
    execTimeMs = this.executionTimer.stop();
    return (async () => {
      logHook('onFinished()');
      // let files: File[];
      // let errors: unknown[];

      files = files ?? this.ctx.state.getFiles();
      errors = errors ?? this.ctx.state.getUnhandledErrors();
      // printResults(files, {
      //   logger: this.ctx.logger,
      //   config: this.ctx.config,
      //   onlyFailed: true,
      // });
      await printErrorsSummary(files, errors, {
        logger: this.ctx.logger,
        config: this.ctx.config,
        ctx: this.ctx,
      });

      printResultsSummary(files, errors, {
        execTimeMs,
        isWatcherRerun: (this.watchFiles.length > 0),
        projects: this.ctx.projects,
        logger: this.ctx.logger,
        config: this.ctx.config,
      });
    })();
  }
}

type PrintResultsSummaryOpts = PrintResultsOpts & {
  execTimeMs: number;
  isWatcherRerun: boolean;
  projects: Vitest['projects'];
};

function printResultsSummary(files: File[], errors: unknown[], opts: PrintResultsSummaryOpts) {
  let tests: Task[];
  let execTimeStr: string;
  let outputLines: [string, string][];
  let outputLineLabelLen: number;
  let testFileResults: TaskResultsOutput;
  let testFilesResultsStr: string;
  let testResults: TaskResultsOutput;
  let testResultsStr: string;

  let transformTimems: number;
  let threadTime: number;

  let timersStr: string;
  let durationStr: string;

  outputLines = [];
  transformTimems = 0;
  for(let i = 0; i < opts.projects.length; ++i) {
    /*
      TODO: vitest PR to remove unecessary flatMap call: https://github.com/vitest-dev/vitest/blob/b84f1721df66aad9685645084b33e8313a5cffd7/packages/vitest/src/node/reporters/base.ts#L240
    */
    let projectDuration = opts.projects[i].vitenode.getTotalDuration();
    transformTimems += projectDuration;
  }
  testFileResults = ReporterPrintUtil.getTaskResults(files);
  threadTime = (
    testFileResults.collectTime
    + testFileResults.testsTime
    + testFileResults.setupTime
  );

  // opts.logger.log(`${colorCfg.duration_label('Duration:')} ${execTimeStr}`);
  testFilesResultsStr = ReporterPrintUtil.formatTaskResults(testFileResults);
  outputLines.push([
    'Test Files',
    testFilesResultsStr,
  ]);

  tests = TaskUtil.getTests(files);
  testResults = ReporterPrintUtil.getTaskResults(tests);
  testResultsStr = ReporterPrintUtil.formatTaskResults(testResults);
  outputLines.push([
    'Tests',
    testResultsStr
  ]);

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
    `transform: ${timeFmt(transformTimems)}`,
    `setup: ${timeFmt(testFileResults.setupTime)}`,
    `collect: ${timeFmt(testFileResults.collectTime)}`,
    `tests: ${timeFmt(testFileResults.testsTime)}`,
    `environment: ${timeFmt(testFileResults.envTime)}`,
    `prepare: ${timeFmt(testFileResults.prepareTime)}`,
  ].join(', ');

  durationStr = (opts.isWatcherRerun)
    ? execTimeStr
    : `${execTimeStr} ${colorCfg.dim(`(${timersStr})`)}`
  ;
  outputLines.push([
    'Duration',
    durationStr,
  ]);

  outputLineLabelLen = -Infinity;
  for(let i = 0; i < outputLines.length; ++i) {
    let [ title, ] = outputLines[i];
    if(title.length > outputLineLabelLen) {
      outputLineLabelLen = title.length;
    }
  }
  for(let i = 0; i < outputLines.length; ++i) {
    let title: string;
    let text: string;
    let leftPad: number;
    [ title, text ] = outputLines[i];
    leftPad = outputLineLabelLen - title.length;
    opts.logger.log(`${' '.repeat(leftPad)} ${colorCfg.duration_label(title)} ${text}`);
  }
}

type PrintErrorSummayOpts = PrintResultsOpts & {
  ctx: Vitest;
};

async function printErrorsSummary(files: File[], errors: unknown[], opts: PrintErrorSummayOpts) {
  let suites: Task[];
  let tests: Task[];
  let failedSuites: Task[];
  let failedTests: Task[];
  let failedSuitesCount: number;
  let failedTestsCount: number;
  let failedTotal: number;

  let errorCount: number;
  let printErrorsOpts: PrintErrorsOpts;

  let failedSuitesLabel: string;
  let failedTestsLabel: string;

  suites = TaskUtil.getSuites(files);
  tests = TaskUtil.getTests(files);
  failedSuitesCount = 0;
  failedTestsCount = 0;
  failedTotal = 0;

  failedSuites = [];
  for(let i = 0; i < suites.length; ++i) {
    let suite = suites[i];
    if(suite.result?.errors !== undefined) {
      failedSuitesCount += suite.result.errors.length || 0;
      failedSuites.push(suite);
    }
  }
  failedTests = [];
  for(let i = 0; i < tests.length; ++i) {
    let test = tests[i];
    if(test.result?.state === 'fail') {
      failedTestsCount += test.result.errors?.length || 0;
      failedTests.push(test);
    }
  }

  failedTotal = failedSuitesCount + failedTestsCount;

  errorCount = 0;
  const getErrorDivider = () => {
    return colorCfg.dim(getDivider(`[${++errorCount}/${failedTotal}]`, {
      rightPad: 3,
    }));
  };

  printErrorsOpts = {
    ...opts,
    getErrorDivider,
  };

  // error divider
  if(failedSuites.length > 0) {
    failedSuitesLabel = colorCfg.fail.inverse.bold(` Failed Suites: ${failedSuites.length} `);
    opts.logger.error();
    opts.logger.error(getDivider(failedSuitesLabel, {
      color: colorCfg.fail
    }));
    opts.logger.error();
    await printErrors(failedSuites, printErrorsOpts);
  }
  if(failedTests.length > 0) {
    failedTestsLabel = colorCfg.fail.inverse.bold(` Failed Tests: ${failedTests.length} `);
    opts.logger.error(getDivider(failedTestsLabel, {
      color: colorCfg.fail
    }));
    opts.logger.error();
    await printErrors(failedTests, printErrorsOpts);
  }
}

type PrintErrorsOpts = PrintErrorSummayOpts & {
  getErrorDivider: () => string;
};

async function printErrors(tasks: Task[], opts: PrintErrorsOpts) {
  let errorsQueue: [ErrorWithDiff | undefined, Task[]][];

  errorsQueue = [];
  for(let i = 0; i < tasks.length; ++i) {
    let task: Task;
    let errors: ErrorWithDiff[];
    task = tasks[i];
    errors = task.result?.errors ?? [];
    /*
      merge identical errors
        see: https://github.com/vitest-dev/vitest/blob/d6700bbd895e63776263b206ec73ccbb858a1b94/packages/vitest/src/node/reporters/base.ts#L357
      TODO: Rewrite this
    */
    for(let k = 0; k < errors.length; ++k) {
      let errorItem: [ErrorWithDiff | undefined, Task[]] | undefined;
      let error: ErrorWithDiff;
      error = errors[k];
      errorItem = errorsQueue.find(errorQueueItem => {
        let hasStr: boolean;
        let currProjName: string | undefined;
        let projName: string | undefined;
        hasStr = errorQueueItem[0]?.stackStr === error.stackStr;
        if(!hasStr) {
          return false;
        }
        if(task.type === 'suite') {
          currProjName = task.projectName ?? task.file?.projectName;
        }
        if(errorQueueItem[1][0].type === 'suite') {
          projName = errorQueueItem[1][0].projectName ?? errorQueueItem[1][0].file?.projectName;
        }
        return projName === currProjName;
      });

      if(error.stackStr && errorItem !== undefined) {
        errorItem[1].push(task);
      } else {
        errorsQueue.push([ error, [ task ]]);
      }
    }
  }

  for(let i = 0; i < errorsQueue.length; ++i) {
    let [ error, currTasks ] = errorsQueue[i];
    let errorResult: string;
    errorResult = await getErrorResult(error, currTasks, opts);
    opts.logger.error(errorResult);
  }
}

async function getErrorResult(
  error: ErrorWithDiff | undefined,
  currTasks: Task[],
  opts: PrintErrorsOpts
): Promise<string> {
  let nearestTrace: string;
  let highlightedSnippet: string;
  let errorLines: string[];

  errorLines = [];

  for(let i = 0; i < currTasks.length; ++i) {
    let currTask: Task;
    let filePath: string | undefined;
    let taskName: string;
    let formattedResult: string;
    currTask = currTasks[i];
    if(currTask.type === 'suite') {
      filePath =  currTask.projectName ?? currTask.file?.projectName;
    }
    taskName = TaskUtil.getFullName(currTask, colorCfg.dim(' > '));
    if(filePath !== undefined) {
      taskName += ` ${colorCfg.dim()} ${path.relative(opts.config.root, filePath)}`;
    }
    formattedResult = ReporterPrintUtil.formatResult(currTask, {
      ...opts,
      colors: EzdReporterColors.formatResultColors,
    });
    errorLines.push(`${colorCfg.fail.bold.inverse(' FAIL ')} ${formattedResult}${taskName}`);
  }
  if(error === undefined) {
    throw new Error('Undefined error in printErrors()');
  }
  errorLines.push(`\n${colorCfg.fail.bold.underline(`${error.name}`)}${colorCfg.fail(`: ${error.message}`)}`);
  if(error.diff) {
    // errorLines.push(`\n${colorCfg.pass('- Expected')}\n${colorCfg.fail('+ Received')}\n${colorCfg.pass(`- ${formattedError.expected}`)}\n${colorCfg.fail(`+ ${formattedError.actual}`)}\n`);
    errorLines.push('');
    errorLines.push(colorCfg.pass('- Expected'));
    errorLines.push(colorCfg.fail('+ Received'));
    errorLines.push('');
    errorLines.push(colorCfg.pass(`- ${error.expected}`));
    errorLines.push(colorCfg.fail(`+ ${error.actual}`));
    errorLines.push('');
  }

  if(error.stack !== undefined) {
    nearestTrace = ReporterPrintUtil.getNearestStackTrace(error.stack);
    highlightedSnippet = await ReporterPrintUtil.formatErrorCodeFrame(nearestTrace, {
      colors: EzdReporterColors.formatErrorCodeFrameColors,
    });
    errorLines.push(highlightedSnippet);
  }

  errorLines.push('');
  errorLines.push(opts.getErrorDivider());
  errorLines.push('');
  return errorLines.join('\n');
}

function getDivider(msg: string, opts?: GetDividerOpts) {
  let dividerStr: string;
  dividerStr = ReporterPrintUtil.getDivider(msg, opts);
  return colorCfg.fail(dividerStr);
}

function printResults(tasks: Task[], opts: PrintResultsOpts, outputLines?: string[], level = 0) {
  let logger: Vitest['logger'];

  logger = opts.logger;
  outputLines = outputLines ?? [];

  tasks = tasks.slice();
  tasks.sort(TaskUtil.taskComparator);

  for(let i = 0; i < tasks.length; ++i) {
    let task = tasks[i];
    if(task !== undefined) {
      let outStr: string;
      let levelPadStr: string;
      let prefix: string;
      let taskResStr: string;

      prefix = '';

      levelPadStr = '  '.repeat(level);
      prefix += levelPadStr;

      taskResStr = ReporterPrintUtil.formatResult(task, {
        ...opts,
        colors: EzdReporterColors.formatResultColors,
      });

      outStr = `${prefix} ${taskResStr}`;
      if(!opts.onlyFailed || (task.result?.state  === 'fail')) {
        outputLines.push(outStr);
      }
      if(
        (task.type === 'suite')
        && (task.tasks.length > 0)
        && (task.result?.state === 'fail')
      ) {
        if(opts.config.hideSkippedTests) {
          let filteredTasks: Task[];
          filteredTasks = [];
          for(let k = 0; k < task.tasks.length; ++k) {
            let currTask = task.tasks[k];
            if(!TaskUtil.isSkippedTask(currTask)) {
              filteredTasks.push(currTask);
            }
          }
          printResults(filteredTasks, opts, outputLines, level + 1);
        } else if(!TaskUtil.isSkippedTask(task)) {
          printResults(task.tasks, opts, outputLines, level + 1);
        }
      }
    }
  }

  if(level === 0) {
    for(let i = 0; i < outputLines.length; ++i) {
      let outputLine = outputLines[i];
      logger.log(outputLine);
    }
  }
}

function logHook(hookName: string) {
  console.log(`-- ${hookName}`);
}
