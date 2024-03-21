
import { SYSMON_COMMAND_ENUM, parseSysmonArgs } from './cmd/sysmon-args';
import { isString } from './util/validate-primitives';
import { scanDirMain } from './cmd/scan-dir/scan-dir';
import { pingMain } from './cmd/ping/ping';
import { adminMain } from './cmd/admin/admin-cmd';
import { speedtestMain } from './cmd/speedtest/speedtest';
import { tNineMain } from './cmd/t-nine/t-nine';

export async function sysmonMain() {
  const cmd = parseSysmonArgs();
  console.log('cmd:');
  console.log(cmd);
  console.log('cmd.opts:');
  console.log(cmd.opts);
  // console.log(JSON.stringify(cmd, null, 2));
  switch(cmd.kind) {
    case SYSMON_COMMAND_ENUM.SCAN_DIR:
      if(!Array.isArray(cmd.args)) {
        throw new Error(`Unexpected ${cmd.command} dir arg type: expected 'string', found ${typeof cmd.args}`);
      }
      if(!cmd.args.every(arg => isString(arg))) {
        throw new Error(`Unexpected ${cmd.command} dir arg type: expected 'string[]', found ${cmd.args.map(arg => typeof arg)}`);
      }
      await scanDirMain(cmd);
      break;
    case SYSMON_COMMAND_ENUM.PING:
      await pingMain(cmd);
      break;
    case SYSMON_COMMAND_ENUM.ADMIN:
      await adminMain(cmd);
      break;
    case SYSMON_COMMAND_ENUM.SPEEDTEST:
      await speedtestMain(cmd);
      break;
    case SYSMON_COMMAND_ENUM.T_NINE:
      await tNineMain(cmd);
      break;
    default:
      throw new Error(`unhandled command kind: ${cmd.kind}`);
  }
}

