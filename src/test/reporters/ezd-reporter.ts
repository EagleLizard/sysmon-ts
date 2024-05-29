
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import path, { ParsedPath } from 'path';
import { Awaitable, ErrorWithDiff, File, Reporter, Task, TaskResultPack, Vitest } from 'vitest';
import stripAnsi from 'strip-ansi';
import { highlight } from 'cli-highlight';

import { readFileByLine } from '../../lib/util/files';
import { TaskUtil } from './task-util';
import { EzdReporterColors } from './ezd-reporter-colors';

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

const F_LONG_DASH = '⎯';
const F_ARROW_UP = '^';

const ERR_STACK_CODE_FRAME_START_STR = '    at ';
const DEFAULT_CODE_LINES_TO_INCLUDE = 3;

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

type PrintResultsOpts = {
  logger: Vitest['logger'];
  config: Vitest['config'];
  onlyFailed?: boolean,
};

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
  let suiteErrorLabel: string;
  let testErrorLabel: string;
  if(failedSuites.length > 0) {
    suiteErrorLabel = colorCfg.fail.inverse.bold(` Failed Suites: ${failedSuites.length} `);
    opts.logger.error();
    opts.logger.error(getDivider(suiteErrorLabel));
    opts.logger.error();
    await printErrors(failedSuites, printErrorsOpts);
  }
  if(failedTests.length > 0) {
    testErrorLabel = colorCfg.fail.inverse.bold(` Failed Tests: ${failedTests.length} `);
    opts.logger.error(getDivider(testErrorLabel));
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

      if(errorItem !== undefined) {
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
      currTask = currTasks[k];
      if(currTask.type === 'suite') {
        filePath =  currTask.projectName ?? currTask.file?.projectName;
      }
      taskName = TaskUtil.getFullName(currTask, colorCfg.dim(' > '));
      if(filePath !== undefined) {
        taskName += ` ${colorCfg.dim()} ${path.relative(opts.config.root, filePath)}`;
      }
      opts.logger.error(`${colorCfg.fail.bold.inverse(' FAIL ')} ${formatResult(currTask, opts)}${taskName}`);
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
      let codeFrames: string[];
      let stacks: string[];
      let currFrame: string | undefined;
      codeFrames = [];
      stacks = error.stack.split('\n');
      while(
        ((currFrame = stacks.pop()) !== undefined)
        && currFrame.startsWith(ERR_STACK_CODE_FRAME_START_STR)
      ) {
        codeFrames.push(currFrame.substring(ERR_STACK_CODE_FRAME_START_STR.length));
      }
      let nearest: string;
      nearest = codeFrames[codeFrames.length - 1];
      let highlightedStr = await formatErrorCodeFrame(nearest);
      opts.logger.log(highlightedStr);
    }

    opts.logger.error();
    opts.logger.error(opts.getErrorDivider());
    opts.logger.error();
  }
}

async function formatErrorCodeFrame(stackTraceLine: string) {
  let codePathStr: string | undefined;
  let codeLineStr: string | undefined;
  let codeColStr: string | undefined;
  let codeLine: number;
  let codeCol: number;
  let fileLines: string[];
  let fileStr: string;
  let errorLineIdx: number | undefined;
  let lineCount: number;
  let firstLineToInclude: number;
  let highlighted: string;
  let highlightedLines: string[];
  let highlightedStr: string;

  let snippetLinNumStart: number;
  let lineNums: number[];
  let lineNumWidth: number;

  [ codePathStr, codeLineStr, codeColStr ] = stackTraceLine.split(':');
  if(
    codePathStr === undefined
    || codeLineStr === undefined
    || codeColStr === undefined
  ) {
    throw new Error(`Error parsing error stack: ${stackTraceLine}`);
  }
  codeLine = +codeLineStr;
  codeCol = +codeColStr;
  if(isNaN(codeLine) || isNaN(codeCol)) {
    throw new Error(`Error parsing line and column in error stack: ${stackTraceLine}`);
  }
  fileLines = [];
  lineCount = 0;
  firstLineToInclude = Math.max(0, codeLine - DEFAULT_CODE_LINES_TO_INCLUDE);
  snippetLinNumStart = Infinity;
  const lineCb = (line: string) => {
    lineCount++;
    if(
      (lineCount >= firstLineToInclude)
      && (lineCount <= (firstLineToInclude + (DEFAULT_CODE_LINES_TO_INCLUDE * 2)))
    ) {
      fileLines.push(line);
      if(lineCount === codeLine) {
        errorLineIdx = fileLines.length;
      }
      if(lineCount < snippetLinNumStart) {
        snippetLinNumStart = lineCount;
      }
    }
  };
  await readFileByLine(codePathStr, {
    lineCb,
  });
  fileStr = fileLines.join('\n');
  highlighted = highlight(fileStr, {
    language: 'typescript',
    theme: {
      string: colorCfg.syntax.string,
      function: colorCfg.syntax.function,
      literal: colorCfg.syntax.literal,
      number: colorCfg.syntax.number,
    }
  });
  highlightedLines = highlighted.split('\n');

  lineNums = [];
  lineNumWidth = -Infinity;
  for(let i = 0; i < highlightedLines.length; ++i) {
    let lineNum = snippetLinNumStart + i;
    lineNums.push(lineNum);
    lineNumWidth = Math.max(`${lineNum}`.length, lineNumWidth);
  }
  for(let i = 0; i < highlightedLines.length; ++i) {
    let highlightedLine = highlightedLines[i];
    let lineNumStr = `${lineNums[i]}`;
    if(lineNumStr.length < lineNumWidth) {
      lineNumStr = `${' '.repeat(lineNumWidth - lineNumStr.length)}${lineNumStr}`;
    }
    highlightedLines[i] = `${colorCfg.dim(`${lineNumStr}|`)} ${highlightedLine}`;
  }

  if(errorLineIdx !== undefined) {
    let ptrLine: string;
    let ptrLineNumStr: string;
    ptrLineNumStr = `${' '.repeat(lineNumWidth)}|`;
    ptrLine = `${colorCfg.dim(ptrLineNumStr)}${' '.repeat(codeCol)}${colorCfg.fail(F_ARROW_UP)}`;
    highlightedLines.splice(errorLineIdx, 0, ptrLine);
  }

  highlightedStr = highlightedLines.join('\n');
  return highlightedStr;
}

type GetDividerOpts = {
  rightPad?: number;
}

function getDivider(msg: string, opts?: GetDividerOpts) {
  let numCols: number;
  let msgLen: number;
  let left: number;
  let right: number;
  if(opts === undefined) {
    opts = {};
  }

  msgLen = stripAnsi(msg).length;
  numCols = process.stdout.columns;
  if(opts.rightPad !== undefined) {
    left = numCols - msgLen - opts.rightPad;
    right = opts.rightPad;
  } else {
    left = Math.floor((numCols - msgLen) / 2);
    right = numCols - msgLen - left;
  }

  left = Math.max(0, left);
  right = Math.max(0, right);

  return colorCfg.fail(`${F_LONG_DASH.repeat(left)}${msg}${F_LONG_DASH.repeat(right)}`);
}

function printResults(tasks: Task[], opts: PrintResultsOpts, outputLines?: string[], level = 0) {
  let logger: Vitest['logger'];

  logger = opts.logger;
  outputLines = outputLines ?? [];

  tasks = tasks.slice();
  tasks.sort(taskComparator);

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

      taskResStr = formatResult(task, opts);

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
            if(!isSkippedTask(currTask)) {
              filteredTasks.push(currTask);
            }
          }
          printResults(filteredTasks, opts, outputLines, level + 1);
        } else if(!isSkippedTask(task)) {
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

function isSkippedTask(task: Task) {
  return (
    (task.mode === 'skip')
    || (task.mode === 'todo')
  );
}

function formatResult(task: Task, opts: PrintResultsOpts): string {
  let resStr: string;
  let prefix: string;
  let suffix: string;
  let taskSymbol: string;
  let taskName: string;
  let testCount: number;
  prefix = '';
  suffix = '';

  taskSymbol = getStateSymbol(task);

  prefix += taskSymbol;
  if(task.type === 'suite') {
    testCount = TaskUtil.getTests(task).length;
    suffix += ` ${colorCfg.count(`(${testCount})`)}`;
  }
  if(task.mode === 'skip') {
    suffix += ` ${colorCfg.dimmer('[skipped]')}`;
  }
  if(opts.config.logHeapUsage && (task.result?.heap !== undefined)) {
    let heapUsed: number;
    heapUsed = Math.floor(task.result.heap / 1024 / 1024);
    suffix += ` ${colorCfg.heapUsage(`${heapUsed} MB heap used`)}`;
  }
  taskName = (task.type === 'suite')
    ? formatFilePath(task.name)
    : task.name
  ;
  resStr = `${prefix} ${taskName} ${suffix}`;
  return resStr;
}

function formatFilePath(filePath: string): string {
  let parsedPath: ParsedPath;
  let resStr: string;
  let fileNameParts: string[];
  let fileName: string;
  let fileExt: string;
  parsedPath = path.parse(filePath);
  fileNameParts = parsedPath.base.split('.');
  fileName = fileNameParts.shift() ?? '';
  fileExt = `.${fileNameParts.join('.')}`;
  resStr = '';
  if(parsedPath.dir !== '') {
    resStr += `${colorCfg.dim(parsedPath.dir)}${colorCfg.dim(path.sep)}`;
  }
  resStr += `${fileName}${colorCfg.dim(fileExt)}`;
  return resStr;
}

function logHook(hookName: string) {
  console.log(`-- ${hookName}`);
}

function getStateSymbol(task: Task) {
  switch(task.result?.state) {
    case 'pass':
      return colorCfg.pass('✓');
    case 'fail':
      let failSymbol: string;
      failSymbol = (task.type === 'suite')
        ? colorCfg.suite('❯')
        : colorCfg.fail('✗')
      ;
      return failSymbol;
    case 'run':
      return '⏱';
      // return '↻';
    case 'skip':
      return colorCfg.dimmer.bold('↓');
    default:
      return ' ';
  }
}

function taskComparator<T extends Task>(a: T, b: T) {
  let aSkip: boolean;
  let bSkip: boolean;
  aSkip = (a.mode === 'skip') || (a.mode === 'todo');
  bSkip = (b.mode === 'skip') || (b.mode === 'todo');
  if(aSkip && !bSkip) {
    return -1;
  } else if(!aSkip && bSkip) {
    return 1;
  } else {
    return 0;
  }
}
