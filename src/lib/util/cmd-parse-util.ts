import { TimeBucketUnit } from '../models/ping-args';
import { isString } from './validate-primitives';

export type StartParam = {
  unit: TIME_UNIT;
  value: number;
};

export enum TIME_UNIT {
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
}

export const TIME_UNIT_MAP: Record<TIME_UNIT, string> = {
  [TIME_UNIT.MINUTE]: 'MINUTES',
  [TIME_UNIT.HOUR]: 'HOURS',
  [TIME_UNIT.DAY]: 'DAYS',
  [TIME_UNIT.WEEK]: 'WEEK',
};

export const TIME_UNIT_TO_TIME_BUCKET_MAP: Record<TIME_UNIT, TimeBucketUnit> = {
  [TIME_UNIT.MINUTE]: 'min',
  [TIME_UNIT.HOUR]: 'hour',
  [TIME_UNIT.DAY]: 'day',
  [TIME_UNIT.WEEK]: 'week',
};

export function parseStartParam(rawStartParam: unknown): StartParam {
  let startParamRxResult: RegExpExecArray | null;
  let timeStr: string;
  let unitStr: string;
  let unit: TIME_UNIT;
  let time: number;
  let startParam: StartParam;
  if(!isString(rawStartParam)) {
    throw new Error(`unexpected 'start' query param type: ${typeof rawStartParam}, param: ${rawStartParam}`);
  }
  startParamRxResult = /^([0-9]+)([mhd]+)$/.exec(rawStartParam);
  if(
    (startParamRxResult === null)
    || (startParamRxResult[1] === undefined)
    || (startParamRxResult[2] === undefined)
  ) {
    throw new Error(`unexpected 'start' query param type: ${typeof rawStartParam}, param: ${rawStartParam}`);
  }
  timeStr = startParamRxResult[1];
  unitStr = startParamRxResult[2];
  switch(unitStr) {
    case 'm':
      unit = TIME_UNIT.MINUTE;
      break;
    case 'h':
      unit = TIME_UNIT.HOUR;
      break;
    case 'd':
      unit = TIME_UNIT.DAY;
      break;
    case 'w':
      unit = TIME_UNIT.WEEK;
      break;
    default:
      throw new Error(`unexpected 'start' query param type: ${typeof rawStartParam}, param: ${rawStartParam}`);
  }
  time = +timeStr;
  startParam = {
    unit,
    value: time,
  };
  return startParam;
}

export function isStartParam(rawStartParam: string): boolean {
  let startParamRx: RegExp;
  startParamRx = /^[0-9]+[mhdw]$/;
  return startParamRx.test(rawStartParam);
}
