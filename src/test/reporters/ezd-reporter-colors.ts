
import chalk, { ChalkInstance } from 'chalk';

export type Formatter = ChalkInstance;

export type ColorConfig = {
  pass: Formatter;
  fail: Formatter;
  failComplement: Formatter;
  suite: Formatter;
  dim: Formatter;
  dimmer: Formatter;
  count: Formatter;
  heapUsage: Formatter;
  serverRestart: Formatter;
  syntax: {
    function: Formatter;
    string: Formatter,
    literal: Formatter,
    number: Formatter;
  }
}

const chartreuse = chalk.rgb(127, 255, 0);
// const chartreuse_light = chalk.rgb(213, 255, 171);
// const chartreuse_light = chalk.rgb(231, 252, 210);
const chartreuse_light = chalk.rgb(190, 255, 125);
const pink = chalk.rgb(255, 135, 185);
const hot_pink = chalk.bold.rgb(255, 0, 179);
// const pastel_orange = chalk.rgb(255, 221, 173);
const pastel_orange = chalk.rgb(255, 203, 89);
// const teal = chalk.rgb(0, 255, 183);
// const teal = chalk.rgb(0, 255, 221);
const teal = chalk.rgb(0, 125, 125);
const gray = chalk.gray;
const gray_light = chalk.rgb(122, 122, 122);
// const coral = chalk.rgb(255, 127, 80);
const coral = chalk.rgb(255, 156, 120);
const yellow_yellow = chalk.rgb(255, 255, 0);
const aqua = chalk.rgb(96, 226, 182);
const purple_light = chalk.rgb(213, 167, 250);

const purpleRgb = {
  r: 199,
  g: 131,
  b: 255,
};
const purple = chalk.rgb(purpleRgb.r, purpleRgb.g, purpleRgb.b);
const magentaRgb = {
  r: 216,
  g: 27,
  b: 96,
};
const magenta = chalk.rgb(magentaRgb.r, magentaRgb.g, magentaRgb.b);
const orange_lightRgb = {
  r: 255,
  g: 210,
  b: 253,
};
// const orange_light = chalk.rgb(255, 210, 263);
const orange_light = chalk.rgb(orange_lightRgb.r, orange_lightRgb.g, orange_lightRgb.b);

const ezdColors = {
  chartreuse,
  chartreuse_light,
  pink,
  hot_pink,
  pastel_orange,
  teal,
  gray,
  gray_light,
  coral,
  yellow_yellow,
  aqua,
  purple_light,
  purple,
  magenta,
  orange_light,
};

const colorCfg: ColorConfig = {
  // pass: ezdColors.pc.green,
  pass: ezdColors.chartreuse,
  // fail: ezdColors.pc.red,
  // fail: ezdColors.hot_pink,
  // fail: ezdColors.magenta.bold,
  fail: ezdColors.purple,
  failComplement: ezdColors.orange_light,
  // suite: ezdColors.pc.yellow,
  // suite: ezdColors.pastel_orange,
  // suite: ezdColors.coral,
  suite: ezdColors.yellow_yellow,
  dim: chalk.dim,
  dimmer: ezdColors.gray.dim,
  count: ezdColors.gray_light,
  // heapUsage: ezdColors.pc.magenta,
  heapUsage: ezdColors.coral,
  serverRestart: ezdColors.magenta.bold,
  syntax: {
    function: ezdColors.pink,
    string: ezdColors.chartreuse_light.italic,
    literal: ezdColors.pastel_orange,
    number: ezdColors.aqua
  }
};

export const EzdReporterColors = {
  ezdColors,
  colorCfg,
};
