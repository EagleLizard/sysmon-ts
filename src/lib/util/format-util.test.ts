
import { describe, it, expect } from 'vitest';
import { getIntuitiveByteString, getIntuitiveTimeString } from './format-util';

const MICROSECONDS_MS = 0.001;
const SECONDS_MS = 1000;
const MINUTES_MS = SECONDS_MS * 60;
const HOURS_MS = MINUTES_MS * 60;

const KB = 1024;
const MB = KB ** 2;
const GB = KB ** 3;

describe('format-util tests', () => {
  it('tests getIntuitiveTimeString() µs', () => {
    let microSecondsMock: number;
    let timeStr: string;
    microSecondsMock = MICROSECONDS_MS * 20;
    timeStr = getIntuitiveTimeString(microSecondsMock);
    expect(timeStr).toBe('20 µs');
  });

  it('tests getIntuitiveTimeString() ms', () => {
    let msMock: number;
    let timeStr: string;
    msMock = 200;
    timeStr = getIntuitiveTimeString(msMock);
    expect(timeStr).toBe('200 ms');
  });

  it('tests getIntuitiveTimeString() seconds', () => {
    let secondsMock: number;
    let timeStr: string;
    secondsMock = 30 * SECONDS_MS;
    timeStr = getIntuitiveTimeString(secondsMock);
    expect(timeStr).toBe('30 s');
  });

  it('tests getIntuitiveTimeString() minutes', () => {
    let minutesMock: number;
    let timeStr: string;
    minutesMock = 4.25 * MINUTES_MS;
    timeStr = getIntuitiveTimeString(minutesMock);
    expect(timeStr).toBe('4.250 m');
  });

  it('tests getIntuitiveTimeString() hours', () => {
    let hoursMock: number;
    let timeStr: string;
    hoursMock = 1.2 * HOURS_MS;
    timeStr = getIntuitiveTimeString(hoursMock);
    expect(timeStr).toBe('1.200 h');
  });

  it('test getIntuitiveByteString() bytes', () => {
    let bytesMock: number;
    let byteStr: string;
    bytesMock = 512;
    byteStr = getIntuitiveByteString(bytesMock);
    expect(byteStr).toBe('512.000 b');
  });

  it('test getIntuitiveByteString() kb', () => {
    let bytesMock: number;
    let byteStr: string;
    bytesMock = KB * 4;
    byteStr = getIntuitiveByteString(bytesMock);
    expect(byteStr).toBe('4.000 kb');
  });

  it('test getIntuitiveByteString() mb', () => {
    let bytesMock: number;
    let byteStr: string;
    bytesMock = MB * 20;
    byteStr = getIntuitiveByteString(bytesMock);
    expect(byteStr).toBe('20.000 mb');
  });

  it('test getIntuitiveByteString() mb', () => {
    let bytesMock: number;
    let byteStr: string;
    bytesMock = GB * 2.345;
    byteStr = getIntuitiveByteString(bytesMock);
    expect(byteStr).toBe('2.345 gb');
  });
});
