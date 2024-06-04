import { Task, File, ErrorWithDiff, Vitest } from 'vitest';
import { PrintErrorSummayOpts, TaskFmtUtil } from './task-fmt-util';
import { TaskUtil } from './task-util';
import { Formatter } from './ezd-reporter-colors';
import { FormatResultOpts, ReporterFmtUtil } from './reporter-fmt-util';

export type FormatErrorsSummaryOpts = {
  config: Vitest['config'];
  showAllDurations?: boolean;
  colors: {
    dim: Formatter;
    fail: Formatter;
    pass: Formatter;
    failed_tasks_label: Formatter;
  };
  formatResultColors: FormatResultOpts['colors'];
};

export type FormatErrorsOpts = FormatErrorsSummaryOpts & {
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

export class ErrorSummaryUtil {

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

  static async formatErrors(tasks: Task[], label: string, opts: FormatErrorsOpts): Promise<string[]> {
    let outputLines: string[];
    let errorsQueue: [ErrorWithDiff | undefined, Task[]][];
    let failedTasksLabel: string;
    let failedTaskDivider: string;
    let errorResults: string[];
    outputLines = [];

    if(tasks.length === 0) {
      return outputLines;
    }

    failedTasksLabel = opts.colors.failed_tasks_label(` Failed ${label}: ${tasks.length}`);
    failedTaskDivider = ReporterFmtUtil.getDivider(failedTasksLabel, {
      color: opts.colors.fail,
    });
    outputLines.push(`\n${failedTaskDivider}\n`);

    errorsQueue = TaskUtil.getErrors(tasks);
    errorResults = await TaskFmtUtil.getErrorResults(errorsQueue, opts);
    for(let i = 0; i < errorResults.length; ++i) {
      outputLines.push(errorResults[i]);
    }

    return outputLines;
  }
}
