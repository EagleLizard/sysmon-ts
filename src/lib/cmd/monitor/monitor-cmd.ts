
import { EventRegistry } from '../../util/event-registry';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { MONITOR_OUT_DATA_DIR_PATH } from '../../../constants';
import { mkdirIfNotExist } from '../../util/files';
import { MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { getDebugInfoMon } from './debug-info-mon';
import { getCpuMon } from './cpu-mon';
import { logger } from '../../logger';
import { MonitorOpts, getMonitorOpts } from '../parse-sysmon-args';
import { ParsedArgv2 } from '../parse-argv';

let monitorDeregisterCb: () => void = () => undefined;
let stopMonitorLoopCb: () => void = () => undefined;
let elapsedMs = 0;

const DRAW_INTERVAL_MS = 200;
// const DRAW_INTERVAL_MS = 1000;
const DEFAULT_INTERVAL_MS = 1e3;

export async function monitorCmdMain(parsedArgv: ParsedArgv2) {
  let opts: MonitorOpts;
  let evtRegistry: EventRegistry<MonitorEventData>;

  opts = getMonitorOpts(parsedArgv.opts);
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
}

export function killRunningMonitor() {
  let killStr: string;
  killStr = `Killing monitor, elapsed: ${getIntuitiveTimeString(elapsedMs)}`;
  logger.info(killStr);

  monitorDeregisterCb();
  stopMonitorLoopCb();
}

function setMonitorProcName() {
  process.title = `${process.title}_mon`;
}

function getMonMain(cmdOpts: MonitorOpts) {
  let logTimer: Timer;
  let debugInfoMon: (evt: MonitorEventData) => MonitorReturnValue;
  let cpuMon: (evt: MonitorEventData) => MonitorReturnValue;

  logTimer = Timer.start();

  debugInfoMon = getDebugInfoMon(cmdOpts, DRAW_INTERVAL_MS);
  cpuMon = getCpuMon(cmdOpts);

  for(let i = 0; i < process.stdout.rows; ++i) {
    console.log('');
  }

  return (evt: MonitorEventData) => {
    let debugInfoMonRes = debugInfoMon(evt);
    let cpuMonRes = cpuMon(evt);

    if(logTimer.currentMs() > DRAW_INTERVAL_MS) {
      console.clear();
      console.log({ logTimerMs: logTimer.currentMs() });
      logTimer.reset();

      debugInfoMonRes.logCb();
      cpuMonRes.logCb();
    }
  };
}

async function startMonLoop(eventRegistry: EventRegistry<MonitorEventData>, cmdOpts: MonitorOpts) {
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
      monLoop()
        .catch(err => {
          console.error(err);
          throw err;
        });
    }, (cmdOpts.sample_interval ?? DEFAULT_INTERVAL_MS));
  }
}
