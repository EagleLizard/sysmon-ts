
import { ADDR_TYPE_ENUM, TimeBucketUnit } from '../../models/ping-args';
import { StartParam, TIME_UNIT_TO_TIME_BUCKET_MAP, isStartParam, parseStartParam } from '../../util/cmd-parse-util';
import { PingStatOpts } from '../parse-sysmon-args';

export const DEFAULT_NUM_STD_DEVIATIONS = 1;

export type BucketOpt = {
  bucketVal: number | undefined;
  bucketUnit: TimeBucketUnit | undefined;
};

export type _PingStatOpts = {
  numStdDevs: number;
  addr?: string,
  network?: ADDR_TYPE_ENUM,
  bucket?: BucketOpt,
  start?: string,
};

export function _getPingStatOpts(cmdOpts: PingStatOpts): _PingStatOpts {
  let opts: _PingStatOpts;
  opts = {
    addr: cmdOpts.ip,
    numStdDevs: getStdDevOpt(cmdOpts),
    network: getNetworkOpt(cmdOpts),
    bucket: getBucketOpt(cmdOpts),
    start: getStartOpt(cmdOpts),
  };
  return opts;
}

function getBucketOpt(cmdOpts: PingStatOpts): BucketOpt {
  let bucketOpt: BucketOpt;
  let bucketVal: number | undefined;
  let bucketUnit: TimeBucketUnit | undefined;
  /*
    Possible input format:
      5 min
      5min
      5m
  */
  if(cmdOpts.bucket !== undefined) {
    let startParam: StartParam;
    startParam = parseStartParam(cmdOpts.bucket);
    bucketVal = startParam.value;
    bucketUnit = TIME_UNIT_TO_TIME_BUCKET_MAP[startParam.unit];
  }
  bucketOpt = {
    bucketVal,
    bucketUnit,
  };
  return bucketOpt;
}

function getStartOpt(cmdOpts: PingStatOpts): string | undefined {
  let startParam: string | undefined;
  if(cmdOpts.start !== undefined) {
    startParam = cmdOpts.start;
    if(!isStartParam(startParam)) {
      throw new Error(`Invalid start option: ${startParam}`);
    }
  }

  return startParam;
}

function getNetworkOpt(cmdOpts: PingStatOpts): ADDR_TYPE_ENUM | undefined {
  let networkOpt: ADDR_TYPE_ENUM | undefined;

  if(cmdOpts.network !== undefined) {
    /*
      check if network string is valid ADDR_TYPE
    */
    let rawAddrType = cmdOpts.network;
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

function getStdDevOpt(cmdOpts: PingStatOpts): number {
  let numStdDeviations: number;
  numStdDeviations = DEFAULT_NUM_STD_DEVIATIONS;
  if(cmdOpts.stddev !== undefined) {
    numStdDeviations = cmdOpts.stddev;
  }
  return numStdDeviations;
}
