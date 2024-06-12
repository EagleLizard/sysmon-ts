
import path, { ParsedPath } from 'path';

import stripAnsi from 'strip-ansi';

import { F_LONG_DASH } from './reporters-constants';
import { Task, UserConsoleLog, Vitest } from 'vitest';
import { GetStateSymbolOpts, TaskUtil } from './task-util';
import { getIntuitiveTime } from '../../lib/util/format-util';
import { Formatter } from './ezd-reporter-colors';

export type GetDividerOpts = {
  cols: number,
  rightPad?: number;
  color?: Formatter;
};

export type FormatResultOpts = {
  config: Vitest['config'];
  showAllDurations?: boolean;
  colors: {
    dim: Formatter;
    dimmer: Formatter;
    italic: Formatter;
    count: Formatter;
    heapUsage: Formatter;
    duration: Formatter;
    duration_slow: Formatter;
    getStateSymbolColors: GetStateSymbolOpts['colors'];
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
    user_error_log: Formatter;
    user_log_task_path: Formatter;
  };
};

/*
  see: https://github.com/vitest-dev/vitest/blob/7900f9f89c6a37928df9ea1ae473e526883d6d43/packages/vitest/src/runtime/console.ts#L9
*/
const UNKNOWN_TEST_ID = '__vitest__unknown_test__';

export class ReporterFmtUtil {

  static formatUserConsoleLog(log: UserConsoleLog, task: Task | undefined, opts: FormatUserConsoleLogOpts) {
    let taskName: string | undefined;
    let header: string;
    let resStr: string;
    let fmtFn: Formatter;

    if(task === undefined) {
      taskName = (log.taskId === UNKNOWN_TEST_ID)
        ? 'unknown test'
        : log.taskId
      ;
    } else {
      taskName = TaskUtil.getFullName(task);
    }

    fmtFn = log.type === 'stdout'
      ? opts.colors.user_log
      : opts.colors.user_error_log
    ;

    header = fmtFn(`${log.type}${opts.colors.user_log_task_path(` | ${taskName}`)}`);
    resStr = `${header}\n${log.content}\n`;
    return resStr;
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

  static getDivider(msg: string, opts: GetDividerOpts) {
    let numCols: number;
    let msgLen: number;
    let left: number;
    let right: number;
    let leftStr: string;
    let rightStr: string;
    let dividerStr: string;

    msgLen = stripAnsi(msg).length;
    numCols = opts.cols;
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
      ? ReporterFmtUtil.formatFilePath(task.name, {
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
        formattedOutTimeVal = ` ${opts.colors.duration_slow(`${outTimeVal}`)}`;
      } else if(opts.showAllDurations) {
        formattedOutTimeVal = ` ${opts.colors.duration(`${outTimeVal}`)}`;
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
}

