
import { describe, it, expect, beforeEach } from 'vitest';

import { BucketOpt, DEFAULT_NUM_STD_DEVIATIONS, _PingStatOpts, _getPingStatOpts } from './ping-stat-opts';
import { TimeBucketUnit } from '../../models/ping-args';
import { ParsedArgv2, parseArgv2 } from '../parse-argv';
import { getPingStatOpts } from '../parse-sysmon-args';

describe('ping-stat-opts tests', () => {

  let testArgv: string[];
  let cmdMock: ParsedArgv2;
  let pingStatOpts: _PingStatOpts;

  beforeEach(() => {
    testArgv = [ 'node', 'main.js', 'ping-stat' ];
    cmdMock = parseArgv2(testArgv);
  });

  it('tests getPingStatOpts() returns default values with no args', () => {
    cmdMock = parseArgv2(testArgv);
    pingStatOpts = _getPingStatOpts(getPingStatOpts(cmdMock.opts));

    expect(pingStatOpts.numStdDevs).toBe(DEFAULT_NUM_STD_DEVIATIONS);
    expect(pingStatOpts.addr).toBeUndefined;
    expect(pingStatOpts.network).toBeUndefined;
    expect(pingStatOpts.bucket?.bucketUnit).toBeUndefined;
    expect(pingStatOpts.bucket?.bucketVal).toBeUndefined;
    expect(pingStatOpts.start).toBeUndefined;
  });

  it('tests opts.addr is set correctly', () => {
    let addrArgMock: string;
    addrArgMock = 'mock.addr';
    testArgv = testArgv.concat([
      '--ip',
      addrArgMock,
    ]);
    cmdMock = parseArgv2(testArgv);

    pingStatOpts = _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    console.log(pingStatOpts);
    expect(pingStatOpts.addr).toBe(addrArgMock);
  });

  it('tests opts.numStdDevs is set correctly', () => {
    let numStdDevsArgMock: number;
    numStdDevsArgMock = 9;
    testArgv = testArgv.concat([
      '--stddev',
      `${numStdDevsArgMock}`,
    ]);
    cmdMock = parseArgv2(testArgv);

    pingStatOpts = _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    expect(pingStatOpts.numStdDevs).toBe(numStdDevsArgMock);
  });

  it('tests opts.network is set correctly', () => {
    let networkArgMock: string;
    networkArgMock = 'local';
    testArgv = testArgv.concat([
      '--network',
      networkArgMock,
    ]);
    cmdMock = parseArgv2(testArgv);
    pingStatOpts = _getPingStatOpts(getPingStatOpts(cmdMock.opts));

    expect(pingStatOpts.network).toBe(networkArgMock);
  });

  it('tests opts.bucket is set correctly', () => {
    let expectedBucket: BucketOpt;
    let bucketArgMock: string;

    expectedBucket = {
      bucketVal: 20,
      bucketUnit: 'min',
    };

    bucketArgMock = '20m';
    testArgv = testArgv.concat([
      '--bucket',
      `${bucketArgMock}`,
    ]);
    cmdMock = parseArgv2(testArgv);
    pingStatOpts = _getPingStatOpts(getPingStatOpts(cmdMock.opts));

    expect(pingStatOpts.bucket).toEqual(expectedBucket);
  });

  it('tests opts.start is set correctly', () => {
    let startArgMock: string;

    startArgMock = '30d';
    testArgv = testArgv.concat([
      '--start',
      `${startArgMock}`,
    ]);

    cmdMock = parseArgv2(testArgv);
    pingStatOpts = _getPingStatOpts(getPingStatOpts(cmdMock.opts));

    expect(pingStatOpts.start).toEqual(startArgMock);
  });

  /*
    !!! ERROR PATHS !!!
  */

  it('tests opts.numStdDevs throws an error when passed an incorrect value', () => {
    let numStdDevsArgMock: number;
    numStdDevsArgMock = NaN;
    testArgv = testArgv.concat([
      '--stddev',
      `${numStdDevsArgMock}`,
    ]);
    cmdMock = parseArgv2(testArgv);

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.bucket throws an error when no value provided', () => {
    testArgv = testArgv.concat([
      '--bucket',
    ]);
    cmdMock = parseArgv2(testArgv);

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.bucket throws an error when incorrect value with a space is provided', () => {
    let mockBucketVal: number;
    let mockBucketUnit: TimeBucketUnit;
    if(cmdMock.opts === undefined) {
      throw new Error('cmdMock.opts is undefined.');
    }
    mockBucketVal = NaN;
    mockBucketUnit = 'min';
    cmdMock.opts = [
      [ 'b', [ `${mockBucketVal}${mockBucketUnit}` ]]
    ];

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.bucket throws an error when too many values are provided', () => {
    let mockBucketVal: number;
    let mockBucketUnit: TimeBucketUnit;
    let invalidBucketVal: string;
    if(cmdMock.opts === undefined) {
      throw new Error('cmdMock.opts is undefined.');
    }
    mockBucketVal = 15;
    mockBucketUnit = 'min';
    invalidBucketVal = 'invalid_bucket_val';
    cmdMock.opts = [
      [ '-b', [ `${mockBucketVal}${mockBucketUnit}`, `${invalidBucketVal}` ]]
    ];

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.bucket throws an error when incorrect unit with a space is provided', () => {
    let mockBucketVal: number;
    let invalidBucketUnit: string;
    if(cmdMock.opts === undefined) {
      throw new Error('cmdMock.opts is undefined.');
    }
    mockBucketVal = 1e6;
    invalidBucketUnit = 'μ';
    cmdMock.opts = [
      [ '-b', [ `${mockBucketVal}${invalidBucketUnit}` ]],
    ];

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.start throws an error when no value provided', () => {
    testArgv = testArgv.concat([
      '--start',
    ]);
    cmdMock = parseArgv2(testArgv);

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.start throws an error when the value is invalid', () => {
    let startArgMock: string;
    startArgMock = '1μ';
    testArgv = testArgv.concat([
      '--start',
      startArgMock,
    ]);
    cmdMock = parseArgv2(testArgv);

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.start throws an error when an incorrect number of values are passed', () => {
    let startArgMock: string;
    let invalidStartArgMock: string;
    startArgMock = '1';
    invalidStartArgMock = 'min';
    testArgv = testArgv.concat([
      '--start',
      startArgMock,
      invalidStartArgMock,
    ]);
    cmdMock = parseArgv2(testArgv);

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  it('tests opts.network throws an error when an incorrect value is provided', () => {
    let networkArgMock: string;
    networkArgMock = 'invalid';
    testArgv = testArgv.concat([
      '--network',
      networkArgMock,
    ]);
    cmdMock = parseArgv2(testArgv);

    expect(() => {
      _getPingStatOpts(getPingStatOpts(cmdMock.opts));
    }).toThrowError();
  });

  /*
    !!! END ERROR PATHS !!!
  */

});
