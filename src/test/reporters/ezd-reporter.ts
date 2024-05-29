
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import path from 'path';
import { Awaitable, ErrorWithDiff, File, Reporter, Task, TaskResultPack, Vitest } from 'vitest';
import stripAnsi from 'strip-ansi';

import { TaskUtil } from './task-util';
import { EzdReporterColors } from './ezd-reporter-colors';
import { FormatResultOpts, GetDividerOpts, PrintResultsOpts, ReporterPrintUtil } from './reporter-print-util';

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

// type Formatter = (input: string | number | null | undefined) => string;

const colorCfg = EzdReporterColors.colorCfg;
const formatResultColors: FormatResultOpts['colors'] = {
  dim: colorCfg.dim,
  dimmer: colorCfg.dimmer,
  count: colorCfg.count,
  heapUsage: colorCfg.heapUsage,
  getStateSymbolColors: {
    pass: colorCfg.pass,
    suite: colorCfg.suite,
    fail: colorCfg.fail,
    skip: colorCfg.dimmer.bold,
  }
};

export default class EzdReporter implements Reporter {
  ctx: Vitest = undefined!;
  watchFileMap: Map<string, number> = new Map();
  // constructor() {}
  onInit(ctx: Vitest) {
    this.ctx = ctx;
    // console.log(ctx);
  }
  // onPathsCollected?: ((paths?: string[] | undefined) => Awaitable<void>) | undefined;
  onPathsCollected(paths?: string[] | undefined): Awaitable<void> {
    logHook('onPathsCollected()');
  }
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
        });
      }
    }
  }
  // onWatcherStart?: ((files?: File[] | undefined, errors?: unknown[] | undefined) => Awaitable<void>) | undefined;
  onWatcherStart(): Awaitable<void> | undefined {
    logHook('onWatcherStart()');
    let files: File[];
    let errors: unknown[];
    files = this.ctx.state.getFiles();
    errors = this.ctx.state.getUnhandledErrors();
    for(let i = 0; i < files?.length; ++i) {
      let file = files[i];
      let runCount: number | undefined;
      runCount = this.watchFileMap.get(file.filepath) ?? 0;
      this.watchFileMap.set(file.filepath, runCount);
    }
  }

  // onFinished?: ((files?: File[] | undefined, errors?: unknown[] | undefined) => Awaitable<void>) | undefined;
  onFinished(): Awaitable<void> {
    return (async () => {
      logHook('onFinished()');
      let files: File[];
      let errors: unknown[];
      files = this.ctx.state.getFiles();
      errors = this.ctx.state.getUnhandledErrors();
      printResults(files, {
        logger: this.ctx.logger,
        config: this.ctx.config,
        onlyFailed: true,
      });
      await printErrorsSummary(files, errors, {
        logger: this.ctx.logger,
        config: this.ctx.config,
        ctx: this.ctx,
      });
    })();
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
  let nearestTrace: string;
  let highlightedSnippet: string;

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
    let formattedError: ErrorWithDiff;
    let [ error, currTasks ] = errorsQueue[i];

    for(let k = 0; k < currTasks.length; ++k) {
      let currTask: Task;
      let filePath: string | undefined;
      let taskName: string;
      let formattedResult: string;
      currTask = currTasks[k];
      if(currTask.type === 'suite') {
        filePath =  currTask.projectName ?? currTask.file?.projectName;
      }
      taskName = TaskUtil.getFullName(currTask, colorCfg.dim(' > '));
      if(filePath !== undefined) {
        taskName += ` ${colorCfg.dim()} ${path.relative(opts.config.root, filePath)}`;
      }
      formattedResult = ReporterPrintUtil.formatResult(currTask, {
        ...opts,
        colors: formatResultColors,
      });
      opts.logger.error(`${colorCfg.fail.bold.inverse(' FAIL ')} ${formattedResult}${taskName}`);
    }
    if(error === undefined) {
      throw new Error('Undefined error in printErrors()');
    }
    formattedError = {
      ...error,
      diff: stripAnsi(error.diff ?? ''),
    };
    opts.logger.error(`\n${colorCfg.fail.bold.underline(`${error.name}`)}${colorCfg.fail(`: ${formattedError.message}`)}`);
    if(error.diff) {
      opts.logger.error();
      opts.logger.error(colorCfg.pass('- Expected'));
      opts.logger.error(colorCfg.fail('+ Received'));
      opts.logger.error();
      opts.logger.error(colorCfg.pass(`- ${formattedError.expected}`));
      opts.logger.error(colorCfg.fail(`+ ${formattedError.actual}`));
      opts.logger.error();
    }

    if(error.stack !== undefined) {
      nearestTrace = ReporterPrintUtil.getNearestStackTrace(error.stack);
      highlightedSnippet = await ReporterPrintUtil.formatErrorCodeFrame(nearestTrace, {
        colors: {
          fail: colorCfg.fail,
          dim: colorCfg.dim,
          syntax: {
            string: colorCfg.syntax.string,
            function: colorCfg.syntax.function,
            literal: colorCfg.syntax.literal,
            number: colorCfg.syntax.number,
          }
        },
      });
      opts.logger.log(highlightedSnippet);
    }

    opts.logger.error();
    opts.logger.error(opts.getErrorDivider());
    opts.logger.error();
  }
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
        colors: formatResultColors,
      });

      outStr = `${prefix} ${taskResStr}`;
      if(!(opts.onlyFailed && (task.result?.state !== 'fail'))) {
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
