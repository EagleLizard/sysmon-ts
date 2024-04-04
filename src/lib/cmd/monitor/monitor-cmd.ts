
import os, { CpuInfo } from 'os';
import fs, { WriteStream } from 'fs';
import path from 'path';

import { EventRegistry } from '../../util/event-registry';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { Dll } from '../../models/lists/dll';
import { MONITOR_OUT_DATA_DIR_PATH } from '../../../constants';
import { getDebugDateTimeStr, getLexicalDateTimeStr } from '../../util/datetime-util';
import { mkdirIfNotExist } from '../../util/files';

let monitorDeregisterCb: () => void = () => undefined;
let stopMonitorLoopCb: () => void = () => undefined;
let elapsedMs = 0;
let _memUsage = process.memoryUsage();
let drawCount = 0;
let sampleCount = 0;
let pruneCount = 0;

const NUM_CPUS = os.cpus().length;
const MAX_CPU_SAMPLES = 1e5;
const CPU_SAMPLE_PRUNE_MIN = 1e3;

// const SAMPLE_INTERVAL_MS = 1e3;
// const SAMPLE_INTERVAL_MS = 500;
const SAMPLE_INTERVAL_MS = 100;
// const SAMPLE_INTERVAL_MS = 25;
// const SAMPLE_INTERVAL_MS = 10;
// const SAMPLE_INTERVAL_MS = 5;
// const SAMPLE_INTERVAL_MS = 0;

// const FPS = 6;
// const DRAW_INTERVAL_MS = Math.floor(1000 / FPS);
// const DRAW_INTERVAL_MS = 1.5e3;
// const DRAW_INTERVAL_MS = 200;
const DRAW_INTERVAL_MS = 1e3;

const DEBUG_TIMER_INTERVAL_MS = (1e3 * 60);

const startDate = new Date();

const DEBUG_MON_FILE_NAME = `${getLexicalDateTimeStr(startDate)}_debugmon.txt`;
const DEBUG_MON_FILE_PATH  = [
  MONITOR_OUT_DATA_DIR_PATH,
  DEBUG_MON_FILE_NAME,
].join(path.sep);

let debugMonWs: WriteStream | undefined;

type MonitorEventData = {
  //
};
console.log();
type MonitorReturnValue = {
  logCb: () => void;
}

type CpuSample = {
  timestamp: number,
  cpuDiffStats: CpuDiffStat[],
};

export async function monitorCmdMain(cmd: SysmonCommand) {
  let evtRegistry: EventRegistry<MonitorEventData>;

  initMon();

  evtRegistry = new EventRegistry(false);
  // monitorDeregisterCb = evtRegistry.register(getDoMon());
  monitorDeregisterCb = evtRegistry.register(getMonMain());
  stopMonitorLoopCb = await startMonLoop(evtRegistry);
}

function initMon() {
  setMonitorProcName();
  mkdirIfNotExist(MONITOR_OUT_DATA_DIR_PATH);
  debugMonWs = fs.createWriteStream(DEBUG_MON_FILE_PATH, {
    flags: 'a',
  });
  debugLine('');
  logDebugHeader();
  debugLine(startDate.toISOString());
}

export function killRunningMonitor() {
  let killStr: string;
  let cpuUsage: NodeJS.CpuUsage;
  let totalCpuUsageMs: number;
  killStr = `Killing monitor, elapsed: ${getIntuitiveTimeString(elapsedMs)}`;
  logDebugHeader();
  logDebugInfo();
  console.log(killStr);
  debugLine(killStr);
  cpuUsage = process.cpuUsage();
  totalCpuUsageMs = (cpuUsage.user / 1e3) + (cpuUsage.system / 1e3);
  debugLine(`totalCpuUsageMs: ${totalCpuUsageMs}`);
  debugLine(`totalCpuUsage: ${getIntuitiveTimeString(totalCpuUsageMs)}`);

  monitorDeregisterCb();
  stopMonitorLoopCb();
}

function setMonitorProcName() {
  process.title = `${process.title}_mon`;
}

function getMonMain() {
  let logTimer: Timer;
  let debugTimer: Timer;
  let monitorFns: ((evt: MonitorEventData) => MonitorReturnValue)[];
  logTimer = Timer.start();
  debugTimer = Timer.start();

  monitorFns = [
    getDoMon(),
    getCpuMon(),
    getProcCpuUsageMon(),
  ];

  return (evt: MonitorEventData) => {
    let monitorResults: MonitorReturnValue[];

    monitorResults = [];
    for(let i = 0; i < monitorFns.length; ++i) {
      monitorResults.push(monitorFns[i](evt));
    }

    if(logTimer.currentMs() > DRAW_INTERVAL_MS) {
      console.log({ logTimerMs: logTimer.currentMs() });
      logTimer.reset();
      for(let i = 0; i < monitorResults.length; ++i) {
        monitorResults[i].logCb();
      }
    }
    if(debugTimer.currentMs() > DEBUG_TIMER_INTERVAL_MS) {
      debugTimer.reset();
      logDebugInfo();
      // for(let i = 0; i < monitorResults.length; ++i) {
      //   monitorResults[i].debugCb();
      // }
    }
  };
}

function getDoMon() {
  let elapsedTimer: Timer;

  let monRet: MonitorReturnValue;

  elapsedTimer = Timer.start();
  drawCount = 0;
  sampleCount = 0;
  return (evt: MonitorEventData) => {
    const logCb = () => {
      let memUsage: NodeJS.MemoryUsage;
      memUsage = getMemUsage();
      elapsedMs = elapsedTimer.currentMs();
      drawCount++;
      console.log(`elapsed: ${getIntuitiveTimeString(elapsedMs)}`);
      // console.log({ DRAW_INTERVAL_MS });
      // console.log({ SAMPLE_INTERVAL_MS });
      console.log({ drawCount });
      // console.log({ sampleCount });
      console.log(`rss: ${getIntuitiveByteString(memUsage.rss) }`);
      console.log(`heapTotal: ${getIntuitiveByteString(memUsage.heapTotal) }`);
      console.log(`heapUsed: ${getIntuitiveByteString(memUsage.heapUsed) }`);
      // console.log(`external: ${getIntuitiveByteString(memUsage.external) }`);
      // console.log(`arrayBuffers: ${getIntuitiveByteString(memUsage.arrayBuffers) }`);
      console.log('');
    };
    monRet = {
      logCb,
    };
    return monRet;
  };
}

function getProcCpuUsageMon() {
  let lastUsage: NodeJS.CpuUsage;
  let lastCpus: CpuInfo[];
  let lastSysCpuTime: number;

  let monRet: MonitorReturnValue;

  lastUsage = process.cpuUsage();
  lastCpus = os.cpus();

  return (evt: MonitorEventData) => {
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
      currStat = getCpuStat(curr);
      return acc + currStat.total;
    }, 0);
    currSysCpuTime = currCpus.reduce((acc, curr) => {
      let currStat: CpuStat;
      currStat = getCpuStat(curr);
      return acc + currStat.total;
    }, 0);

    currProcPerc = (
      totalMs / (
        (currSysCpuTime - lastSysCpuTime) /  currCpus.length
      )
    );

    lastUsage = currUsage;

    let logCb = () => {
      console.log(`${process.title} current usage: ${currProcPerc * 100}%`);
      console.log(`cpu total usage: ${totalMs} ms`);
    };

    monRet = {
      logCb,
    };
    return monRet;
  };
}

function getCpuMon() {
  let cpuSamples: Dll<CpuSample>;
  let lastCpuStats: CpuStat[];
  let totalCpuSampleCount: number;

  totalCpuSampleCount = 0;

  cpuSamples = new Dll();
  lastCpuStats = os.cpus().map(getCpuStat);

  return (evt: MonitorEventData) => {
    /*
      see: https://stackoverflow.com/a/36823972
    */
    let monitorRet: MonitorReturnValue;
    let currCpuInfos: CpuInfo[];
    let currCpuStats: CpuStat[];
    let cpuDiffStats: CpuDiffStat[];
    let cpuSample: CpuSample;
    let doPrune: boolean;

    doPrune = false;

    totalCpuSampleCount++;
    currCpuInfos = os.cpus();
    currCpuStats = currCpuInfos.map(getCpuStat);

    cpuDiffStats = [];
    for(let i = 0; i < lastCpuStats.length; ++i) {
      let startCpuStat: CpuStat;
      let endCpuStat: CpuStat;
      let currCpuDiffStat: CpuDiffStat;
      startCpuStat = lastCpuStats[i];
      endCpuStat = currCpuStats[i];
      currCpuDiffStat = getCpuDiffStat(startCpuStat, endCpuStat);
      cpuDiffStats.push(currCpuDiffStat);
    }
    cpuSample = {
      timestamp: Date.now(),
      cpuDiffStats,
    };

    cpuSamples.push(cpuSample);

    doPrune = cpuSamples.length > MAX_CPU_SAMPLES;
    if(doPrune) {
      let toPrune: number;
      let nPruned: number;
      pruneCount++;
      debugLine('!!!!! PRUNE !!!!!');
      toPrune = Math.max(
        Math.round(cpuSamples.length / 32),
        CPU_SAMPLE_PRUNE_MIN,
      );
      nPruned = 0;
      while(nPruned++ < toPrune) {
        cpuSamples.popFront();
      }
    }

    lastCpuStats = currCpuStats;

    const logCb = () => {
      let outSample: CpuSample;
      if(cpuSamples.last === undefined) {
        throw new Error('cpuSamples.last is undefined');
      }
      outSample = cpuSamples.last.val;
      console.log({ totalCpuSampleCount });
      console.log({ cpuSamplesLength: cpuSamples.length });
      for(let i = 0; i < outSample.cpuDiffStats.length; ++i) {
        let currDiffStat: CpuDiffStat;
        let perc;
        let outNum: number;
        let outScale: number;
        currDiffStat = outSample.cpuDiffStats[i];
        perc = (currDiffStat.total === 0)
          ? 0
          : currDiffStat.idle / currDiffStat.total
        ;
        perc = 1 - perc;
        outNum = Math.round(perc * 10000) / 100;
        outScale = Math.round(perc * 20);
        console.log(`${'='.repeat(outScale)} ${outNum}`);
      }
    };

    monitorRet = {
      logCb,
    };
    return monitorRet;
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

function logDebugHeader() {
  debugLine('!'.repeat(70));
}

function logDebugInfo() {
  let timeStr: string;
  let nowDate: Date;
  let elapsedStr: string;
  nowDate = new Date;
  timeStr = getDebugDateTimeStr(nowDate);
  elapsedStr = getIntuitiveTimeString(elapsedMs);
  debugLine('');
  debugLine('-'.repeat(timeStr.length));
  debugLine(timeStr);
  debugLine('-'.repeat(timeStr.length));
  debugLine(elapsedStr);
  debugLine(`${elapsedMs}ms`);
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

function getCpuDiffStat(startStat: CpuStat, endStat: CpuStat): CpuDiffStat {
  let diffStat: CpuDiffStat;
  let total: number;
  let idle: number;
  total = endStat.total - startStat.total;
  idle = endStat.idle - startStat.idle;
  diffStat = {
    total,
    idle,
  };
  return diffStat;
}

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
