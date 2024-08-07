
import { WriteStream } from 'fs';

import { isObject } from '../../../util/validate-primitives';
import { scanDirColors as c } from '../scan-dir-colors';
import { CliColors, ColorFormatter } from '../../../service/cli-colors';
import { getIntuitiveTimeString } from '../../../util/format-util';

export function _print(val: unknown) {

  if(isObject(val)) {
    let keys: (string | number)[];
    keys = Object.keys(val);
    for(let i = 0; i < keys.length; ++i) {
      console.log(`${keys[i]}: ${_fmtFn(val[keys[i]])}`);
    }
  } else {
    _fmtFn(val);
  }

  function _fmtFn(_val: unknown): string {
    switch(typeof _val) {
      case 'boolean':
        return c.pink(_val);
      case 'number':
        return c.yellow_light(_val);
      case 'string':
        return CliColors.rgb(100, 255, 100)(`'${_val}'`);
      case 'object':
        throw new Error('no objects :/');
      default:
        return c.yellow_light(_val);
    }
  }
}

export function _closeWs(ws: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.close(err => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

export function _timeStr(ms: number, opts: {
    doFmt?: boolean;
    fmtTimeFn?: ColorFormatter;
} = {}): string {
  let doFmt: boolean;
  let fmtTimeFn: ColorFormatter;
  let timeStrFmt: ColorFormatter;
  let msFmt: ColorFormatter;

  doFmt = opts.doFmt ?? true;
  fmtTimeFn = opts.fmtTimeFn ?? c.peach;

  timeStrFmt = doFmt
    ? fmtTimeFn
    : (val) => `${val}`
  ;
  msFmt = doFmt
    ? c.italic
    : (val) => `${val}`
  ;
  return `${timeStrFmt(getIntuitiveTimeString(ms))} (${msFmt(ms)} ms)`;
}
