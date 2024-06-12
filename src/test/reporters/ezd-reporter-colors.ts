
// import chalk, { ChalkInstance } from 'chalk';
import { FormatErrorCodeFrameOpts } from './error-fmt-util';
import { FormatResultOpts, FormatUserConsoleLogOpts } from './reporter-fmt-util';
import { FormatResultSummaryOpts, GetResultSummaryOpts } from './result-summary-util';
import { FormatErrorsSummaryOpts, GetErrorBannerOpts } from './error-summary-util';
import { CliColors } from '../../lib/service/cli-colors';

const chartreuse = CliColors.rgb(127, 255, 0);
// const chartreuse_light = chalk.rgb(213, 255, 171);
// const chartreuse_light = chalk.rgb(231, 252, 210);
const chartreuse_light = CliColors.rgb(190, 255, 125);
const pink = CliColors.rgb(255, 135, 185);
const hot_pink = CliColors.rgb(255, 0, 179);
const pastel_pink = CliColors.rgb(255, 180, 215);
// const pastel_orange = chalk.rgb(255, 221, 173);
const pastel_orange = CliColors.rgb(255, 203, 89);
// const teal = chalk.rgb(0, 255, 183);
// const teal = chalk.rgb(0, 255, 221);
const teal = CliColors.rgb(120, 255, 214);
const gray = CliColors.rgb(104, 104, 104);
const gray_light = CliColors.rgb(122, 122, 122);
const gray_xlight = CliColors.rgb(160, 160, 160);
// const coral = chalk.rgb(255, 127, 80);
const coral = CliColors.rgb(255, 156, 120);
const yellow_yellow = CliColors.rgb(255, 255, 0);
const aqua = CliColors.rgb(96, 226, 182);
const purple_light = CliColors.rgb(213, 167, 250);

const purpleRgb = {
  r: 199,
  g: 131,
  b: 255,
};
const purple = CliColors.rgb(purpleRgb.r, purpleRgb.g, purpleRgb.b);
const magentaRgb = {
  r: 216,
  g: 27,
  b: 96,
};
const magenta = CliColors.rgb(magentaRgb.r, magentaRgb.g, magentaRgb.b);
const orange_lightRgb = {
  r: 255,
  g: 210,
  b: 253,
};
// const orange_light = chalk.rgb(255, 210, 263);
const orange_light = CliColors.rgb(orange_lightRgb.r, orange_lightRgb.g, orange_lightRgb.b);
// const yellow_light = chalk.rgb(255, 255, 117);
const yellow_light = CliColors.rgb(199, 196, 62);
const blue_light = CliColors.rgb(149, 199, 255);
const cyan = CliColors.rgb(84, 194, 198);

export type ColorConfig = {
  pass: Formatter;
  fail: Formatter;
  failComplement: Formatter;
  suite: Formatter;
  dim: Formatter;
  dimmer: Formatter;
  italic: Formatter;
  count: Formatter;
  heapUsage: Formatter;
  serverRestart: Formatter;
  duration: Formatter;
  duration_slow: Formatter;
  duration_label: Formatter;
  failed_tasks: Formatter;
  skipped_tasks: Formatter;
  todo_tasks: Formatter;
  task_result_count: Formatter;
  syntax: {
    function: Formatter;
    string: Formatter,
    literal: Formatter,
    number: Formatter;
    built_in: Formatter;
    keyword: Formatter;
    operator: Formatter;
  }
};

const ezdColors = {
  chartreuse,
  chartreuse_light,
  pink,
  hot_pink,
  pastel_pink,
  pastel_orange,
  teal,
  gray,
  gray_light,
  gray_xlight,
  coral,
  yellow_yellow,
  yellow_light,
  aqua,
  purple_light,
  purple,
  magenta,
  orange_light,
  blue_light,
  cyan,
};

const colorCfg = {
  // pass: ezdColors.pc.green,
  pass: ezdColors.chartreuse,
  // fail: ezdColors.pc.red,
  // fail: ezdColors.hot_pink,
  // fail: ezdColors.magenta.bold,
  fail: ezdColors.purple,
  // fail_2: (str: string) => CliColors.underline(ezdColors.purple_light(str)),
  // fail_2: CliColors.comb(CliColors.underline, ezdColors.purple_light),
  fail_2: CliColors.comb([ CliColors.underline, ezdColors.purple_light ]),
  // fail_label: ezdColors.purple.bold.inverse,
  // fail_label: CliColors.comb(CliColors.inverse, CliColors.comb(CliColors.bold, ezdColors.purple)),
  fail_label: CliColors.comb([
    CliColors.inverse,
    CliColors.bold,
    ezdColors.purple,
  ]),
  failComplement: ezdColors.orange_light,
  // suite: ezdColors.pc.yellow,
  // suite: ezdColors.pastel_orange,
  // suite: ezdColors.coral,
  suite: ezdColors.yellow_yellow,
  run_task: ezdColors.blue_light,
  dim: CliColors.dim,
  // dimmer: ezdColors.gray.dim,
  dimmer: CliColors.comb([ CliColors.dim, ezdColors.gray ]),
  italic: CliColors.italic,
  count: ezdColors.gray_light,
  // heapUsage: ezdColors.pc.magenta,
  heapUsage: ezdColors.coral,
  // serverRestart: ezdColors.magenta.bold,
  serverRestart: CliColors.comb([ CliColors.bold, ezdColors.magenta ]),
  duration: ezdColors.gray,
  duration_slow: ezdColors.yellow_light,
  duration_label: CliColors.dim,
  failed_tasks: ezdColors.purple_light,
  skipped_tasks: ezdColors.pastel_pink,
  todo_tasks: ezdColors.teal,
  task_result_count: ezdColors.gray,
  // user_log: ezdColors.gray,
  user_log: ezdColors.blue_light,
  user_error_log: ezdColors.purple_light,
  user_log_task_path: CliColors.dim,
  trace: ezdColors.cyan,
  syntax: {
    function: ezdColors.pink,
    // string: ezdColors.chartreuse_light.italic,
    string: CliColors.comb([ CliColors.italic, ezdColors.chartreuse_light ]),
    literal: ezdColors.pastel_orange,
    number: ezdColors.aqua,
    keyword: ezdColors.coral,
    // built_in: ezdColors.gray_light.italic,
    built_in: CliColors.comb([ CliColors.italic, ezdColors.gray ]),
    operator: ezdColors.yellow_yellow,
  }
};

const formatResultColors: FormatResultOpts['colors'] = {
  dim: colorCfg.dim,
  dimmer: colorCfg.dimmer,
  italic: colorCfg.italic,
  count: colorCfg.count,
  heapUsage: colorCfg.heapUsage,
  duration: colorCfg.duration,
  duration_slow: colorCfg.duration_slow,
  getStateSymbolColors: {
    pass: colorCfg.pass,
    suite: colorCfg.suite,
    fail: colorCfg.fail,
    run: colorCfg.run_task,
    skip: CliColors.comb([ CliColors.bold, colorCfg.dimmer ]),
  }
};
const formatErrorCodeFrameColors: FormatErrorCodeFrameOpts['colors'] = {
  fail: colorCfg.fail,
  dim: colorCfg.dim,
  syntax: colorCfg.syntax,
};
const resultSummaryColors: GetResultSummaryOpts['colors'] = {
  dim: colorCfg.dim,
  failed_tasks: colorCfg.failed_tasks,
  fail: colorCfg.fail,
  pass: colorCfg.pass,
  skipped_tasks: colorCfg.skipped_tasks,
  todo_tasks: colorCfg.todo_tasks,
  task_result_count: colorCfg.task_result_count,
};
const formatResultSummary: FormatResultSummaryOpts['colors'] = {
  dim: colorCfg.dim,
  duration_label: colorCfg.duration_label,
  failed_tasks: colorCfg.failed_tasks,
  fail: colorCfg.fail,
  pass: colorCfg.pass,
  skipped_tasks: colorCfg.skipped_tasks,
  todo_tasks: colorCfg.todo_tasks,
  task_result_count: colorCfg.task_result_count,
};
const formatUserConsoleLog: FormatUserConsoleLogOpts['colors'] = {
  user_log: colorCfg.user_log,
  user_error_log: colorCfg.user_error_log,
  user_log_task_path: colorCfg.user_log_task_path,
};
const printErrors: FormatErrorsSummaryOpts['colors'] = {
  dim: colorCfg.dim,
  pass: colorCfg.pass,
  fail: colorCfg.fail,
  fail_label: colorCfg.fail_label,
  error_name: colorCfg.fail_2,
  // failed_tasks_label: colorCfg.fail.bold.inverse,
  // failed_tasks_label: CliColors.comb(CliColors.inverse, CliColors.comb(CliColors.bold, colorCfg.fail)),
  failed_tasks_label: CliColors.comb([
    CliColors.inverse,
    CliColors.bold,
    colorCfg.fail,
  ]),
  trace: colorCfg.trace,
  // error_pos: colorCfg.trace.dim,
  error_pos: CliColors.comb([ CliColors.dim, colorCfg.trace ]),
};
const errorBanner: GetErrorBannerOpts['colors'] = {
  line: colorCfg.fail,
  // label: colorCfg.fail.bold.inverse
  // label: CliColors.comb(CliColors.inverse, CliColors.comb(CliColors.bold, colorCfg.fail))
  label: CliColors.comb([
    CliColors.inverse,
    CliColors.bold,
    colorCfg.fail,
  ]),
};

export const EzdReporterColors = {
  ezdColors,
  colorCfg,
  formatResultColors,
  formatErrorCodeFrameColors,
  resultSummaryColors,
  formatResultSummary,
  formatUserConsoleLog,
  printErrors,
  errorBanner,
};

