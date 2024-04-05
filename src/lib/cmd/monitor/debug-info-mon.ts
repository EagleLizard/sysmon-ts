
import { MonitorEventData, MonitorReturnValue } from '../../models/monitor/monitor-cmd-types';
import { getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import { MonitorCmdOpts } from './monitor-cmd-opts';

const elapsedTimer = Timer.start();
let monitorCount = 0;
let drawCount = 0;

export function getDebugInfoMon(cmdOpts: MonitorCmdOpts, DRAW_INTERVAL_MS: number) {
  drawCount = 0;
  monitorCount = 0;

  return (evt: MonitorEventData) => {
    let monRet: MonitorReturnValue;
    monitorCount++;
    const logCb = () => {
      let elapsedMs: number;
      elapsedMs = getElapsedMs();
      drawCount++;
      // console.log({ DRAW_INTERVAL_MS });
      console.log({ SAMPLE_INTERVAL_MS: cmdOpts.SAMPLE_INTERVAL_MS });
      console.log({ monitorCount });
      console.log(`elapsed: ${getIntuitiveTimeString(elapsedMs)}`);
      // console.log({ drawCount });
      console.log('');
    };
    monRet = {
      logCb,
    };
    return monRet;
  };
}

export function getElapsedMs(): number {
  return elapsedTimer.currentMs();
}

export function getDrawCount(): number {
  return drawCount;
}
