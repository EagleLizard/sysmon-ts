
export enum ADDR_TYPE_ENUM {
  LOCAL = 'local',
  GLOBAL = 'global',
}

export type TimeBucketUnit = 'min' | 'hour' | 'day' | 'week';

export function validateTimeBucketUnit(rawUnit: unknown): rawUnit is TimeBucketUnit {
  let isValidUnit: boolean;
  isValidUnit = [
    'min',
    'hour',
    'day',
    'week',
  ].some(unit => rawUnit === unit);
  return isValidUnit;
}
