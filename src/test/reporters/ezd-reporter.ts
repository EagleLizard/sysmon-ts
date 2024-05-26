
import path, { ParsedPath } from 'path';
import { WriteStream } from 'fs';
import { Awaitable, File, Reporter, Task, TaskResultPack, Vitest, suite } from 'vitest';
import pc from 'picocolors';
import chalk from 'chalk';

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

type Formatter = (input: string | number | null | undefined) => string;

type ColorConfig = {
  pass: Formatter;
  fail: Formatter;
  suite: Formatter;
  dim: Formatter;
  dimmer: Formatter;
  count: Formatter;
  heapUsage: Formatter;
  serverRestart: Formatter;
}

const chartreuse = chalk.rgb(127, 255, 0);
// const chartreuse_light = chalk.rgb(213, 255, 171);
const chartreuse_light = chalk.rgb(231, 252, 210);
const pink = chalk.rgb(255, 135, 185);
const hot_pink = chalk.bold.rgb(255, 0, 179);
// const pastel_orange = chalk.rgb(255, 221, 173);
const pastel_orange = chalk.rgb(255, 203, 89);
// const teal = chalk.rgb(0, 255, 183);
// const teal = chalk.rgb(0, 255, 221);
// const teal = chalk.rgb(0, 125, 125);
const gray = chalk.gray;
const gray_light = chalk.rgb(122, 122, 122);
// const coral = chalk.rgb(255, 127, 80);
const coral = chalk.rgb(255, 156, 120);

const colorCfg: ColorConfig = {
  // pass: pc.green,
  pass: chartreuse,
  // fail: pc.red,
  fail: hot_pink,
  // suite: pc.yellow,
  suite: pastel_orange,
  dim: pc.dim,
  dimmer: (input) => pc.dim(pc.gray(input)),
  count: (input) => gray_light(input),
  // heapUsage: pc.magenta,
  heapUsage: coral,
  serverRestart: (input) => pc.bold(pc.magenta(input)),
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
    let lastTask: Task | undefined;
    for(let i = 0; i < packs.length; ++i) {
      let pack = packs[i];
      let task = this.ctx.state.idMap.get(pack[0]);
      // console.log(task?.name);
      if(
        (task !== undefined)
        // && (task.file === undefined) // means the task won't have circular refs
        && ('filepath' in task) // means the task won't have circular refs
        && (task.result?.state !== 'run')
      ) {
        let tests: Task[];
        try {
          tests = getTests(task);
        } catch(e) {
          console.error(e);
          throw e;
        }
        console.log(tests.length);
        // this.ctx.logger.log(formatResult(task, {
        //   logger: this.ctx.logger,
        //   config: this.ctx.config,
        // }));
        printResults([ task ], {
          logger: this.ctx.logger,
          config: this.ctx.config,
        });
        // let tests: Task[];
        // let testSymbol: string;
        // // testSymbol = getStateSymbol(task);
        // // // console.log(`${testSymbol} ${task.name}`);
        // // // console.log(task.suite?.tasks);
        // tests = getTests(task);
        // // console.log(tests);
        // for(let k = 0; k < tests.length; ++k) {
        //   let test = tests[k];
        //   // console.log(test.name);
        // }
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
    logHook('onFinished()');
    let files: File[];
    let errors: unknown[];
    files = this.ctx.state.getFiles();
    errors = this.ctx.state.getUnhandledErrors();
    printResults(files, {
      logger: this.ctx.logger,
      config: this.ctx.config,
    });
  }
}

type PrintResultsOpts = {
  logger: Vitest['logger'];
  config: Vitest['config'];
};

function printResults(tasks: Task[], opts: PrintResultsOpts, outputLines?: string[], level = 0) {
  let logger: Vitest['logger'];

  logger = opts.logger;
  outputLines = outputLines ?? [];

  tasks = tasks.slice();
  tasks.sort(taskComparator);

  for(let i = 0; i < tasks.length; ++i) {
    let task = tasks[i];
    // let tests = getTests(file);
    let taskSymbol: string;
    if(task !== undefined) {
      let outStr: string;
      let levelPadStr: string;
      let prefix: string;
      let suffix: string;
      let taskName: string;
      let testCount: string;

      prefix = '';
      suffix = '';

      taskSymbol = getStateSymbol(task);
      levelPadStr = '  '.repeat(level);

      prefix += levelPadStr;
      prefix += taskSymbol;

      if(task.type === 'suite') {
        // suffix += ` ${colorCfg.dim(`(${task.tasks.length})`)}`;
        suffix += ` ${colorCfg.count(`(${task.tasks.length})`)}`;
      }
      if(task.mode === 'skip') {
        suffix += ` ${colorCfg.dimmer('[skipped]')}`;
      }
      if(opts.config.logHeapUsage && (task.result?.heap !== undefined)) {
        let heapUsed: number;
        heapUsed = Math.floor(task.result.heap / 1024 / 1024);
        suffix += ` ${colorCfg.heapUsage(`${heapUsed} MB heap used`)}`;
      }
      taskName = (level === 0)
        ? formatFilePath(task.name)
        : task.name
      ;
      outStr = `${prefix} ${taskName} ${suffix}`;
      outputLines.push(outStr);
      // console.log(outStr);
      if(
        (task.type === 'suite')
        && (task.tasks.length > 0)
      ) {
        if(opts.config.hideSkippedTests) {
          let filteredTasks: Task[];
          filteredTasks = [];
          for(let k = 0; k < task.tasks.length; ++k) {
            if(
              task.mode !== 'skip'
              && task.mode !== 'todo'
            ) {
              filteredTasks.push(task.tasks[k]);
            }
          }
          printResults(filteredTasks, opts, outputLines, level + 1);
        } else {
          if(
            (task.mode !== 'skip')
            && (task.mode !== 'todo')
          ) {
            printResults(task.tasks, opts, outputLines, level + 1);
          }
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
  // outputStr = outputLines.join('\n');
  // logger.log(outputStr);
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
    testCount = (task.file === undefined)
      ? getTests(task).length
      : task.tasks.length
    ;
    // suffix += ` ${colorCfg.dim(`(${task.tasks.length})`)}`;
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
  let fileName: string;
  parsedPath = path.parse(filePath);
  fileName = parsedPath.name;
  resStr = [
    colorCfg.dim(parsedPath.dir),
    `${fileName}${colorCfg.dim(parsedPath.ext)}`,
  ].join(path.sep);
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
/*
  see:
    https://github.com/vitest-dev/vitest/blob/b7438b9be28f551cf8d82162e352510a8cbc7b92/packages/runner/src/utils/tasks.ts
*/
function getTests(task: Task): Task[] {
  let tests: Task[];
  let suites: Task[];
  tests = [];
  suites = Array.isArray(task)
    ? task
    : [ task ]
  ;
  for(let i = 0; i < suites.length; ++i) {
    let currSuite = suites[i];
    if(isAtomTest(currSuite)) {
      tests.push(currSuite);
    // } else if(Array.isArray(currSuite.suite?.tasks)) {
    } else if(currSuite.type === 'suite') {
      for(let k = 0; k < currSuite.tasks.length; ++k) {
        let currTask = currSuite.tasks[k];
        console.log(currTask.name);
        if(isAtomTest(currTask)) {
          tests.push(currTask);
        } else {
          // console.log(currTask.filepath);
          let taskTests = getTests(currTask);
          for(let j = 0; j < taskTests.length; ++j) {
            let currTest = taskTests[j];
            tests.push(currTest);
          }
        }
      }
    }
  }
  return tests;
}

function isAtomTest(task: Task): boolean {
  return (
    (task.type === 'test')
    || (task.type === 'custom')
  );
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
