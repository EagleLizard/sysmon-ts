
import path, { ParsedPath } from 'path';

import highlight from 'cli-highlight';
import stripAnsi from 'strip-ansi';

import { ReadFileByLineOpts, readFileByLine } from '../../lib/util/files';
import { EzdReporterColors, Formatter } from './ezd-reporter-colors';
import { ERR_STACK_CODE_FRAME_START_STR, F_ARROW_UP, F_LONG_DASH } from './reporters-constants';
import { Task, UserConsoleLog, Vitest } from 'vitest';
import { GetStatSymbolOpts, TaskResultsOutput, TaskUtil } from './task-util';
import { getIntuitiveTime } from '../../lib/util/format-util';

export type GetDividerOpts = {
  rightPad?: number;
  color?: Formatter;
};

export type PrintResultsOpts = {
  logger: Vitest['logger'];
  config: Vitest['config'];
  onlyFailed?: boolean;
  showAllDurations?: boolean;
};

export type FormatResultOpts = PrintResultsOpts & {
  colors: {
    dim: Formatter;
    dimmer: Formatter;
    italic: Formatter;
    count: Formatter;
    heapUsage: Formatter;
    duration: Formatter;
    duration_slow: Formatter;
    getStateSymbolColors: GetStatSymbolOpts['colors'];
  };
};

export type FormatErrorCodeFrameOpts = {
  colors: {
    fail: Formatter;
    dim: Formatter;
    syntax: {
      string: Formatter;
      function: Formatter;
      literal: Formatter;
      number: Formatter;
      keyword: Formatter;
      built_in: Formatter;
    };
  };
};

type FormatFilePathOpts = {
  colors: {
    dim: Formatter,
  }
}

export type FormatUserConsoleLogOpts = {
  colors: {
    user_log: Formatter;
    dim: Formatter;
  };
};

const DEFAULT_CODE_LINES_TO_INCLUDE = 3;
const UNKNOWN_TEST_ID = '__vitest__unknown_test__';

export class ReporterPrintUtil {

  static formatUserConsoleLog(log: UserConsoleLog, task: Task | undefined, opts: FormatUserConsoleLogOpts) {
    let taskName: string | undefined;
    let header: string;
    let resStr: string;

    if(task === undefined) {
      taskName = (log.taskId === UNKNOWN_TEST_ID)
        ? 'unknown test'
        : log.taskId
      ;
    } else {
      taskName = TaskUtil.getFullName(task);
    }
    header = opts.colors.user_log(`${log.type}${opts.colors.dim(` | ${taskName}`)}`);
    resStr = `${header}\n${log.content}\n`;
    return resStr;
  }

  static formatTaskResults(taskResults: TaskResultsOutput, name = 'tests', showTotal = true): string {
    let testResultsStrs: string[];
    let testResultsStr: string;

    const colorCfg = EzdReporterColors.colorCfg;

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

  static formatFilePath(filePath: string, opts: FormatFilePathOpts): string {
    let parsedPath: ParsedPath;
    let resStr: string;
    let fileNameParts: string[];
    let fileName: string;
    let fileExt: string;
    const colors = opts.colors;

    parsedPath = path.parse(filePath);
    fileNameParts = parsedPath.base.split('.');
    fileName = fileNameParts.shift() ?? '';
    fileExt = `.${fileNameParts.join('.')}`;
    resStr = '';
    if(parsedPath.dir !== '') {
      resStr += `${colors.dim(parsedPath.dir)}${colors.dim(path.sep)}`;
    }
    resStr += `${fileName}${colors.dim(fileExt)}`;
    return resStr;
  }

  static getDivider(msg: string, opts?: GetDividerOpts) {
    let numCols: number;
    let msgLen: number;
    let left: number;
    let right: number;
    let leftStr: string;
    let rightStr: string;
    let dividerStr: string;
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

    leftStr = F_LONG_DASH.repeat(left);
    rightStr = F_LONG_DASH.repeat(right);

    if(opts.color !== undefined) {
      leftStr = opts.color(leftStr);
      rightStr = opts.color(rightStr);
    }

    dividerStr = `${leftStr}${msg}${rightStr}`;
    return dividerStr;
  }

  static formatResult(task: Task, opts: FormatResultOpts): string {
    let resStr: string;
    let prefix: string;
    let suffix: string;
    let taskSymbol: string;
    let taskName: string;
    let testCount: number;
    let durationStr: string;

    let outTimeVal: number;
    let outTimeUnit: string;

    const colors = opts.colors;

    prefix = '';
    suffix = '';

    taskSymbol = TaskUtil.getStateSymbol(task, {
      colors: colors.getStateSymbolColors,
    });

    prefix += taskSymbol;
    if(task.type === 'suite') {
      testCount = TaskUtil.getTests(task).length;
      suffix += ` ${colors.count(`(${testCount})`)}`;
    }
    if(task.mode === 'skip') {
      suffix += ` ${colors.dimmer('[skipped]')}`;
    }
    if(opts.config.logHeapUsage && (task.result?.heap !== undefined)) {
      let heapUsed: number;
      heapUsed = Math.floor(task.result.heap / 1024 / 1024);
      suffix += ` ${colors.heapUsage(`${heapUsed} MB heap used`)}`;
    }
    taskName = (task.type === 'suite')
      ? ReporterPrintUtil.formatFilePath(task.name, {
        colors: {
          dim: colors.dim,
        }
      })
      : task.name
    ;
    if(task.result?.duration !== undefined) {
      let formattedOutTimeVal: string;
      let formattedOutUnitVal: string;
      let isSlowTask: boolean;
      isSlowTask = task.result.duration > opts.config.slowTestThreshold;
      [ outTimeVal, outTimeUnit ] = getIntuitiveTime(task.result.duration);
      formattedOutUnitVal = opts.colors.dim(outTimeUnit);
      if(isSlowTask) {
        formattedOutTimeVal = ` ${opts.colors.duration_slow(outTimeVal)}`;
      } else if(opts.showAllDurations) {
        formattedOutTimeVal = ` ${opts.colors.duration(outTimeVal)}`;
      } else {
        formattedOutTimeVal = '';
        formattedOutUnitVal = '';
      }
      durationStr = `${formattedOutTimeVal}${formattedOutUnitVal}`;
      if(!isSlowTask) {
        durationStr = opts.colors.italic(durationStr);
      }
      suffix += durationStr;
    }

    resStr = `${prefix} ${taskName}${suffix}`;
    return resStr;
  }

  static async formatErrorCodeFrame(stackTraceLine: string, opts: FormatErrorCodeFrameOpts) {
    let codeCol: number;
    let errorLineIdx: number | undefined;
    let highlightedLines: string[];
    let codeFrame: CodeFrame;
    let highlightedStr: string;

    let snippetLinNumStart: number;
    let lineNums: number[];
    let lineNumWidth: number;

    const colors = opts.colors;

    snippetLinNumStart = Infinity;
    codeFrame = await getHighlightedFrame(stackTraceLine, opts);
    codeCol = codeFrame.codeCol;
    highlightedLines = codeFrame.fileStr.split('\n');

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
      highlightedLines[i] = `${colors.dim(`${lineNumStr}|`)} ${highlightedLine}`;
    }

    if(errorLineIdx !== undefined) {
      let ptrLine: string;
      let ptrLineNumStr: string;
      ptrLineNumStr = `${' '.repeat(lineNumWidth)}|`;
      ptrLine = `${colors.dim(ptrLineNumStr)}${' '.repeat(codeCol)}${colors.fail(F_ARROW_UP)}`;
      highlightedLines.splice(errorLineIdx, 0, ptrLine);
    }

    highlightedStr = highlightedLines.join('\n');
    return highlightedStr;
  }

  static getNearestStackTrace(errorStack: string): string {
    let codeFrames: string[];
    let stacks: string[];
    let currFrame: string | undefined;
    let nearestTrace: string;
    codeFrames = [];
    stacks = errorStack.split('\n');
    while(
      ((currFrame = stacks.pop()) !== undefined)
      && currFrame.startsWith(ERR_STACK_CODE_FRAME_START_STR)
    ) {
      codeFrames.push(currFrame.substring(ERR_STACK_CODE_FRAME_START_STR.length));
    }
    nearestTrace = codeFrames[codeFrames.length - 1];
    return nearestTrace;
  }
}

type CodeFrame = {
  fileStr: string;
  errorLineIdx: number | undefined;
  codeLineIdx: number;
  codeCol: number;
};

async function getHighlightedFrame(stackTraceLine: string, opts: FormatErrorCodeFrameOpts): Promise<CodeFrame> {
  let codePathStr: string | undefined;
  let codeLineStr: string | undefined;
  let codeColStr: string | undefined;
  let codeLine: number;
  let codeCol: number;

  let lineCount: number;
  let firstLineToInclude: number;
  let lastLineToInclude: number;

  let fileLines: string[];
  let errorLineIdx: number | undefined;
  let snippetLinNumStart: number;
  let fileStr: string;
  let highlighted: string;

  const colors = opts.colors;

  lineCount = 0;
  fileLines = [];
  snippetLinNumStart = Infinity;

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

  firstLineToInclude = Math.max(0, codeLine - DEFAULT_CODE_LINES_TO_INCLUDE);
  lastLineToInclude = firstLineToInclude + (DEFAULT_CODE_LINES_TO_INCLUDE * 2);
  const lineCb: ReadFileByLineOpts['lineCb'] = (line) => {
    lineCount++;
    if(
      (lineCount >= firstLineToInclude)
      && (lineCount <= lastLineToInclude)
    ) {
      fileLines.push(line);
      if(lineCount === codeLine) {
        errorLineIdx = fileLines.length;
      }
      if(lineCount < snippetLinNumStart) {
        snippetLinNumStart = lineCount;
      }
    }
    if(lineCount > lastLineToInclude) {
      return 'finish';
    }
  };
  await readFileByLine(codePathStr, {
    lineCb,
  });
  fileStr = fileLines.join('\n');
  highlighted = highlight(fileStr, {
    language: 'typescript',
    theme: {
      string: colors.syntax.string,
      function: colors.syntax.function,
      literal: colors.syntax.literal,
      number: colors.syntax.number,
      keyword: colors.syntax.keyword,
      // built_in: colors.syntax.built_in,
    }
  });
  return {
    fileStr: highlighted,
    errorLineIdx,
    codeLineIdx: codeLine,
    codeCol,
  };
}
