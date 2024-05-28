
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import path, { ParsedPath } from 'path';
import { Arrayable, Awaitable, ErrorWithDiff, File, Reporter, Task, TaskResultPack, Vitest, suite } from 'vitest';
import stripAnsi from 'strip-ansi';
import chalk, { ChalkInstance } from 'chalk';
import { highlight } from 'cli-highlight';

import { readFileByLine } from '../../lib/util/files';
import { TaskUtil } from './task-util';

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
type Formatter = ChalkInstance;

type ColorConfig = {
  pass: Formatter;
  fail: Formatter;
  failComplement: Formatter;
  suite: Formatter;
  dim: Formatter;
  dimmer: Formatter;
  count: Formatter;
  heapUsage: Formatter;
  serverRestart: Formatter;
  syntax: {
    function: Formatter;
    string: Formatter,
    literal: Formatter,
    number: Formatter;
  }
}

const chartreuse = chalk.rgb(127, 255, 0);
// const chartreuse_light = chalk.rgb(213, 255, 171);
// const chartreuse_light = chalk.rgb(231, 252, 210);
const chartreuse_light = chalk.rgb(190, 255, 125);
const pink = chalk.rgb(255, 135, 185);
const hot_pink = chalk.bold.rgb(255, 0, 179);
// const pastel_orange = chalk.rgb(255, 221, 173);
const pastel_orange = chalk.rgb(255, 203, 89);
// const teal = chalk.rgb(0, 255, 183);
// const teal = chalk.rgb(0, 255, 221);
const teal = chalk.rgb(0, 125, 125);
const gray = chalk.gray;
const gray_light = chalk.rgb(122, 122, 122);
// const coral = chalk.rgb(255, 127, 80);
const coral = chalk.rgb(255, 156, 120);
const yellow_yellow = chalk.rgb(255, 255, 0);
const aqua = chalk.rgb(96, 226, 182);
const purple_light = chalk.rgb(213, 167, 250);

const purpleRgb = {
  r: 199,
  g: 131,
  b: 255,
};
const purple = chalk.rgb(purpleRgb.r, purpleRgb.g, purpleRgb.b);
const magentaRgb = {
  r: 216,
  g: 27,
  b: 96,
};
const magenta = chalk.rgb(magentaRgb.r, magentaRgb.g, magentaRgb.b);
const orange_lightRgb = {
  r: 255,
  g: 210,
  b: 253,
};
// const orange_light = chalk.rgb(255, 210, 263);
const orange_light = chalk.rgb(orange_lightRgb.r, orange_lightRgb.g, orange_lightRgb.b);

const colorCfg: ColorConfig = {
  // pass: pc.green,
  pass: chartreuse,
  // fail: pc.red,
  // fail: hot_pink,
  // fail: magenta.bold,
  fail: purple,
  failComplement: orange_light,
  // suite: pc.yellow,
  // suite: pastel_orange,
  // suite: coral,
  suite: yellow_yellow,
  dim: chalk.dim,
  dimmer: chalk.gray.dim,
  count: gray_light,
  // heapUsage: pc.magenta,
  heapUsage: coral,
  serverRestart: chalk.bold.magenta,
  syntax: {
    function: pink,
    string: chartreuse_light.italic,
    literal: pastel_orange,
    number: aqua
  }
};

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
  let failedTotal: number;

  suites = TaskUtil.getSuites(files);
  tests = TaskUtil.getTests(files);
  failedTotal = 0;

  failedSuites = [];
  for(let i = 0; i < suites.length; ++i) {
    let suite = suites[i];
    if(suite.result?.errors !== undefined) {
      failedTotal += suite.result.errors.length || 0;
      failedSuites.push(suite);
    }
  }
  failedTests = [];
  for(let i = 0; i < tests.length; ++i) {
    let test = tests[i];
    if(test.result?.state === 'fail') {
      failedTotal += test.result.errors?.length || 0;
      failedTests.push(test);
    }
  }

  // error divider
  let suiteErrorLabel: string;
  let testErrorLabel: string;
  if(failedSuites.length > 0) {
    suiteErrorLabel = colorCfg.fail.inverse.bold(` Failed Suites: ${failedSuites.length} `);
    opts.logger.error(getDivider(suiteErrorLabel));
    await printErrors(failedSuites, opts);
  }
  if(failedTests.length > 0) {
    testErrorLabel = colorCfg.fail.inverse.bold(` Failed Tests: ${failedTests.length} `);
    opts.logger.error(getDivider(testErrorLabel));
    await printErrors(failedTests, opts);
  }
}

async function printErrors(tasks: Task[], opts: PrintErrorSummayOpts) {
  let errorsQueue: [ErrorWithDiff | undefined, Task[]][];
  errorsQueue = [];
  for(let i = 0; i < tasks.length; ++i) {
    let task: Task;
    let errors: ErrorWithDiff[];
    task = tasks[i];
    errors = task.result?.errors ?? [];

    for(let k = 0; k < errors.length; ++k) {
      let errorItem: [ErrorWithDiff | undefined, Task[]] | undefined;
      let error: ErrorWithDiff;
      error = errors[k];
      // console.log(errorItem);
      if(error.stackStr !== undefined) {
        errorItem = errorsQueue.find(errorQueueItem => {
          let hasStr: boolean;
          let currProjName: string | undefined;
          let projName: string | undefined;
          hasStr = errorQueueItem[0]?.stackStr === error.stackStr;
          if(!hasStr) {
            return false;
          }
          if(hasStr && (task.type === 'suite')) {
            currProjName = task.projectName ?? task.file?.projectName;
          }
          if(errorQueueItem[1][0].type === 'suite') {
            projName = errorQueueItem[1][0].projectName ?? errorQueueItem[1][0].file?.projectName;
          }
          return projName === currProjName;
        });
      }
      // console.log(error);
      if(errorItem !== undefined) {
        errorItem[1].push(task);
      } else {
        errorsQueue.push([ error, [ task ]]);
      }
    }

    for(let k = 0; k < errorsQueue.length; ++k) {
      let project: ReturnType<PrintErrorSummayOpts['ctx']['getProjectByTaskId']>;
      let formattedError: ErrorWithDiff;
      let [ error, currTasks ] = errorsQueue[k];

      for(let j = 0; j < currTasks.length; ++j) {
        let currTask: Task;
        let filePath: string | undefined;
        let projName: string;
        let taskName: string;
        currTask = currTasks[j];
        if(currTask.type === 'suite') {
          filePath =  currTask.projectName ?? currTask.file?.projectName;
          projName = currTask.projectName ?? currTask.file?.projectName;
        }
        taskName = TaskUtil.getFullName(currTask, colorCfg.dim(' > '));
        if(filePath !== undefined && filePath.length > 0) {
          taskName += ` ${colorCfg.dim()} ${path.relative(opts.config.root, filePath)}`;
        }
        opts.logger.error(`${colorCfg.fail.bold.inverse(' FAIL ')} ${formatResult(currTask, opts)}${taskName}`);
      }
      project = opts.ctx.getProjectByTaskId(currTasks[0].id);
      if(error === undefined) {
        throw new Error('Undefined error in printErrors()');
      }
      formattedError = {
        ...error,
        diff: stripAnsi(error.diff ?? ''),
      };
      // console.log(formattedError);
      opts.logger.error(`\n${colorCfg.fail.bold.underline(`${error.name}`)}${colorCfg.fail(`: ${formattedError.message}`)}`);
      if(error.diff) {
        opts.logger.error();
        opts.logger.error(colorCfg.pass('- Expected'));
        opts.logger.error(colorCfg.fail('- Received'));
        opts.logger.error();
        opts.logger.error(colorCfg.pass(`${formattedError.expected}`));
        opts.logger.error(colorCfg.fail(`${formattedError.actual}`));
        opts.logger.error();
      }

      if(error.stack !== undefined) {
        let codeFrames: string[];
        let stacks: string[];
        let currFrame: string | undefined;
        codeFrames = [];
        stacks = error.stack.split('\n');
        // console.log(stacks);
        // stacks.reverse();
        while(
          ((currFrame = stacks.pop()) !== undefined)
          && currFrame.startsWith(ERR_STACK_CODE_FRAME_START_STR)
        ) {
          codeFrames.push(currFrame.substring(ERR_STACK_CODE_FRAME_START_STR.length));
        }
        let nearest: string;
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

        nearest = codeFrames[codeFrames.length - 1];
        // console.log(nearest);
        [ codePathStr, codeLineStr, codeColStr ] = nearest.split(':');
        if(
          codePathStr === undefined
          || codeLineStr === undefined
          || codeColStr === undefined
        ) {
          throw new Error(`Error parsing error stack: ${nearest}`);
        }
        codeLine = +codeLineStr;
        codeCol = +codeColStr;
        if(
          isNaN(codeLine)
          || isNaN(codeCol)
        ) {
          throw new Error(`Error parsing line and column in error stack: ${nearest}`);
        }
        // const fileLines = fs.readFileSync(codePathStr).toString().split('\n');
        fileLines = [];
        lineCount = 0;

        firstLineToInclude = Math.max(0, codeLine - DEFAULT_CODE_LINES_TO_INCLUDE);
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
          }
        };
        await readFileByLine(codePathStr, {
          lineCb,
        });
        fileStr = fileLines.join('\n');
        let highlighted = highlight(fileStr, {
          language: 'typescript',
          theme: {
            string: colorCfg.syntax.string,
            function: colorCfg.syntax.function,
            literal: colorCfg.syntax.literal,
            number: colorCfg.syntax.number,
          }
        });
        let highlightedLines = highlighted.split('\n');

        if(errorLineIdx !== undefined) {
          let ptrLine: string;
          ptrLine = colorCfg.fail(`${' '.repeat(codeCol - 1)}${F_ARROW_UP}`);
          highlightedLines.splice(errorLineIdx, 0, ptrLine);
        }

        let highlightedStr = highlightedLines.join('\n');
        opts.logger.log(highlightedStr);
      }

      opts.logger.error(colorCfg.dim(getDivider(`[${k + 1}/${errorsQueue.length}]`)));
      opts.logger.error();
      // opts.logger.printError(formattedError, { project });
    }

  }
}

function getDivider(msg: string) {
  let numCols: number;
  let msgLen: number;
  let left: number;
  let right: number;
  msgLen = stripAnsi(msg).length;
  numCols = process.stdout.columns;
  left = Math.floor((numCols - msgLen) / 2);
  right = numCols - msgLen - left;

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
        : colorCfg.fail('🞪')
      ;
      return failSymbol;
    case 'run':
      return '⏱';
      // return '↻';
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
