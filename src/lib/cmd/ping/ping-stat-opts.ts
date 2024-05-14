
import { ADDR_TYPE_ENUM, TimeBucketUnit, validateTimeBucketUnit } from '../../models/ping-args';
import { StartParam, TIME_UNIT_TO_TIME_BUCKET_MAP, isStartParam, parseStartParam } from '../../util/cmd-parse-util';
import { isString } from '../../util/validate-primitives';
import { ArgvOpt, PING_STAT_CMD_FLAG_MAP, SysmonCommand } from '../sysmon-args';

export const DEFAULT_NUM_STD_DEVIATIONS = 1;

export type BucketOpt = {
  bucketVal: number | undefined;
  bucketUnit: TimeBucketUnit | undefined;
};

export type PingStatOpts = {
  numStdDevs: number;
  addr?: string,
  network?: ADDR_TYPE_ENUM,
  bucket?: BucketOpt,
  start?: string,
};

export function getPingStatOpts(cmd: SysmonCommand): PingStatOpts {
  let opts: PingStatOpts;
  opts = {
    addr: cmd.opts?.[PING_STAT_CMD_FLAG_MAP.IP.flag]?.value?.[0],
    numStdDevs: getStdDevOpt(cmd),
    network: getNetworkOpt(cmd),
    bucket: getBucketOpt(cmd),
    start: getStartOpt(cmd),
  };
  return opts;
}

function getBucketOpt(cmd: SysmonCommand): BucketOpt {
  let bucketOpt: BucketOpt;
  let bucketVal: number | undefined;
  let bucketUnit: TimeBucketUnit | undefined;
  /*
    Possible input format:
      5 min
      5min
      5m
  */
  if(cmd.opts?.[PING_STAT_CMD_FLAG_MAP.BUCKET.flag] !== undefined) {
    let bucketOpt: ArgvOpt;
    bucketOpt = cmd.opts[PING_STAT_CMD_FLAG_MAP.BUCKET.flag];
    if(bucketOpt.value.length < 1) {
      throw new Error('no values provided to bucket option');
    }
    if(bucketOpt.value.length === 1) {
      let startParam: StartParam;
      startParam = parseStartParam(bucketOpt.value[0]);
      bucketVal = startParam.value;
      bucketUnit = TIME_UNIT_TO_TIME_BUCKET_MAP[startParam.unit];
    } else if(bucketOpt.value.length === 2) {
      let rawBucketVal = bucketOpt.value[0];
      let rawBucketUnit = bucketOpt.value[1];
      if(
        !isString(rawBucketVal)
        || isNaN(+rawBucketVal)
      ) {
        throw new Error(`Invalid bucket option value: ${rawBucketVal}`);
      }
      bucketVal = +rawBucketVal;
      if(!validateTimeBucketUnit(rawBucketUnit)) {
        throw new Error(`Invalid bucket option unit: ${rawBucketUnit}`);
      }
      bucketUnit = rawBucketUnit;
    } else {
      throw new Error(`Too many arguments passed to --bucket, args: [${bucketOpt.value.join(', ')}]`)
    }
  }
  bucketOpt = {
    bucketVal,
    bucketUnit,
  };
  return bucketOpt;
}

function getStartOpt(cmd: SysmonCommand): string | undefined {
  let startParam: string | undefined;
  if(cmd.opts?.[PING_STAT_CMD_FLAG_MAP.START.flag] !== undefined) {
    let startOpt: ArgvOpt;
    startOpt = cmd.opts[PING_STAT_CMD_FLAG_MAP.START.flag];
    if(startOpt.value.length < 1) {
      throw new Error('no values provided to start option');
    }
    if(startOpt.value.length === 1) {
      startParam = startOpt.value[0];
      if(!isStartParam(startParam)) {
        throw new Error(`Invalid start option: ${startParam}`);
      }
    } else {
      throw new Error(`Invalid number of values provided to start option, received ${startOpt.value.length}`);
    }
  }

  return startParam;
}

function getNetworkOpt(cmd: SysmonCommand): ADDR_TYPE_ENUM | undefined {
  let networkOpt: ADDR_TYPE_ENUM | undefined;

  if(
    (cmd.opts?.[PING_STAT_CMD_FLAG_MAP.NETWORK.flag] !== undefined)
    && (isString(cmd.opts[PING_STAT_CMD_FLAG_MAP.NETWORK.flag].value[0]))
  ) {
    /*
      check if network string is valid ADDR_TYPE
    */
    let rawAddrType = cmd.opts[PING_STAT_CMD_FLAG_MAP.NETWORK.flag].value[0];
    if(
      (rawAddrType === ADDR_TYPE_ENUM.GLOBAL)
      || (rawAddrType === ADDR_TYPE_ENUM.LOCAL)
    ) {
      networkOpt = rawAddrType;
    } else {
      throw new Error(`Invalid network option: ${rawAddrType}`);
    }
  }
  return networkOpt;
}

function getStdDevOpt(cmd: SysmonCommand): number {
  let numStdDeviations: number;
  numStdDeviations = DEFAULT_NUM_STD_DEVIATIONS;
  if(
    (cmd.opts?.[PING_STAT_CMD_FLAG_MAP.STDDEV.flag] !== undefined)
  ) {
    let stdDevOpt = cmd.opts[PING_STAT_CMD_FLAG_MAP.STDDEV.flag];
    if(
      isString(stdDevOpt.value[0])
      && !isNaN(+stdDevOpt.value[0])
    ) {
      numStdDeviations = +stdDevOpt.value[0];
    } else {
      throw new Error(`Invalid stddev option: ${stdDevOpt.value[0]}`)
    }
  }
  return numStdDeviations;
}
