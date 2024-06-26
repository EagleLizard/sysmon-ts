
import highlight from 'cli-highlight';

import { ReadFileByLineOpts, readFileByLine } from '../../lib/util/files';
import { Formatter } from './ezd-reporter-colors';

import { ERR_STACK_CODE_FRAME_START_STR, F_ARROW_UP } from './reporters-constants';

type CodeFrame = {
  fileStr: string;
  errorLineIdx: number | undefined;
  codeLineIdx: number;
  codeCol: number;
  snippetLineNumStart: number;
};

export type FormatErrorCodeFrameOpts = {
  rootPath: string;
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

const DEFAULT_CODE_LINES_TO_INCLUDE = 2;
const DEFAULT_CODE_LINE_LEFT_PAD = 5;
const highlightCache: Map<string, string> = new Map();

export class ErrorFmtUtil {

  static clearHighlightCache() {
    highlightCache.clear();
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
      if(!isInternalCodeFrame(currFrame)) {
        codeFrames.push(currFrame.substring(ERR_STACK_CODE_FRAME_START_STR.length));
      }
    }
    nearestTrace = codeFrames[codeFrames.length - 1];
    return nearestTrace;
  }

  static async formatErrorCodeFrame(stackTraceLine: string, opts: FormatErrorCodeFrameOpts) {
    let cachedHighlight: string | undefined;
    let codeCol: number;
    let errorLineIdx: number | undefined;
    let highlightedLines: string[];
    let codeFrame: CodeFrame;
    let highlightedStr: string;

    let snippetLineNumStart: number;
    let lineNums: number[];
    let lineNumWidth: number;

    if((cachedHighlight = highlightCache.get(stackTraceLine)) !== undefined) {
      return cachedHighlight;
    }

    const colors = opts.colors;
    codeFrame = await getHighlightedFrame(stackTraceLine, opts);
    codeCol = codeFrame.codeCol;
    errorLineIdx = codeFrame.errorLineIdx;
    snippetLineNumStart = codeFrame.snippetLineNumStart;
    highlightedLines = codeFrame.fileStr.split('\n');

    lineNums = [];
    lineNumWidth = -Infinity;
    for(let i = 0; i < highlightedLines.length; ++i) {
      let lineNum = snippetLineNumStart + i;
      lineNums.push(lineNum);
      lineNumWidth = Math.max(`${lineNum}`.length, lineNumWidth);
    }
    for(let i = 0; i < highlightedLines.length; ++i) {
      let highlightedLine = highlightedLines[i];
      let lineNumStr = `${lineNums[i]}`;
      if(lineNumStr.length < lineNumWidth) {
        lineNumStr = `${' '.repeat(lineNumWidth - lineNumStr.length)}${lineNumStr}`;
      }
      highlightedLines[i] = `${' '.repeat(DEFAULT_CODE_LINE_LEFT_PAD)}${colors.dim(`${lineNumStr}|`)} ${highlightedLine}`;
    }

    if(errorLineIdx !== undefined) {
      let ptrLine: string;
      let ptrLineNumStr: string;
      ptrLineNumStr = `${' '.repeat(lineNumWidth)}|`;
      ptrLine = `${' '.repeat(DEFAULT_CODE_LINE_LEFT_PAD)}${colors.dim(ptrLineNumStr)}${' '.repeat(codeCol)}${colors.fail(F_ARROW_UP)}`;
      highlightedLines.splice(errorLineIdx, 0, ptrLine);
    }

    highlightedStr = highlightedLines.join('\n');
    highlightCache.set(stackTraceLine, highlightedStr);
    return highlightedStr;
  }
}

async function getHighlightedFrame(stackTraceLine: string, opts: FormatErrorCodeFrameOpts): Promise<CodeFrame> {
  let stackTraceLineParts: string[];
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
  let snippetLineNumStart: number;
  let fileStr: string;
  let highlighted: string;
  let codeFrame: CodeFrame;

  const colors = opts.colors;

  lineCount = 0;
  fileLines = [];
  snippetLineNumStart = Infinity;
  stackTraceLineParts = stackTraceLine.split(':');
  codeColStr = stackTraceLineParts.pop();
  codeLineStr = stackTraceLineParts.pop();
  codePathStr = stackTraceLineParts.pop();
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
      if(lineCount < snippetLineNumStart) {
        snippetLineNumStart = lineCount;
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
      comment: colors.syntax.built_in
      // built_in: colors.syntax.built_in,
    }
  });
  codeFrame = {
    fileStr: highlighted,
    errorLineIdx,
    codeLineIdx: codeLine,
    codeCol,
    snippetLineNumStart,
  };
  return codeFrame;
}

function isInternalCodeFrame(codeFrame: string): boolean {
  /*
  Error: ENOENT: no such file or directory, lstat 'path/to/test'
    at Object.lstatSync (node:fs:1660:3)
    at __node_internal_ (node:internal/fs/utils:848:8)
    at Object.rmSync (node:fs:1265:13)
    at path/to/test/my-test.test.ts:31:8
  */

  /*
    For now assuming that checking for a parenthesis at the end
      of the frame is good enough
  */
  return /[0-9]+:[0-9]+\)$/.test(codeFrame);
}
