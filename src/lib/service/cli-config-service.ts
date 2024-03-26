
import fs from 'fs';

import { SYSMON_CONFIG_DIR_PATH, SYSMON_CONFIG_FILE_PATH } from '../../constants';
import { checkDir } from '../util/files';
import { SysmonCliConfig } from '../models/sysmon-cli-config';

export class CliConfigService {
  static getConfig(): SysmonCliConfig {
    let cfgDirExists: boolean;
    let cfgFileExists: boolean;
    let cfg: SysmonCliConfig;
    // check to see if config directory exists
    cfgDirExists = checkDir(SYSMON_CONFIG_DIR_PATH);
    // if not, make it
    if(!cfgDirExists) {
      fs.mkdirSync(SYSMON_CONFIG_DIR_PATH);
    }
    // check if config file exists
    cfgFileExists = fs.existsSync(SYSMON_CONFIG_FILE_PATH);
    // if not, initialize it
    if(cfgFileExists) {
      // load the file
      let cfgFileBuf = fs.readFileSync(SYSMON_CONFIG_FILE_PATH);
      let rawCfg: unknown = JSON.parse(cfgFileBuf.toString());
      cfg = SysmonCliConfig.deserialize(rawCfg);
    } else {
      // init the config
      cfg = initCliConfig();
      // save the initialized config
      CliConfigService.saveConfig(cfg);
    }

    return cfg;
  }

  static saveConfig(cfg: SysmonCliConfig) {
    let cfgCopy: SysmonCliConfig;
    let cfgStr: string;
    let last_modified: number;
    last_modified = Date.now();
    cfgCopy = SysmonCliConfig.deserialize({
      ...cfg,
    });
    cfgCopy.last_modified = last_modified;
    cfgStr = JSON.stringify(cfgCopy);
    fs.writeFileSync(SYSMON_CONFIG_FILE_PATH, cfgStr);
  }
}

function initCliConfig(): SysmonCliConfig {
  let created_at: number;
  let last_modified: number;
  let initCfg: SysmonCliConfig;
  created_at = Date.now();
  last_modified = Date.now();
  initCfg = new SysmonCliConfig(created_at, last_modified);
  return initCfg;
}
