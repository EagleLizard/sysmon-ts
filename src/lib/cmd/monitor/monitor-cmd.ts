
import os, { CpuInfo } from 'os';
import fs, { WriteStream } from 'fs';
import path from 'path';

import { EventRegistry } from '../../util/event-registry';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { Dll, initializeDllNodePool } from '../../models/dll';
import { MAX_CPU_SAMPLES, MONITOR_OUT_DATA_DIR_PATH } from '../../../constants';
import { getDebugDateTimeStr, getLexicalDateTimeStr } from '../../util/datetime-util';
import { mkdirIfNotExist } from '../../util/files';

let monitorDeregisterCb: () => void = () => undefined;
let stopMonitorLoopCb: () => void = () => undefined;
let elapsedMs = 0;
let _memUsage = process.memoryUsage();
let drawCount = 0;
let sampleCount = 0;
let pruneCount = 0;

// const SAMPLE_INTERVAL_MS = 1e3;
// const SAMPLE_INTERVAL_MS = 500;
// const SAMPLE_INTERVAL_MS = 25;
const SAMPLE_INTERVAL_MS = 5;

// const FPS = 6;
// const DRAW_INTERVAL_MS = Math.floor(1000 / FPS);
// const DRAW_INTERVAL_MS = 1.5e3;
// const DRAW_INTERVAL_MS = 200;
const DRAW_INTERVAL_MS = 1e3;

const startDate = new Date();

// function numToBase64(n: number) {
//   let nBytes = Math.ceil(Math.log2(n + 1) / 8);
//   console.log({ nBytes });
//   let buf = Buffer.alloc(nBytes);
//   buf.writeUintBE(n, 0, nBytes);
//   return buf.toString('base64');
// }

const DEBUG_MON_FILE_NAME = `${getLexicalDateTimeStr(startDate)}_debugmon.txt`;
const DEBUG_MON_FILE_PATH  = [
  MONITOR_OUT_DATA_DIR_PATH,
  DEBUG_MON_FILE_NAME,
].join(path.sep);

let debugMonWs: WriteStream | undefined;

type MonitorEventData = {
  //
};

type CpuSample = {
  timestamp: number,
  cpus: CpuInfo[],
};

export async function monitorCmdMain(cmd: SysmonCommand) {
  let evtRegistry: EventRegistry<MonitorEventData>;

  initMon();

  evtRegistry = new EventRegistry(false);
  monitorDeregisterCb = evtRegistry.register(getDoMon());
  stopMonitorLoopCb = await startMonLoop(evtRegistry);
}

function initMon() {
  setMonitorProcName();
  mkdirIfNotExist(MONITOR_OUT_DATA_DIR_PATH);
  debugMonWs = fs.createWriteStream(DEBUG_MON_FILE_PATH, {
    flags: 'a',
  });
  initializeDllNodePool(MAX_CPU_SAMPLES);
  debugLine('');
  debugLine(startDate.toISOString());
  debugLine('!'.repeat(100));
}

export function killRunningMonitor() {
  let killStr: string;
  killStr = `Killing monitor, elapsed: ${getIntuitiveTimeString(elapsedMs)}`;
  console.log(killStr);
  debugLine(killStr);
  logDebugInfo();

  monitorDeregisterCb();
  stopMonitorLoopCb();
}

function setMonitorProcName() {
  process.title = `${process.title}_mon`;
}

function getDoMon() {
  let cpus: CpuInfo[];
  let elapsedTimer: Timer;
  let debugTimer: Timer;
  let cpuSamples: Dll<[ number, CpuInfo[] ]>;
  let lastSample: [ number, CpuInfo[] ] | undefined;
  let drawTimer: Timer;

  cpuSamples = new Dll();
  elapsedTimer = Timer.start();
  debugTimer = Timer.start();
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

    if(cpuSamples.length > MAX_CPU_SAMPLES) {
      let sampleCountDiff = cpuSamples.length - MAX_CPU_SAMPLES;
      let toPrune = Math.ceil(MAX_CPU_SAMPLES / 32);
      console.log({ sampleCountDiff });
      console.log({ cpuSamplesLength: cpuSamples.length });
      console.log('!!!! PRUNE !!!!');
      debugLine(`sampleCountDiff: ${sampleCountDiff}`);
      debugLine(`cpuSamplesLength: ${cpuSamples.length}`);
      debugLine('!!!! PRUNE !!!!');

      pruneCount++;
      // cpuSamples.splice(0, toPrune);
      let numPruned = 0;
      while(numPruned++ < toPrune) {
        cpuSamples.popFront();
      }

      // cpuSamples.splice(0, toPrune);
      console.log({ cpuSamplesLength: cpuSamples.length });
      console.log({ pruneCount });
      debugLine(`cpuSamplesLength: ${cpuSamples.length}`);
      debugLine(`pruneCount: ${pruneCount}`);
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
      memUsage = getMemUsage();
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
    if(debugTimer.currentMs() > (1e3 * 60)) {
      setImmediate(() => {
        logDebugInfo();
      });
      debugTimer.reset();
    }
  };
}

function debugLine(data: string | Buffer | Uint8Array) {
  if(debugMonWs === undefined) {
    throw new Error('Attempt to call debugMonWs.write() before wrtiestream initialized');
  }
  debugMonWs.write(data);
  debugMonWs.write('\n');
}

function getMemUsage(): NodeJS.MemoryUsage {
  _memUsage = process.memoryUsage();
  return _memUsage;
}

function logDebugInfo() {
  let timeStr: string;
  let nowDate: Date;
  nowDate = new Date;
  timeStr = getDebugDateTimeStr(nowDate);
  debugLine('');
  debugLine(timeStr);
  debugLine('-'.repeat(timeStr.length));
  debugLine(`elapsedMs: ${elapsedMs}`);
  debugLine('');
  debugLine(`cpu_sampleCount: ${sampleCount}`);
  debugLine(`drawCount: ${drawCount}`);
  debugLine('');
  debugLine(`rss: ${getIntuitiveByteString(_memUsage.rss) }`);
  debugLine(`heapTotal: ${getIntuitiveByteString(_memUsage.heapTotal) }`);
  debugLine(`heapUsed: ${getIntuitiveByteString(_memUsage.heapUsed) }`);
  debugLine('');
  debugLine(`pruneCount: ${pruneCount}`);
  // debugLine(`external: ${getIntuitiveByteString(_memUsage.external) }`);
  // debugLine(`arrayBuffers: ${getIntuitiveByteString(_memUsage.arrayBuffers) }`);
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
