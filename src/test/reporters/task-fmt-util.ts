
import { Task, Vitest } from 'vitest';

import { LogRenderer } from './log-renderer';
import { ReporterFmtUtil } from './reporter-fmt-util';
import { EzdReporterColors } from './ezd-reporter-colors';
import { TaskUtil } from './task-util';

export type GetResultsOpts = {
  config: Vitest['config'];
  onlyFailed?: boolean;
  showAllDurations?: boolean;
  maxLevel?: number;
};

export type PrintErrorSummayOpts = {
  rootPath: string;
  logger: LogRenderer;
  config: Vitest['config'];
};

export class TaskFmtUtil {
  static getResults(tasks: Task[], opts: GetResultsOpts, outputLines?: string[], level = 0): string[] {
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
}
