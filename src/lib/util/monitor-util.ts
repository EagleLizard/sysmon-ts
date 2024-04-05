
import { CpuInfo } from 'os';
import { CpuDiffStat, CpuStat } from '../models/monitor/monitor-cmd-types';

export class MonitorUtil {
  static getCpuStat(cpuInfo: CpuInfo): CpuStat {
    return getCpuStat(cpuInfo);
  }
  static getCpuDiffStat(startStat: CpuStat, endStat: CpuStat): CpuDiffStat {
    return getCpuDiffStat(startStat, endStat);
  }
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
