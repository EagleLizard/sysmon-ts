import os, { CpuInfo } from 'os';
import { CpuStat, MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { MonitorUtil } from '../../util/monitor-util';
import { Dll } from '../../models/lists/dll';
import { getIntuitiveByteString } from '../../util/format-util';
import { Timer } from '../../util/timer';

const MAX_MEM_USAGE_SAMPLES = 1e3;

type MemUsageSample = {
  timestamp: number,
  memUsage: NodeJS.MemoryUsage;
}

export function getProcCpuUsageMon() {
  let monRet: MonitorReturnValue;
  let lastUsage: NodeJS.CpuUsage;
  let lastCpus: CpuInfo[];
  let lastSysCpuTime: number;

  let memUsageSamples: Dll<MemUsageSample>;
  let memUsageSampleTimer: Timer;
  let currMemUsage: NodeJS.MemoryUsage;

  memUsageSamples = new Dll();

  memUsageSamples.push({
    timestamp: Date.now(),
    memUsage: process.memoryUsage(),
  });

  currMemUsage = process.memoryUsage();

  lastUsage = process.cpuUsage();
  lastCpus = os.cpus();

  memUsageSampleTimer = Timer.start();

  return (evt: MonitorEventData) => {
    let currProcPercOutVal: string;
    let totalMsOutVal: string;
    let currUsage: NodeJS.CpuUsage;
    let currCpus: CpuInfo[];
    let currSysCpuTime: number;

    let currProcPerc: number;
    let userMs: number;
    let systemMs: number;
    let totalMs: number;

    

    currUsage = process.cpuUsage(lastUsage);
    userMs = currUsage.user / 1e3;
    systemMs = currUsage.system / 1e3;
    totalMs = userMs + systemMs;

    currCpus = os.cpus();
    lastSysCpuTime = lastCpus.reduce((acc, curr) => {
      let currStat: CpuStat;
      currStat = MonitorUtil.getCpuStat(curr);
      return acc + currStat.total;
    }, 0);
    currSysCpuTime = currCpus.reduce((acc, curr) => {
      let currStat: CpuStat;
      currStat = MonitorUtil.getCpuStat(curr);
      return acc + currStat.total;
    }, 0);

    currProcPerc = (
      totalMs / (
        (currSysCpuTime - lastSysCpuTime) /  currCpus.length
      )
    );

    lastUsage = currUsage;
    currProcPercOutVal = (currProcPerc * 100).toFixed(3);
    totalMsOutVal = (totalMs).toFixed(3);

    /* memory usage logic */

    if(memUsageSampleTimer.currentMs() > 0) {
      memUsageSampleTimer.reset();
      currMemUsage = process.memoryUsage();
      memUsageSamples.push({
        timestamp: Date.now(),
        memUsage: currMemUsage,
      });
      if(memUsageSamples.length > MAX_MEM_USAGE_SAMPLES) {
        pruneMemUsageSamples(memUsageSamples);
      }
    }


    let logCb = () => {
      let rss: number;
      let heapTotal: number;
      let heapUsed: number;

      rss = currMemUsage.rss;
      heapTotal = currMemUsage.heapTotal;
      heapUsed = currMemUsage.heapUsed;
      console.log({ memUsageSampleCount: memUsageSamples.length });
      console.log(`rss: ${getIntuitiveByteString(rss)}`);
      console.log(`heapTotal: ${getIntuitiveByteString(heapTotal)}`);
      console.log(`heapUsed: ${getIntuitiveByteString(heapUsed)}`);

      console.log(`${process.title} cpu usage: ${currProcPercOutVal}%`);
      // console.log(`cpu total usage: ${totalMsOutVal} ms`);
    };

    monRet = {
      logCb,
    };
    return monRet;
  };
}

function pruneMemUsageSamples(samples: Dll<MemUsageSample>) {
  /*
    prune the oldest half of the whole interval
  */
  let midTimeStamp: number;
  if(samples.first?.val === undefined) {
    throw new Error('memUsageSamples.first is undefined during prune');
  }
  if(samples.last?.val === undefined) {
    throw new Error('memUsageSamples.last is undefined during prund');
  }
  let firstMs: number;
  let lastMs: number;
  firstMs = samples.first.val.timestamp;
  lastMs = samples.last.val.timestamp;
  midTimeStamp = firstMs + ((lastMs - firstMs) / 2);
  while(
    (samples.first !== undefined)
    && (samples.first.val.timestamp < midTimeStamp)
  ) {
    samples.popFront();
  }
}
