
import os, { CpuInfo } from 'os';

import { EventRegistry } from '../../util/event-registry';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { getIntuitiveTimeString } from '../../util/format-util';

let monitorDeregisterCb: () => void = () => undefined;
let stopMonitorLoopCb: () => void = () => undefined;
let elapsedMs = 0;

// const INTERVAL_MS = 1e3;
const INTERVAL_MS = 500;
// const INTERVAL_MS = 125;

type MonitorEventData = {
  //
};

export async function monitorCmdMain(cmd: SysmonCommand) {
  let evtRegistry: EventRegistry<MonitorEventData>;
  setMonitorProcName();

  evtRegistry = new EventRegistry(false);
  monitorDeregisterCb = evtRegistry.register(getDoMon());
  stopMonitorLoopCb = await startMonLoop(evtRegistry);
}

export function killRunningMonitor() {
  console.log(`Killing monitor, elapsed: ${getIntuitiveTimeString(elapsedMs)}`);
  monitorDeregisterCb();
  stopMonitorLoopCb();
}

function setMonitorProcName() {
  process.title = `${process.title}_mon`;
}

function getDoMon() {
  let cpus: CpuInfo[];
  let elapsedTimer: Timer;
  let printTimer: Timer;
  let cpuSamples: [ number, CpuInfo[] ][];
  let lastSample: [ number, CpuInfo[] ] | undefined;
  cpuSamples = [];
  elapsedTimer = Timer.start();
  printTimer = Timer.start();
  return (evt: MonitorEventData) => {
    /*
      see: https://stackoverflow.com/a/36823972
    */
    let diffStats: CpuDiffStat[];
    lastSample = cpuSamples[cpuSamples.length - 1];
    cpus = os.cpus();
    cpuSamples.push([
      Date.now(),
      cpus,
    ]);
    elapsedMs = elapsedTimer.currentMs();
    if(lastSample !== undefined) {
      if(lastSample[1] === undefined) {
        console.error(lastSample);
        const err = new Error('unexpected last cpu sample');
        console.error(err);
        throw err;
      }
      // calculate the diff
      let stats1: CpuStat[];
      let stats2: CpuStat[];
      stats1 = lastSample[1].map(getCpuStat);
      stats2 = cpus.map(getCpuStat);
      diffStats = stats2.map((endStat, idx) => {
        let startStat: CpuStat;
        let total: number;
        let idle: number;
        let diffStat: CpuDiffStat;
        startStat = stats1[idx];
        total = endStat.total - startStat.total;
        idle = endStat.idle - startStat.idle;
        diffStat = {
          total,
          idle,
        };
        return diffStat;
      });
      diffStats.forEach(diffStat => {
        let percent: number;
        let outScale: number;
        let outNum: number;
        let outStr: string;
        percent = (diffStat.total === 0)
          ? 0
          : diffStat.idle / diffStat.total
        ;
        percent = 1 - percent;
        outNum = Math.round(percent * 10000) / 100;
        outScale = Math.round(percent * 20);
        outStr = `${'='.repeat(outScale)} ${outNum}`;
        console.log(outStr);
      });
      console.log('');
    }
    if(printTimer.currentMs() > 1e3) {
      // console.log(`cpuSamples: ${cpuSamples.length}`);
      printTimer.reset();
    }
  };
}

type CpuDiffStat = {
  total: number,
  idle: number,
};

type CpuStat = {
  total: number;
  idle: number;
  times: CpuInfo['times'];
};

/*
  see os-utils reference:
    https://github.com/oscmejia/os-utils/blob/master/lib/osutils.js
*/
function getCpuStat(cpuInfo: CpuInfo): CpuStat {
  let total: number;
  let idle: number;
  let times: CpuInfo['times'];
  let cpuStat: CpuStat;
  total = (
    cpuInfo.times.user
    + cpuInfo.times.nice
    + cpuInfo.times.sys
    + cpuInfo.times.idle
    + cpuInfo.times.irq
  );
  idle = cpuInfo.times.idle;
  times = cpuInfo.times;
  cpuStat = {
    total,
    idle,
    times,
  };
  return cpuStat;
}

async function startMonLoop(eventRegistry: EventRegistry<MonitorEventData>) {
  let loopTimer: Timer;
  let doMon: boolean;
  doMon = true;
  loopTimer = Timer.start();

  await monLoop();

  return () => {
    doMon = false;
  };

  async function monLoop() {
    await eventRegistry.trigger({
      elapsedMs: loopTimer.currentMs(),
    });
    setTimeout(() => {
      if(!doMon) {
        return;
      }
      monLoop();
    }, INTERVAL_MS);
  }
}
