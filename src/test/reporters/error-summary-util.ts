
import path from 'path';
import { Task, File, Vitest, ErrorWithDiff } from 'vitest';

import { PrintErrorSummayOpts } from './task-fmt-util';
import { TaskUtil } from './task-util';
import { Formatter } from './ezd-reporter-colors';
import { FormatResultOpts, ReporterFmtUtil } from './reporter-fmt-util';
import { ErrorFmtUtil, FormatErrorCodeFrameOpts } from './error-fmt-util';

export type FormatErrorsSummaryOpts = {
  config: Vitest['config'];
  showAllDurations?: boolean;
  colors: {
    dim: Formatter;
    fail: Formatter;
    pass: Formatter;
    error_name: Formatter;
    failed_tasks_label: Formatter;
    trace: Formatter;
    error_pos: Formatter;
  };
  formatResultColors: FormatResultOpts['colors'];
  formatCodeFrameColors: FormatErrorCodeFrameOpts['colors'];
};

export type FormatErrorsOpts = {
  colors: FormatErrorsSummaryOpts['colors'];
  formatCodeFrameColors: FormatErrorCodeFrameOpts['colors'];
  rootPath: string,
  getErrorDivider: () => string;
}

export type ErrorsSummary = {
  suites: Task[];
  tests: Task[];
  suitesCount: number;
  testsCount: number;
};

export type FormatErrorsSummaryResult = {
  suites: string[],
  tests: string[],
}

export type GetErrorBannerOpts = {
  colors: {
    dim: Formatter,
    line: Formatter,
    label: Formatter,
  }
};

export class ErrorSummaryUtil {

  static getErrorBanner(label: string, errorCount: number, opts: GetErrorBannerOpts): string {
    let title: string;
    let banner: string;
    title = opts.colors.label(` Failed ${label}: ${errorCount} `);
    banner = ReporterFmtUtil.getDivider(title, {
      color: opts.colors.line,
    });
    return banner;
  }

  static getErrorsSummary(files: File[], errors: unknown[], opts: PrintErrorSummayOpts): ErrorsSummary {
    let suites: Task[];
    let tests: Task[];
    let failedSuites: Task[];
    let failedTests: Task[];
    let failedSuitesCount: number;
    let failedTestsCount: number;

    let errorsSummary: ErrorsSummary;

    suites = TaskUtil.getSuites(files);
    tests = TaskUtil.getTests(files);
    failedSuitesCount = 0;
    failedTestsCount = 0;

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
    errorsSummary = {
      suites: failedSuites,
      tests: failedTests,
      suitesCount: failedSuitesCount,
      testsCount: failedTestsCount,
    };
    return errorsSummary;
  }

  static async getErrorResult(
    error: ErrorWithDiff | undefined,
    currTasks: Task[],
    opts: FormatErrorsOpts
  ): Promise<string[]> {
    let nearestTrace: string;
    let highlightedSnippet: string;
    let errorLines: string[];

    const colors = opts.colors;

    errorLines = [];

    for(let i = 0; i < currTasks.length; ++i) {
      let currTask: Task;
      let filePath: string | undefined;
      let taskName: string;
      currTask = currTasks[i];
      if(currTask.type === 'suite') {
        filePath =  currTask.projectName ?? currTask.file?.projectName;
      }
      taskName = TaskUtil.getFullName(currTask, colors.dim(' > '));
      if(filePath !== undefined) {
        taskName += ` ${colors.dim()} ${path.relative(opts.rootPath, filePath)}`;
      }
      errorLines.push(`${colors.fail.bold.inverse(' FAIL ')} ${taskName}`);
    }
    if(error === undefined) {
      throw new Error('Undefined error in printErrors()');
    }
    errorLines.push(`${colors.error_name(`${error.name}`)}${colors.fail(`: ${error.message}`)}`);
    if(error.diff) {
      errorLines.push('');
      errorLines.push(colors.pass('- Expected'));
      errorLines.push(colors.fail('+ Received'));
      errorLines.push('');
      errorLines.push(colors.pass(`- ${error.expected}`));
      errorLines.push(colors.fail(`+ ${error.actual}`));
      errorLines.push('');
    }

    if(error.stack !== undefined) {
      let stackTraceOutStr: string;
      let codePathStr: string | undefined;
      let codeLineStr: string | undefined;
      let codeColStr: string | undefined;
      nearestTrace = ErrorFmtUtil.getNearestStackTrace(error.stack);
      [ codePathStr, codeLineStr, codeColStr ] = nearestTrace.split(':');
      if(
        (codePathStr !== undefined)
        && (codeLineStr !== undefined)
        && (codeColStr !== undefined)
      ) {
        stackTraceOutStr = [
          opts.colors.error_pos(' > '),
          opts.colors.trace(`${path.relative(opts.rootPath, codePathStr)}:`),
          opts.colors.error_pos(`${codeLineStr}:`),
          opts.colors.error_pos(`${codeColStr}`),
        ].join(''),
        errorLines.push(stackTraceOutStr);
      }
      try {
        highlightedSnippet = await ErrorFmtUtil.formatErrorCodeFrame(nearestTrace, {
          rootPath: opts.rootPath,
          colors: opts.formatCodeFrameColors,
        });
      } catch(e) {
        console.error(e);
        throw e;
      }
      errorLines.push(highlightedSnippet);
    }

    errorLines.push('');
    errorLines.push(opts.getErrorDivider());
    errorLines.push('');
    return errorLines;
  }
}
