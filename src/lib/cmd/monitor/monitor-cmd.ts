
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
import { DllNode } from '../../models/lists/dll-node';
import { MonitorCmdOpts, getMonitorOpts } from './monitor-cmd-opts';
import { CpuDiffStat, CpuStat, MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { MonitorUtil } from '../../util/monitor-util';
import { getProcCpuUsageMon } from './sysmon-proc-usage-mon';
import { getDebugInfoMon, getDrawCount } from './debug-info-mon';

let monitorDeregisterCb: () => void = () => undefined;
let stopMonitorLoopCb: () => void = () => undefined;
let elapsedMs = 0;
let _memUsage = process.memoryUsage();
let pruneCount = 0;

const NUM_CPUS = os.cpus().length;
// const MAX_CPU_SAMPLES = 1e3;
const CPU_OUT_SCALE = 30;

// const SAMPLE_INTERVAL_MS = 1e3;
// const SAMPLE_INTERVAL_MS = 500;
// const SAMPLE_INTERVAL_MS = 100;
// const SAMPLE_INTERVAL_MS = 25;
// const SAMPLE_INTERVAL_MS = 10;
// const SAMPLE_INTERVAL_MS = 5;
// const SAMPLE_INTERVAL_MS = 0;

const DRAW_INTERVAL_MS = 200;
// const DRAW_INTERVAL_MS = 1000;
const DEBUG_TIMER_INTERVAL_MS = (1e3 * 60);

const startDate = new Date();

const DEBUG_MON_FILE_NAME = `${getLexicalDateTimeStr(startDate)}_debugmon.txt`;
const DEBUG_MON_FILE_PATH  = [
  MONITOR_OUT_DATA_DIR_PATH,
  DEBUG_MON_FILE_NAME,
].join(path.sep);

let debugMonWs: WriteStream | undefined;

type CpuSample = {
  timestamp: number,
  cpuDiffStats: CpuDiffStat[],
};

export async function monitorCmdMain(cmd: SysmonCommand) {
  let evtRegistry: EventRegistry<MonitorEventData>;
  let opts: MonitorCmdOpts;
  opts = getMonitorOpts(cmd);
  console.log({ opts });

  initMon();

  evtRegistry = new EventRegistry(false);
  // monitorDeregisterCb = evtRegistry.register(getDoMon());
  monitorDeregisterCb = evtRegistry.register(getMonMain(opts));
  stopMonitorLoopCb = await startMonLoop(evtRegistry, opts);
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

function getMonMain(cmdOpts: MonitorCmdOpts) {
  let logTimer: Timer;
  let debugTimer: Timer;
  let monitorFns: ((evt: MonitorEventData) => MonitorReturnValue)[];
  logTimer = Timer.start();
  debugTimer = Timer.start();

  monitorFns = [
    getDebugInfoMon(cmdOpts, DRAW_INTERVAL_MS),
    getCpuMon(cmdOpts),
    getProcCpuUsageMon(),
  ];

  for(let i = 0; i < process.stdout.rows; ++i) {
    console.log('');
  }

  return (evt: MonitorEventData) => {
    let monitorResults: MonitorReturnValue[];

    monitorResults = [];
    for(let i = 0; i < monitorFns.length; ++i) {
      monitorResults.push(monitorFns[i](evt));
    }

    if(logTimer.currentMs() > DRAW_INTERVAL_MS) {
      console.clear();
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

function getCpuMon(cmdOpts: MonitorCmdOpts) {
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
    let cpuSample: CpuSample;
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
    cpuSample = {
      timestamp: Date.now(),
      cpuDiffStats,
    };

    cpuSamples.push(cpuSample);

    doPrune = cpuSamples.length > cmdOpts.MAX_CPU_SAMPLES;
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

type CpuMonLogCbOpts = {
  cpuSamples: Dll<CpuSample>;
  totalCpuSampleCount: number;
};

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

function pruneCpuSamples(cpuSamples: Dll<CpuSample>) {
  /*
    prune the oldest half of the whole interval
  */
  let midTimeStamp: number;
  pruneCount++;
  if(cpuSamples.first?.val === undefined) {
    throw new Error('cpuSamples.first is undefined during prune');
  }
  if(cpuSamples.last?.val === undefined) {
    throw new Error('cpuSamples.last is undefined during prund');
  }
  debugLine('!!!!! PRUNE !!!!!');
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

function getAvgCpuSample(cpuSamples: Dll<CpuSample>, startMs: number): CpuSample {
  let outSample: CpuSample;
  if(cpuSamples.last === undefined) {
    throw new Error('cpuSamples.last is undefined');
  }
  let lookbackMs = 1e3;
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

function debugLine(data: string | Buffer | Uint8Array) {
  if(debugMonWs === undefined) {
    throw new Error('Attempt to call debugMonWs.write() before wrtiestream initialized');
  }
  debugMonWs.write(data);
  debugMonWs.write('\n');
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
  // debugLine(`cpu_sampleCount: ${sampleCount}`);
  debugLine(`drawCount: ${getDrawCount}`);
  debugLine('');
  debugLine(`rss: ${getIntuitiveByteString(_memUsage.rss) }`);
  debugLine(`heapTotal: ${getIntuitiveByteString(_memUsage.heapTotal) }`);
  debugLine(`heapUsed: ${getIntuitiveByteString(_memUsage.heapUsed) }`);
  debugLine('');
  debugLine(`pruneCount: ${pruneCount}`);
  // debugLine(`external: ${getIntuitiveByteString(_memUsage.external) }`);
  // debugLine(`arrayBuffers: ${getIntuitiveByteString(_memUsage.arrayBuffers) }`);
}

async function startMonLoop(eventRegistry: EventRegistry<MonitorEventData>, cmdOpts: MonitorCmdOpts) {
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
    }, cmdOpts.SAMPLE_INTERVAL_MS);
  }
}
