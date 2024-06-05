import { Task, File, Vitest } from 'vitest';
import { PrintErrorSummayOpts } from './task-fmt-util';
import { TaskUtil } from './task-util';
import { Formatter } from './ezd-reporter-colors';
import { FormatResultOpts, ReporterFmtUtil } from './reporter-fmt-util';
import { FormatErrorCodeFrameOpts } from './error-fmt-util';

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

export type FormatErrorsOpts = FormatErrorsSummaryOpts & {
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
}
