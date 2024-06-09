
import os, { CpuInfo } from 'os';

import { Dll } from '../../models/lists/dll';
import { CpuDiffStat, CpuStat, MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { MonitorUtil } from '../../util/monitor-util';
import { DllNode } from '../../models/lists/dll-node';
import { MonitorOpts } from '../parse-sysmon-args';

type CpuUsageMonOpts = {
  //
} & Pick<MonitorOpts, 'sample_max'>;

type CpuSample = {
  timestamp: number,
  cpuDiffStats: CpuDiffStat[],
};

type CpuMonLogCbOpts = {
  cpuSamples: Dll<CpuSample>;
  totalCpuSampleCount: number;
};

const NUM_CPUS = os.cpus().length;
// const MAX_CPU_SAMPLES = 1e3;
const CPU_OUT_SCALE = 30;
const DEFAULT_MAX_CPU_SAMPLES = 1e3;

export function getCpuMon(cmdOpts: CpuUsageMonOpts) {
  let cpuSamples: Dll<CpuSample>;
  let lastCpuStats: CpuStat[];
  let totalCpuSampleCount: number;

  totalCpuSampleCount = 0;

  cpuSamples = new Dll();
  lastCpuStats = os.cpus().map(MonitorUtil.getCpuStat);

  return (evt: MonitorEventData) => {
    /*
      see: https://stackoverflow.com/a/36823972
    */
    let monitorRet: MonitorReturnValue;
    let currCpuInfos: CpuInfo[];
    let currCpuStats: CpuStat[];
    let cpuDiffStats: CpuDiffStat[];
    let doPrune: boolean;

    doPrune = false;

    totalCpuSampleCount++;
    currCpuInfos = os.cpus();
    currCpuStats = currCpuInfos.map(MonitorUtil.getCpuStat);

    cpuDiffStats = [];
    for(let i = 0; i < lastCpuStats.length; ++i) {
      let startCpuStat: CpuStat;
      let endCpuStat: CpuStat;
      let currCpuDiffStat: CpuDiffStat;
      startCpuStat = lastCpuStats[i];
      endCpuStat = currCpuStats[i];
      currCpuDiffStat = MonitorUtil.getCpuDiffStat(startCpuStat, endCpuStat);
      cpuDiffStats.push(currCpuDiffStat);
    }

    cpuSamples.push({
      timestamp: Date.now(),
      cpuDiffStats,
    });

    doPrune = cpuSamples.length > (cmdOpts.sample_max ?? DEFAULT_MAX_CPU_SAMPLES);
    if(doPrune) {
      pruneCpuSamples(cpuSamples);
    }

    lastCpuStats = currCpuStats;

    const logCb = getCpuMonLogCb({
      cpuSamples,
      totalCpuSampleCount,
    });

    monitorRet = {
      logCb,
    };
    return monitorRet;
  };
}

function getCpuMonLogCb(opts: CpuMonLogCbOpts): MonitorReturnValue['logCb'] {
  return () => {
    let outSample: CpuSample;
    console.log({ cpuSampleCount: opts.cpuSamples.length });
    if(opts.cpuSamples.last === undefined) {
      throw new Error('cpuSamples.last is undefined');
    }
    /*
      get samples for the last N milliseconds
    */
    let lookbackMs = 1e3;
    outSample = getAvgCpuSample(opts.cpuSamples, lookbackMs);
    for(let i = 0; i < outSample.cpuDiffStats.length; ++i) {
      let currDiffStat: CpuDiffStat;
      let perc: number;
      let outNum: number;
      let outScale: number;
      let outScaleStr: string;
      currDiffStat = outSample.cpuDiffStats[i];
      perc = (currDiffStat.total === 0)
        ? 0
        : currDiffStat.idle / currDiffStat.total
      ;
      perc = 1 - perc;
      outNum = Math.round(perc * 10000) / 100;
      outScale = Math.round(perc * CPU_OUT_SCALE);
      outScaleStr = `${'='.repeat(outScale)}`;
      if(outScaleStr.length < CPU_OUT_SCALE) {
        outScaleStr = `${outScaleStr}${' '.repeat(CPU_OUT_SCALE - outScaleStr.length)}`;
      }
      outScaleStr = `${outScaleStr} | ${outNum}`;
      console.log(outScaleStr);
    }
  };
}

function getAvgCpuSample(cpuSamples: Dll<CpuSample>, startMs: number): CpuSample {
  let outSample: CpuSample;
  if(cpuSamples.last === undefined) {
    throw new Error('cpuSamples.last is undefined');
  }
  let lookbackMs = startMs;
  let currNode: DllNode<CpuSample> | undefined;
  let outTimestamp: number;
  let lookbackCount: number;

  currNode = cpuSamples.last;
  outTimestamp = currNode?.val?.timestamp ?? -1;
  lookbackCount = 0;
  outSample = {
    timestamp: outTimestamp,
    cpuDiffStats: Array(NUM_CPUS).fill(0).map(() => {
      return {
        total: 0,
        idle: 0,
      };
    }),
  };
  while(
    (currNode?.prev !== undefined)
    && (currNode.val.timestamp > (Date.now() - lookbackMs))
  ) {
    currNode = currNode.prev;
  }
  while(currNode !== undefined) {
    lookbackCount++;
    for(let i = 0; i < currNode.val.cpuDiffStats.length; ++i) {
      let currDiffStat: CpuDiffStat;
      currDiffStat = currNode.val.cpuDiffStats[i];
      outSample.cpuDiffStats[i].total += currDiffStat.total;
      outSample.cpuDiffStats[i].idle += currDiffStat.idle;
    }
    currNode = currNode.next;
  }
  for(let i = 0; i < outSample.cpuDiffStats.length; ++i) {
    outSample.cpuDiffStats[i].total = outSample.cpuDiffStats[i].total / lookbackCount;
    outSample.cpuDiffStats[i].idle = outSample.cpuDiffStats[i].idle / lookbackCount;
  }
  return outSample;
}

function pruneCpuSamples(cpuSamples: Dll<CpuSample>) {
  /*
    prune the oldest half of the whole interval
  */
  let midTimeStamp: number;
  if(cpuSamples.first?.val === undefined) {
    throw new Error('cpuSamples.first is undefined during prune');
  }
  if(cpuSamples.last?.val === undefined) {
    throw new Error('cpuSamples.last is undefined during prund');
  }
  midTimeStamp = (
    cpuSamples.first.val.timestamp
    + ((cpuSamples.last.val.timestamp - cpuSamples.first.val.timestamp) / 2)
  );
  while(
    (cpuSamples.first !== undefined)
    && (cpuSamples.first.val.timestamp < midTimeStamp)
  ) {
    cpuSamples.popFront();
  }
}
