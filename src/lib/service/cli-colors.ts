
// import { Formatter } from '../../test/reporters/ezd-reporter-colors';
export type ColorFormatter = (val: unknown) => string;

// function etc(val: unknown): string {
//   return `${val}`;
// }

export class CliColors {

  static comb(fns: ColorFormatter[]): ColorFormatter {
    let fmtFn: ColorFormatter | undefined;
    for(let i = 0; i < fns.length; ++i) {
      if(fmtFn === undefined) {
        fmtFn = fns[i];
      } else {
        fmtFn = _comb(fmtFn, fns[i]);
      }
    }
    if(fmtFn === undefined) {
      fmtFn = (s) => `${s}`;
    }
    return fmtFn;
  }

  static rgb(r: number, g: number, b: number): ColorFormatter {
    return (val: unknown) => {
      return `\x1B[38;2;${r};${g};${b}m${val}\x1B[39m`;
    };
  }
  static dim(val: unknown) {
    return `\x1B[2m${val}\x1B[22m`;
  }
  /*
    '\x1B[1mbold\x1B[22m',
    '\x1B[3mitalic\x1B[23m',
    '\x1B[7minverse\x1B[27m'
  */
  static bold(val: unknown) {
    return `\x1B[1m${val}\x1B[22m`;
  }
  static italic(val: unknown) {
    return `\x1B[3m${val}\x1B[23m`;
  }
  static inverse(val: unknown) {
    return `\x1B[7m${val}\x1B[27m`;
  }
  static underline(val: unknown) {
    return `\x1B[4m${val}\x1B[24m`;
  }
}

function _comb(a: ColorFormatter, b: ColorFormatter): ColorFormatter {
  return (str) => {
    return a(b(str));
  };
}
