
import { scanDirCmdMain } from './cmd/scan-dir/scan-dir-cmd';
import { pingMain } from './cmd/ping/ping';
import { adminMain } from './cmd/admin/admin-cmd';
import { speedtestMain } from './cmd/speedtest/speedtest';
import { tNineMain } from './cmd/t-nine/t-nine';
import { monitorCmdMain } from './cmd/monitor/monitor-cmd';
import { pingStatsMain } from './cmd/ping/ping-stats';
import { encodeMain } from './cmd/encode/encode-cmd';
import { SYSMON_CMD_ENUM, getCmdKind } from './cmd/parse-sysmon-args';
import { parseArgv2 } from './cmd/parse-argv';
import { helpCmdMain } from './cmd/help/help-cmd';

export async function sysmonMain() {
  let parsedArgv = parseArgv2(process.argv);
  let cmdKind = getCmdKind(parsedArgv.cmd);
  switch(cmdKind) {
    case SYSMON_CMD_ENUM.PING:
      return await pingMain(parsedArgv);
    case SYSMON_CMD_ENUM.SCAN_DIR:
      return await scanDirCmdMain(parsedArgv);
    case SYSMON_CMD_ENUM.MONITOR:
      return await monitorCmdMain(parsedArgv);
    case SYSMON_CMD_ENUM.PING_STAT:
      return await pingStatsMain(parsedArgv);
    case SYSMON_CMD_ENUM.ADMIN:
      return await adminMain(parsedArgv, {
        logFn: console.log,
      });
    case SYSMON_CMD_ENUM.SPEEDTEST:
      return await speedtestMain();
    case SYSMON_CMD_ENUM.T_NINE:
      return await tNineMain(parsedArgv);
    case SYSMON_CMD_ENUM.ENCODE:
      return await encodeMain(parsedArgv);
    case SYSMON_CMD_ENUM.HELP:
      return await helpCmdMain();
  }
}
