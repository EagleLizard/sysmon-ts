
import path from 'path';
import { ErrorWithDiff, Task, Vitest } from 'vitest';

import { LogRenderer } from './log-renderer';
import { ReporterFmtUtil } from './reporter-fmt-util';
import { EzdReporterColors } from './ezd-reporter-colors';
import { TaskUtil } from './task-util';
import { ErrorFmtUtil } from './error-fmt-util';
import { FormatErrorsOpts } from './error-summary-util';

export type PrintResultsOpts = {
  logger: LogRenderer;
  config: Vitest['config'];
  onlyFailed?: boolean;
  showAllDurations?: boolean;
  maxLevel?: number;
};

export type PrintErrorSummayOpts = {
  logger: LogRenderer;
  config: Vitest['config'];
};

export class TaskFmtUtil {
  static getResults(tasks: Task[], opts: PrintResultsOpts, outputLines?: string[], level = 0): string[] {
    let maxLevel: number;
    outputLines = outputLines ?? [];
    maxLevel = opts.maxLevel ?? Infinity;
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

        taskResStr = ReporterFmtUtil.formatResult(task, {
          ...opts,
          colors: EzdReporterColors.formatResultColors,
        });

        outStr = `${prefix} ${taskResStr}`;
        if(!opts.onlyFailed || (task.result?.state  === 'fail')) {
          outputLines.push(outStr);
        }
        if(
          (task.type === 'suite')
          && (task.tasks.length > 0)
          && (
            (level < maxLevel)
            || (task.result?.state === 'fail')
          )
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
            TaskFmtUtil.getResults(filteredTasks, opts, outputLines, level + 1);
          } else if(!TaskUtil.isSkippedTask(task)) {
            TaskFmtUtil.getResults(task.tasks, opts, outputLines, level + 1);
          }
        }
      }
    }
    return outputLines;
  }

  static async getErrorResults(errors: [ErrorWithDiff | undefined, Task[]][], opts: FormatErrorsOpts) {
    let errorResults: string[];
    errorResults = [];
    for(let i = 0; i < errors.length; ++i) {
      let [ error, currTasks ] = errors[i];
      let errorResult: string[];
      errorResult = await TaskFmtUtil.getErrorResult(error, currTasks, opts);
      for(let k = 0; k < errorResult.length; ++k) {
        let errorResultLine = errorResult[k];
        errorResults.push(errorResultLine);
      }
    }
    return errorResults;
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
        taskName += ` ${colors.dim()} ${path.relative(opts.config.root, filePath)}`;
      }
      errorLines.push(`${colors.fail.bold.inverse(' FAIL ')} ${taskName}`);
    }
    if(error === undefined) {
      throw new Error('Undefined error in printErrors()');
    }
    errorLines.push(`\n${colors.fail.bold.underline(`${error.name}`)}${colors.fail(`: ${error.message}`)}`);
    if(error.diff) {
      // errorLines.push(`\n${colors.pass('- Expected')}\n${colors.fail('+ Received')}\n${colors.pass(`- ${formattedError.expected}`)}\n${colors.fail(`+ ${formattedError.actual}`)}\n`);
      errorLines.push('');
      errorLines.push(colors.pass('- Expected'));
      errorLines.push(colors.fail('+ Received'));
      errorLines.push('');
      errorLines.push(colors.pass(`- ${error.expected}`));
      errorLines.push(colors.fail(`+ ${error.actual}`));
      errorLines.push('');
    }

    if(error.stack !== undefined) {
      nearestTrace = ErrorFmtUtil.getNearestStackTrace(error.stack);
      try {
        highlightedSnippet = await ErrorFmtUtil.formatErrorCodeFrame(nearestTrace, {
          colors: EzdReporterColors.formatErrorCodeFrameColors,
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
