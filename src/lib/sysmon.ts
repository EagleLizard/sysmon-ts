
import { SYSMON_COMMAND_ENUM, parseSysmonArgs } from './cmd/sysmon-args';
import { isString } from './util/validate-primitives';
import { scanDirMain } from './cmd/scan-dir/scan-dir';
import { pingMain } from './cmd/ping/ping';

export async function sysmonMain() {
  const cmd = parseSysmonArgs();
  console.log(cmd);
  console.log(cmd.opts);
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
    default:
      throw new Error(`unhandled command kind: ${cmd.kind}`);
  }
}

