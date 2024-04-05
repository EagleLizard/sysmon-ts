
import { CpuInfo } from 'os';

export type MonitorEventData = {
  //
};

export type MonitorReturnValue = {
  logCb: () => void;
}

export type CpuDiffStat = {
  total: number,
  idle: number,
};

export type CpuStat = {
  total: number;
  idle: number;
  times: CpuInfo['times'];
};
