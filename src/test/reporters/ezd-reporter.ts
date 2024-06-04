
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { Awaitable, ErrorWithDiff, File, Reporter, Task, TaskResultPack, UserConsoleLog, Vitest } from 'vitest';

import { TaskUtil } from './task-util';
import { EzdReporterColors } from './ezd-reporter-colors';
import { ReporterFmtUtil } from './reporter-fmt-util';
import { Timer } from '../../lib/util/timer';
import { ErrorFmtUtil, ErrorsSummary } from './error-fmt-util';
import { LogRenderer } from './log-renderer';
import { PrintErrorSummayOpts, PrintErrorsOpts, PrintResultsOpts, TaskFmtUtil } from './task-fmt-util';
import { ResultSummary, ResultSummaryUtil } from './result-summary-util';

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

export default class EzdReporter implements Reporter {
  ctx: Vitest = undefined!;
  logRenderer: LogRenderer = undefined!;

  private watchFiles: string[] = [];

  private collectedFiles: File[] = [];
  private tasksRan: Task[] = [];

  executionTimer: Timer = Timer.start();

  onInit(ctx: Vitest) {
    this.ctx = ctx;
    this.executionTimer = Timer.start();
    this.logRenderer = LogRenderer.init(this.ctx.logger, {
      maxLines: process.stdout.rows,
      clearScreen: this.ctx.config.clearScreen,
      // doClear: false,
    });
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
      if(
        (task !== undefined)
        && (task.file === undefined) // means the task won't have circular refs
        // && ('filepath' in task) // means the task won't have circular refs
        && (task.result?.state !== 'run')
      ) {
        this.tasksRan.push(task);
        this.logRenderer.clear();
        printResults([ task ], {
          logger: this.logRenderer,
          config: this.ctx.config,
          onlyFailed: false,
          showAllDurations: true,
          maxLevel: 0,
        });
      }
    }
  }

  // onCollected?: ((files?: File[] | undefined) => Awaitable<void>) | undefined;
  onCollected(files?: File[] | undefined): Awaitable<void> {
    // logHook('onCollected()');
    files = files ?? [];
    for(let i = 0; i < files.length; ++i) {
      let file = files[i];
      this.collectedFiles.push(file);
    }
    this.logRenderer.clear();
    printResults(files, {
      logger: this.logRenderer,
      config: this.ctx.config,
      onlyFailed: false,
      showAllDurations: true,
      maxLevel: 0,
    });
  }

  // onWatcherStart?: ((files?: File[] | undefined, errors?: unknown[] | undefined) => Awaitable<void>) | undefined;
  onWatcherStart(files?: File[] | undefined, errors?: unknown[]): Awaitable<void> | undefined {
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
    // logHook('onWatcherRerun()');
    this.logRenderer.clearFullScreen();
    this.watchFiles = files;
    this.executionTimer.reset();
  }

  // onUserConsoleLog?: ((log: UserConsoleLog) => Awaitable<void>) | undefined;
  onUserConsoleLog(log: UserConsoleLog): Awaitable<void> | undefined {
    // logHook('onUserConsoleLog()');
    if(!this.shouldLog(log)) {
      return;
    }
    this.logRenderer.clear();
    printLog(log, {
      getTask: (taskId: string) => {
        return this.ctx.state.idMap.get(taskId);
      },
      logger: this.logRenderer,
    });
    // this.currUserConsoleLogs.push(log);
  }

  /*
    see: https://github.com/vitest-dev/vitest/blob/7900f9f89c6a37928df9ea1ae473e526883d6d43/packages/vitest/src/node/reporters/base.ts#L230
  */
  shouldLog(log: UserConsoleLog) {
    return (
      !this.ctx.config.silent
      || !this.ctx.config.onConsoleLog?.(log.content, log.type)
    );
  }

  // onFinished?: ((files?: File[] | undefined, errors?: unknown[] | undefined) => Awaitable<void>) | undefined;
  onFinished(files?: File[] | undefined, errors?: unknown[] | undefined): Awaitable<void> | undefined {
    let execTimeMs: number;
    this.logRenderer.clear();
    execTimeMs = this.executionTimer.stop();
    return (async () => {
      // logHook('onFinished()');
      let maxLevel: number;

      files = files ?? this.ctx.state.getFiles();
      errors = errors ?? this.ctx.state.getUnhandledErrors();
      /*
        When rerunning a single file in watch mode, show all levels
      */
      maxLevel = (files.length === 1) ? Infinity : 0;
      printResults(files, {
        logger: this.logRenderer,
        config: this.ctx.config,
        onlyFailed: false,
        showAllDurations: true,
        maxLevel,
      });
      await printErrorsSummary(files, errors, {
        logger: this.logRenderer,
        config: this.ctx.config,
      });

      printResultsSummary(files, errors, {
        startTimeMs: this.executionTimer.startTimeMs(),
        execTimeMs,
        isWatcherRerun: (this.watchFiles.length > 0),
        projects: this.ctx.projects,
        logger: this.logRenderer,
        config: this.ctx.config,
      });
    })();
  }
}

type PrintLogOpts = {
  getTask: (taskId: string) => Task | undefined;
  logger: LogRenderer;
};

function printLog(log: UserConsoleLog, opts: PrintLogOpts) {
  let task: Task | undefined;
  let logWs: { write: (chunk: string) => boolean; };
  let logStr: string;
  task = (log.taskId === undefined)
    ? undefined
    : opts.getTask(log.taskId)
  ;

  logWs = (log.type === 'stdout')
    ? opts.logger.outputStream
    : opts.logger.errorStream
  ;

  logStr = ReporterFmtUtil.formatUserConsoleLog(log, task, {
    colors: EzdReporterColors.formatUserConsoleLog,
  });

  logWs.write(logStr);
}

type PrintResultsSummaryOpts = PrintResultsOpts & {
  startTimeMs: number;
  execTimeMs: number;
  isWatcherRerun: boolean;
  projects: Vitest['projects'];
};

function printResultsSummary(files: File[], errors: unknown[], opts: PrintResultsSummaryOpts) {
  let resultSummary: ResultSummary;
  let outputLines: string[];

  resultSummary = ResultSummaryUtil.getResultSummary(files, {
    projects: opts.projects,
    execTimeMs: opts.execTimeMs,
    colors: EzdReporterColors.resultSummaryColors,
  });

  outputLines = ResultSummaryUtil.formatResultSummary(resultSummary, {
    isWatcherRerun: opts.isWatcherRerun,
    startTimeMs: opts.startTimeMs,
    execTimeMs: opts.execTimeMs,
    colors: EzdReporterColors.formatResultSummary,
  });
  for(let i = 0; i < outputLines.length; ++i) {
    opts.logger.log(outputLines[i]);
  }
}

async function printErrorsSummary(files: File[], errors: unknown[], opts: PrintErrorSummayOpts) {
  let errorsSummary: ErrorsSummary;
  let failedTotal: number;
  let errorCount: number;
  let printErrorsOpts: PrintErrorsOpts;

  errorsSummary = await ErrorFmtUtil.getErrorsSummary(files, errors, opts);

  failedTotal = errorsSummary.suitesCount + errorsSummary.testsCount;

  errorCount = 0;
  const getErrorDivider = () => {
    return colorCfg.fail.dim(ReporterFmtUtil.getDivider(`[${++errorCount}/${failedTotal}]`, {
      rightPad: 3,
    }));
  };

  printErrorsOpts = {
    ...opts,
    getErrorDivider,
    colors: {
      dim: colorCfg.dim,
      pass: colorCfg.pass,
      fail: colorCfg.fail,
    },
    formatResultColors: EzdReporterColors.formatResultColors,
  };
  await printErrors(errorsSummary.suites, 'Suites', printErrorsOpts);
  await printErrors(errorsSummary.tests, 'Tests', printErrorsOpts);
}

async function printErrors(tasks: Task[], label: string, opts: PrintErrorsOpts) {
  let errorsQueue: [ErrorWithDiff | undefined, Task[]][];
  let failedTasksLabel: string;
  let errorResults: string[];

  if(tasks.length === 0) {
    return;
  }

  failedTasksLabel = colorCfg.fail.inverse.bold(` Failed ${label}: ${tasks.length}`);
  opts.logger.error();
  opts.logger.error(ReporterFmtUtil.getDivider(failedTasksLabel, {
    color: colorCfg.fail,
  }));
  opts.logger.error();

  errorsQueue = TaskUtil.getErrors(tasks);
  errorResults = await TaskFmtUtil.getErrorResults(errorsQueue, opts);
  for(let i = 0; i < errorResults.length; ++i) {
    opts.logger.error(errorResults[i]);
  }
}

function printResults(tasks: Task[], opts: PrintResultsOpts) {
  let logger: LogRenderer;
  let outputLines: string[];

  logger = opts.logger;
  outputLines = TaskFmtUtil.getResults(tasks, opts);

  for(let i = 0; i < outputLines.length; ++i) {
    let outputLine = outputLines[i];
    logger.log(outputLine);
  }
}

function logHook(hookName: string) {
  console.log(`-- ${hookName}`);
}
