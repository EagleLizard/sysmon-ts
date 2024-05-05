
import { MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { Dll } from '../../models/lists/dll';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import { DllNode } from '../../models/lists/dll-node';
import { MonitorCmdOpts } from './monitor-cmd-opts';

type ProcCpuUsageMonOpts = {
  //
} & Pick<MonitorCmdOpts, 'SAMPLE_MAX'>;

export type MemUsageSample = {
  timestamp: number,
  memUsage: NodeJS.MemoryUsage;
}

export type ProcUsageMonResult = {
  getMemUsageSamples: (start: number) => Dll<MemUsageSample>;
} & MonitorReturnValue;

export function getProcUsageMon(opts: ProcCpuUsageMonOpts) {
  let monRet: ProcUsageMonResult;

  let memUsageSamples: Dll<MemUsageSample>;
  let memUsageSampleTimer: Timer;
  let currMemUsage: NodeJS.MemoryUsage;

  let totalMemSampleCount = 0;

  memUsageSamples = new Dll();

  memUsageSamples.push({
    timestamp: Date.now(),
    memUsage: process.memoryUsage(),
  });

  currMemUsage = process.memoryUsage();

  memUsageSampleTimer = Timer.start();

  return (evt: MonitorEventData) => {

    /* memory usage logic */

    if(memUsageSampleTimer.currentMs() > 0) {
      totalMemSampleCount++;
      memUsageSampleTimer.reset();
      currMemUsage = process.memoryUsage();
      memUsageSamples.push({
        timestamp: Date.now(),
        memUsage: currMemUsage,
      });
      if(memUsageSamples.length > opts.SAMPLE_MAX) {
        pruneMemUsageSamples(memUsageSamples);
      }
    }

    let logCb = () => {
      let rss: number;
      let heapTotal: number;
      let heapUsed: number;
      let lookbackMs: number;

      lookbackMs = 1e3;

      rss = currMemUsage.rss;
      heapTotal = currMemUsage.heapTotal;
      heapUsed = currMemUsage.heapUsed;

      // console.log({ totalMsOutVal });
      console.log({ memUsageSampleCount: memUsageSamples.length });
      // console.log(`rss (${getIntuitiveTimeString(lookbackMs)} avg): ${getIntuitiveByteString(avgMemSample.memUsage.rss)}`);
      console.log(`rss: ${getIntuitiveByteString(rss)}`);
      // console.log(`heapTotal: ${getIntuitiveByteString(heapTotal)}`);
      // console.log(`heapUsed: ${getIntuitiveByteString(heapUsed)}`);

      // console.log(`cpu total usage: ${totalMsOutVal} ms`);
    };

    const getMemUsageSamples = (start: number) => {
      return _getGetMemUsageSamples(memUsageSamples, start);
    };

    monRet = {
      logCb,
      getMemUsageSamples,
    };
    return monRet;
  };
}

function _getGetMemUsageSamples(samples: Dll<MemUsageSample>, start: number) {
  let currNode: DllNode<MemUsageSample> | undefined;
  let resultList: Dll<MemUsageSample>;
  // let resultSamples: MemUsageSample[];
  // resultSamples = [];

  resultList = new Dll();

  currNode = samples.last;

  while(
    (currNode !== undefined)
    && (currNode.val.timestamp > start)
  ) {
    resultList.pushFront(currNode.val);
    // resultSamples.push(currNode.val);
    currNode = currNode.prev;
  }

  // resultSamples.reverse();

  return resultList;

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
