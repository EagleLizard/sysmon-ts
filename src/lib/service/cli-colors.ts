
import { Formatter } from '../../test/reporters/ezd-reporter-colors';

export class CliColors {

  static comb(fns: Formatter[]): Formatter {
    let fmtFn: Formatter | undefined;
    for(let i = 0; i < fns.length; ++i) {
      if(fmtFn === undefined) {
        fmtFn = fns[i];
      } else {
        fmtFn = _comb(fmtFn, fns[i]);
      }
    }
    if(fmtFn === undefined) {
      fmtFn = (s) => s;
    }
    return fmtFn;
  }

  static rgb(r: number, g: number, b: number) {
    return (str: string) => {
      return `\x1B[38;2;${r};${g};${b}m${str}\x1B[39m`;
    };
  }
  static dim(str: string) {
    return `\x1B[2m${str}\x1B[22m`;
  }
  /*
    '\x1B[1mbold\x1B[22m',
    '\x1B[3mitalic\x1B[23m',
    '\x1B[7minverse\x1B[27m'
  */
  static bold(str: string) {
    return `\x1B[1m${str}\x1B[22m`;
  }
  static italic(str: string) {
    return `\x1B[3m${str}\x1B[23m`;
  }
  static inverse(str: string) {
    return `\x1B[7m${str}\x1B[27m`;
  }
  static underline(str: string) {
    return `\x1B[4m${str}\x1B[24m`;
  }
}

function _comb(a: Formatter, b: Formatter): Formatter {
  return (str) => {
    return a(b(str));
  };
}
