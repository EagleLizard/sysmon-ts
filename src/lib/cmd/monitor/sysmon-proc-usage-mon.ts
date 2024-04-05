import os, { CpuInfo } from 'os';
import { CpuStat, MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd';
import { MonitorUtil } from '../../util/monitor-util';

export function getProcCpuUsageMon() {
  let lastUsage: NodeJS.CpuUsage;
  let lastCpus: CpuInfo[];
  let lastSysCpuTime: number;

  let monRet: MonitorReturnValue;

  lastUsage = process.cpuUsage();
  lastCpus = os.cpus();

  return (evt: MonitorEventData) => {
    let currProcPercOutVal: string;
    let totalMsOutVal: string;
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
      currStat = MonitorUtil.getCpuStat(curr);
      return acc + currStat.total;
    }, 0);
    currSysCpuTime = currCpus.reduce((acc, curr) => {
      let currStat: CpuStat;
      currStat = MonitorUtil.getCpuStat(curr);
      return acc + currStat.total;
    }, 0);

    currProcPerc = (
      totalMs / (
        (currSysCpuTime - lastSysCpuTime) /  currCpus.length
      )
    );

    lastUsage = currUsage;
    currProcPercOutVal = (currProcPerc * 100).toFixed(3);
    totalMsOutVal = (totalMs).toFixed(3);
    let logCb = () => {
      console.log(`${process.title} current usage: ${currProcPercOutVal}%`);
      console.log(`cpu total usage: ${totalMsOutVal} ms`);
    };

    monRet = {
      logCb,
    };
    return monRet;
  };
}
