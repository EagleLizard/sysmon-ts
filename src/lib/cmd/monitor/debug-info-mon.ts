
import { MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import { MonitorOpts } from '../parse-sysmon-args';

const elapsedTimer = Timer.start();
let monitorCount = 0;
let drawCount = 0;

export function getDebugInfoMon(cmdOpts: MonitorOpts, DRAW_INTERVAL_MS: number) {
  let currMem: NodeJS.MemoryUsage;
  let rssMax = -Infinity;
  let heapUsedMax = -Infinity;
  let heapTotalMax = -Infinity;
  let rssMin = Infinity;
  let heapUsedMin = Infinity;
  let heapTotalMin = Infinity;

  drawCount = 0;
  monitorCount = 0;

  return (evt: MonitorEventData) => {
    let monRet: MonitorReturnValue;

    monitorCount++;
    updateMemUsage();

    const logCb = () => {
      let elapsedMs: number;
      elapsedMs = getElapsedMs();
      drawCount++;
      // console.log({ DRAW_INTERVAL_MS });
      console.log({ SAMPLE_INTERVAL_MS: cmdOpts.sample_interval });
      console.log({ monitorCount });
      printMem();
      console.log(`elapsed: ${getIntuitiveTimeString(elapsedMs)}`);
      console.log('');
      // console.log({ drawCount });
    };

    monRet = {
      logCb,
    };
    return monRet;
  };

  function updateMemUsage() {
    currMem = process.memoryUsage();

    rssMax = Math.max(rssMax, currMem.rss);
    heapUsedMax = Math.max(heapUsedMax, currMem.heapUsed);
    heapTotalMax = Math.max(heapTotalMax, currMem.heapTotal);

    rssMin = Math.min(rssMin, currMem.rss);
    heapUsedMin = Math.min(heapUsedMin, currMem.heapUsed);
    heapTotalMin = Math.min(heapTotalMin, currMem.heapTotal);
  }

  function printMem() {
    let memStr: string;
    memStr = [
      `rss:       ${getMemStr(currMem.rss, rssMin, rssMax)}`,
      `heapUsed:  ${getMemStr(currMem.heapUsed, heapUsedMin, heapUsedMax)}`,
      `heapTotal: ${getMemStr(currMem.heapTotal, heapTotalMin, heapTotalMax)}`,
    ].join('\n');
    console.log(memStr);
  }
}

function getMemStr(curr: number, min: number, max: number): string {
  let str: string;
  str = [
    `${getIntuitiveByteString(curr)}`,
    `min: ${getIntuitiveByteString(min)}`,
    `max: ${getIntuitiveByteString(max)}`,
  ].join(', ');
  return str;
}

export function getElapsedMs(): number {
  return elapsedTimer.currentMs();
}

export function getDrawCount(): number {
  return drawCount;
}
