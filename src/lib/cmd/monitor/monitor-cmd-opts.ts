import { isString } from '../../util/validate-primitives';
import { MONITOR_CMD_FLAG_MAP, SysmonCommand } from '../sysmon-args';

const DEFAULT_SAMPLE_INTERVAL_MS = 500;
const DEFAULT_MAX_CPU_SAMPLES = 1e4;

export type MonitorCmdOpts = {
  SAMPLE_INTERVAL_MS: number;
  MAX_CPU_SAMPLES: number;
};

export function getMonitorOpts(cmd: SysmonCommand): MonitorCmdOpts {
  let opts: MonitorCmdOpts;
  opts = {
    SAMPLE_INTERVAL_MS: getSampleIntervalOpt(cmd),
    MAX_CPU_SAMPLES: getMaxCpuSamplesOpt(cmd),
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
    (cmd.opts?.[MONITOR_CMD_FLAG_MAP.MAX_CPU_SAMPLES.flag] === undefined)
  ) {
    return DEFAULT_MAX_CPU_SAMPLES;
  }
  rawVal = cmd.opts[MONITOR_CMD_FLAG_MAP.MAX_CPU_SAMPLES.flag].value[0];
  if(rawVal === undefined) {
    throw new Error('The max-cpu-samples flag expects one argument.');
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
