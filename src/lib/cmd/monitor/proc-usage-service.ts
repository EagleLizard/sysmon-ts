import { Dll } from '../../models/lists/dll';
import { DllNode } from '../../models/lists/dll-node';
import { MemUsageAggregate } from '../../models/monitor/mem-usage-aggregate';
import { MemUsageSample } from './sysmon-proc-usage-mon';

export class ProcUsageService {
  static getMemUsageAggregate(memSamples: Dll<MemUsageSample>): MemUsageAggregate {
    let memUsageAgg: MemUsageAggregate;
    let currNode: DllNode<MemUsageSample> | undefined;

    let rssSum = 0;
    let heapTotalSum = 0;
    let heapUsedSum = 0;
    let externalSum = 0;
    let arrayBuffersSum = 0;

    let maxTimestamp = -Infinity;

    memUsageAgg = MemUsageAggregate.init();

    currNode = memSamples.first;
    while(currNode !== undefined) {
      let currMemSample: MemUsageSample;
      currMemSample = currNode.val;

      rssSum += currMemSample.memUsage.rss;
      heapTotalSum += currMemSample.memUsage.heapTotal;
      heapUsedSum += currMemSample.memUsage.heapUsed;
      externalSum += currMemSample.memUsage.external;
      arrayBuffersSum += currMemSample.memUsage.arrayBuffers;

      memUsageAgg.rss.min = Math.min(memUsageAgg.rss.min, currMemSample.memUsage.rss);
      memUsageAgg.heapTotal.min = Math.min(memUsageAgg.heapTotal.min, currMemSample.memUsage.heapTotal);
      memUsageAgg.heapUsed.min = Math.min(memUsageAgg.heapUsed.min, currMemSample.memUsage.heapUsed);
      memUsageAgg.external.min = Math.min(memUsageAgg.external.min, currMemSample.memUsage.external);
      memUsageAgg.arrayBuffers.min = Math.min(memUsageAgg.arrayBuffers.min, currMemSample.memUsage.arrayBuffers);

      memUsageAgg.rss.max = Math.max(memUsageAgg.rss.max, currMemSample.memUsage.rss);
      memUsageAgg.heapTotal.max = Math.max(memUsageAgg.heapTotal.max, currMemSample.memUsage.heapTotal);
      memUsageAgg.heapUsed.max = Math.max(memUsageAgg.heapUsed.max, currMemSample.memUsage.heapUsed);
      memUsageAgg.external.max = Math.max(memUsageAgg.external.max, currMemSample.memUsage.external);
      memUsageAgg.arrayBuffers.max = Math.max(memUsageAgg.arrayBuffers.max, currMemSample.memUsage.arrayBuffers);

      maxTimestamp = Math.max(maxTimestamp, currMemSample.timestamp);

      currNode = currNode.next;
    }

    if(maxTimestamp !== memSamples.last?.val.timestamp) {
      throw new Error('asdaasd');
    }

    memUsageAgg.rss.avg = rssSum / memSamples.length;
    memUsageAgg.heapTotal.avg = heapTotalSum / memSamples.length;
    memUsageAgg.heapUsed.avg = heapUsedSum / memSamples.length;
    memUsageAgg.external.avg = externalSum / memSamples.length;
    memUsageAgg.arrayBuffers.avg = arrayBuffersSum / memSamples.length;

    return memUsageAgg;
  }
}
