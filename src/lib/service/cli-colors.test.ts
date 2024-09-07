
import { describe, it, expect, beforeEach } from 'vitest';
import { CliColors, ColorFormatter } from './cli-colors';

describe('cli-colors tests', () => {

  beforeEach(() => {
    //
  });

  it('tests functions combined with comb() are called in reverse order', () => {
    let fmt1: ColorFormatter;
    let fmt2: ColorFormatter;
    let fmt3: ColorFormatter;
    let fmtFn: ColorFormatter;
    let testStr: string;
    let fmtRes: string;
    let expectedRes: string;
    fmt1 = (v) => `~${v}~`;
    fmt2 = (v) => `!${v}!`;
    fmt3 = (v) => `.${v}.`;
    fmtFn = CliColors.comb([ fmt1, fmt2, fmt3 ]);
    testStr = 'etc';
    expectedRes = fmt1(fmt2(fmt3(testStr)));
    fmtRes = fmtFn(testStr);
    expect(fmtRes).toEqual(expectedRes);
  });

  it('tests dim()', () => {
    let testStr: string;
    let dimRes: string;
    testStr = 'test_str';
    dimRes = CliColors.dim(testStr);
    expect(dimRes).toEqual(`\u001b[2m${testStr}\u001b[22m`);
  });
});
