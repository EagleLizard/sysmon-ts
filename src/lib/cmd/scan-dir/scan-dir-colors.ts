
import { CliColors, ColorFormatter } from '../../service/cli-colors';

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
// const coral = CliColors.rgb(255, 156, 120);
const coral = CliColors.rgb(219, 136, 105);
// const coral = CliColors.rgb(255, 181, 153);

// const peach = CliColors.rgb(255, 184, 92);
// const peach = CliColors.rgb(255, 193, 112);
// const peach = CliColors.rgb(255, 202, 133);
const peach = CliColors.rgb(255, 197, 109);
// const tomato = CliColors.rgb(255, 86, 53);
const tomato = CliColors.rgb(255, 101, 71);

const yellow_yellow = CliColors.rgb(255, 255, 0);
const aqua = CliColors.rgb(96, 226, 182);
const purple_light = CliColors.rgb(213, 167, 250);

const purple = CliColors.rgb(199, 131, 255);
const magenta = CliColors.rgb(216, 27, 96);
const orange_light = CliColors.rgb(255, 210, 253);
// const yellow_light = chalk.rgb(255, 255, 117);
const yellow_light = CliColors.rgb(199, 196, 62);
const blue_light = CliColors.rgb(149, 199, 255);

// const cyan = CliColors.rgb(84, 194, 198);
// 142	250	253
const cyan = CliColors.rgb(142, 250, 253);

const white = CliColors.rgb(255, 255, 255);

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
  peach,
  tomato,
  yellow_yellow,
  yellow_light,
  aqua,
  purple_light,
  purple,
  magenta,
  orange_light,
  blue_light,
  cyan,
  white,

  italic: CliColors.italic,
  bold: CliColors.bold,
  underline: CliColors.underline,
};

export const scanDirColors: Record<keyof typeof ezdColors, ColorFormatter> = ezdColors;
