import { isString } from '../../util/validate-primitives';
import { MONITOR_CMD_FLAG_MAP, SysmonCommand } from '../sysmon-args';

const DEFAULT_SAMPLE_INTERVAL_MS = 100;
const DEFAULT_SAMPLE_MAX = 1e4;

export type MonitorCmdOpts = {
  SAMPLE_INTERVAL_MS: number;
  SAMPLE_MAX: number;
};

export function getMonitorOpts(cmd: SysmonCommand): MonitorCmdOpts {
  let opts: MonitorCmdOpts;
  opts = {
    SAMPLE_INTERVAL_MS: getSampleIntervalOpt(cmd),
    SAMPLE_MAX: getMaxCpuSamplesOpt(cmd),
  };
  return opts;
}

function getSampleIntervalOpt(cmd: SysmonCommand): number {
  let sampleInterval: number;
  let rawVal: unknown;
  if(
    (cmd.opts?.[MONITOR_CMD_FLAG_MAP.SAMPLE_INTERVAL.flag] === undefined)
  ) {
    return DEFAULT_SAMPLE_INTERVAL_MS;
  }
  rawVal = cmd.opts[MONITOR_CMD_FLAG_MAP.SAMPLE_INTERVAL.flag].value[0];
  if(rawVal === undefined) {
    throw new Error('The sample-interval flag expects one argument.');
  }
  if(
    !isString(rawVal)
    || isNaN(+rawVal)
    || !Number.isInteger(+rawVal)
  ) {
    throw new Error('sample-interval must be an integer');
  }
  sampleInterval = +rawVal;
  return sampleInterval;
}

function getMaxCpuSamplesOpt(cmd: SysmonCommand): number {
  let maxCpuSamples: number;
  let rawVal: unknown;
  if(
    (cmd.opts?.[MONITOR_CMD_FLAG_MAP.SAMPLE_MAX.flag] === undefined)
  ) {
    return DEFAULT_SAMPLE_MAX;
  }
  rawVal = cmd.opts[MONITOR_CMD_FLAG_MAP.SAMPLE_MAX.flag].value[0];
  if(rawVal === undefined) {
    throw new Error(`The ${MONITOR_CMD_FLAG_MAP.SAMPLE_MAX.flag} flag expects one argument.`);
  }
  if(
    !isString(rawVal)
    || isNaN(+rawVal)
    || !Number.isInteger(+rawVal)
  ) {
    throw new Error('max-cpu-samples must be an integer');
  }
  maxCpuSamples = +rawVal;
  return maxCpuSamples;
}
