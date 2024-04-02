
import os, { CpuInfo } from 'os';

import { EventRegistry } from '../../util/event-registry';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { Dll, DllNode } from '../../models/dll';

let monitorDeregisterCb: () => void = () => undefined;
let stopMonitorLoopCb: () => void = () => undefined;
let elapsedMs = 0;

// const SAMPLE_INTERVAL_MS = 1e3;
// const SAMPLE_INTERVAL_MS = 500;
// const SAMPLE_INTERVAL_MS = 25;
const SAMPLE_INTERVAL_MS = 10;

// const FPS = 6;
// const DRAW_INTERVAL_MS = Math.floor(1000 / FPS);
// const DRAW_INTERVAL_MS = 1.5e3;
const DRAW_INTERVAL_MS = 200;

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
  let cpuSamples: Dll<[ number, CpuInfo[] ]>;
  let lastSample: [ number, CpuInfo[] ] | undefined;
  let drawTimer: Timer;
  let drawCount: number;
  let sampleCount: number;
  cpuSamples = new Dll();
  elapsedTimer = Timer.start();
  printTimer = Timer.start();
  drawTimer = Timer.start();
  drawCount = 0;
  sampleCount = 0;
  return (evt: MonitorEventData) => {
    /*
      see: https://stackoverflow.com/a/36823972
    */
    let diffStats: CpuDiffStat[];
    sampleCount++;
    // lastSample = cpuSamples[cpuSamples.length - 1];
    lastSample = cpuSamples.last?.val;
    cpus = os.cpus();
    cpuSamples.push([
      Date.now(),
      cpus,
    ]);
    const MAX_CPU_SAMPLES = 1e5;
    if(cpuSamples.length > MAX_CPU_SAMPLES) {
      let sampleCountDiff = cpuSamples.length - MAX_CPU_SAMPLES;
      let toPrune = Math.ceil(MAX_CPU_SAMPLES / 32);
      console.log({ sampleCountDiff });
      console.log({ cpuSamplesLength: cpuSamples.length });
      console.log('!!!! PRUNE !!!!');
      // cpuSamples.splice(0, toPrune);
      let prunedCount = 0;
      while(prunedCount++ < toPrune) {
        cpuSamples.popFront();
      }
      // cpuSamples.splice(0, toPrune);
      console.log({ cpuSamplesLength: cpuSamples.length });
    }
    elapsedMs = elapsedTimer.currentMs();
    if(
      (lastSample !== undefined)
      && (drawTimer.currentMs() >= DRAW_INTERVAL_MS)
    ) {
      console.log({
        drawTimerMs: drawTimer.currentMs(),
      });
      drawTimer.reset();
      drawCount++;
      let memUsage: NodeJS.MemoryUsage;
      memUsage = process.memoryUsage();
      console.log(`elapsed: ${getIntuitiveTimeString(elapsedMs)}`);
      console.log({ DRAW_INTERVAL_MS });
      console.log({ SAMPLE_INTERVAL_MS });
      console.log({ drawCount });
      // console.log({ sampleCount });
      console.log({ cpuSamplesLength: cpuSamples.length });
      console.log(`rss: ${getIntuitiveByteString(memUsage.rss) }`);
      console.log(`heapTotal: ${getIntuitiveByteString(memUsage.heapTotal) }`);
      console.log(`heapUsed: ${getIntuitiveByteString(memUsage.heapUsed) }`);
      // console.log(`external: ${getIntuitiveByteString(memUsage.external) }`);
      // console.log(`arrayBuffers: ${getIntuitiveByteString(memUsage.arrayBuffers) }`);
      console.log('');
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
    }, SAMPLE_INTERVAL_MS);
  }
}
