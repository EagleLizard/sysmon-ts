
import fs, { WriteStream } from 'fs';
import path from 'path';

import { EventRegistry } from '../../util/event-registry';
import { Timer } from '../../util/timer';
import { SysmonCommand } from '../sysmon-args';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { MONITOR_OUT_DATA_DIR_PATH } from '../../../constants';
import { getDebugDateTimeStr, getLexicalDateTimeStr } from '../../util/datetime-util';
import { mkdirIfNotExist } from '../../util/files';
import { MonitorCmdOpts, getMonitorOpts } from './monitor-cmd-opts';
import { MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { MemUsageSample, ProcUsageMonResult, getProcUsageMon } from './sysmon-proc-usage-mon';
import { getDebugInfoMon, getDrawCount } from './debug-info-mon';
import { getCpuMon } from './cpu-mon';
import { DllNode } from '../../models/lists/dll-node';

let monitorDeregisterCb: () => void = () => undefined;
let stopMonitorLoopCb: () => void = () => undefined;
let elapsedMs = 0;
let _memUsage = process.memoryUsage();

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
  let logSampleTimer: Timer;
  let debugInfoMon: (evt: MonitorEventData) => MonitorReturnValue;
  let cpuMon: (evt: MonitorEventData) => MonitorReturnValue;
  let procUsageMon: (evt: MonitorEventData) => ProcUsageMonResult;

  let lastMemUsageTimestamp: number;
  let rssAvg = 0;
  let rssMin = Infinity;
  let rssMax = -Infinity;

  let totalMemSampleCount = 0;
  let logSampleIntervalMs = 1e3;

  lastMemUsageTimestamp = Date.now();

  logTimer = Timer.start();
  debugTimer = Timer.start();
  logSampleTimer = Timer.start();

  debugInfoMon = getDebugInfoMon(cmdOpts, DRAW_INTERVAL_MS);
  cpuMon = getCpuMon(cmdOpts);
  procUsageMon = getProcUsageMon(cmdOpts);

  for(let i = 0; i < process.stdout.rows; ++i) {
    console.log('');
  }

  return (evt: MonitorEventData) => {
    let debugInfoMonRes = debugInfoMon(evt);
    let cpuMonRes = cpuMon(evt);
    let procUsageMonRes = procUsageMon(evt);

    if(logTimer.currentMs() > DRAW_INTERVAL_MS) {
      console.clear();
      console.log({ logTimerMs: logTimer.currentMs() });
      logTimer.reset();

      debugInfoMonRes.logCb();
      cpuMonRes.logCb();
      procUsageMonRes.logCb();

      console.log(`rssAvg: ${getIntuitiveByteString(rssAvg)}`);
      console.log(`rssMin: ${getIntuitiveByteString(rssMin)}`);
      console.log(`rssMax: ${getIntuitiveByteString(rssMax)}`);
      // console.log({ totalMemSampleCount });
    }

    if(logSampleTimer.currentMs() >= logSampleIntervalMs) {
      logSampleTimer.reset();
      let memSamples = procUsageMonRes.getMemUsageSamples(lastMemUsageTimestamp);
      let maxTimestamp = -Infinity;
      let rssSum = 0;
      if(
        (memSamples.first === undefined)
        || (memSamples.last === undefined)
      ) {
        throw new Error('Attempt to get samples from empty list');
      }
      let currNode: DllNode<MemUsageSample> | undefined;
      currNode = memSamples.first;
      while(currNode !== undefined) {
        let currMemSample = currNode.val;
        totalMemSampleCount++;
        rssSum += currMemSample.memUsage.rss;
        rssMin = Math.min(rssMin, currMemSample.memUsage.rss);
        rssMax = Math.max(rssMax, currMemSample.memUsage.rss);
        maxTimestamp = Math.max(maxTimestamp, currMemSample.timestamp);
        currNode = currNode.next;
      }
      rssAvg = rssSum / memSamples.length;
      lastMemUsageTimestamp = memSamples.last.val.timestamp;
      if(lastMemUsageTimestamp !== maxTimestamp) {
        throw new Error('asdaasd');
      }
      // memSamples.$destroy();
    }

    if(debugTimer.currentMs() > DEBUG_TIMER_INTERVAL_MS) {
      debugTimer.reset();
      logDebugInfo();
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
  debugLine(`drawCount: ${getDrawCount()}`);
  debugLine('');
  debugLine(`rss: ${getIntuitiveByteString(_memUsage.rss) }`);
  debugLine(`heapTotal: ${getIntuitiveByteString(_memUsage.heapTotal) }`);
  debugLine(`heapUsed: ${getIntuitiveByteString(_memUsage.heapUsed) }`);
  debugLine('');
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
