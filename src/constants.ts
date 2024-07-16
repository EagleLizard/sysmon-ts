
import os from 'os';
import path from 'path';

export const BASE_DIR = path.resolve(__dirname, '..');

const LOG_DIR_NAME = 'logs';
export const LOG_DIR_PATH = [
  BASE_DIR,
  LOG_DIR_NAME,
].join(path.sep);

const DATA_DIR_NAME = 'data';
export const DATA_DIR_PATH = [
  BASE_DIR,
  DATA_DIR_NAME,
].join(path.sep);

const OUT_DATA_DIR_NAME = 'out_data';
export const OUT_DATA_DIR_PATH = [
  BASE_DIR,
  OUT_DATA_DIR_NAME,
].join(path.sep);

const SCANDIR_OUT_DATA_DIR_NAME = 'scandir';
export const SCANDIR_OUT_DATA_DIR_PATH = [
  OUT_DATA_DIR_PATH,
  SCANDIR_OUT_DATA_DIR_NAME,
].join(path.sep);
const SCANDIR_FIND_DUPES_TMP_DIR_NAME = 'fd_tmp';
export const SCANDIR_FIND_DUPES_TMP_DIR = [
  SCANDIR_OUT_DATA_DIR_PATH,
  SCANDIR_FIND_DUPES_TMP_DIR_NAME,
].join(path.sep);

const BASE_CONFIG_DIR_PATH = [
  os.homedir(),
  '.config',
].join(path.sep);
const SYSMON_CONFIG_DIR_NAME = 'sysmon-ezd';
const SYSMON_CONFIG_FILE_NAME = 'sysmon-ezd-cfg.json';

export const SYSMON_CONFIG_DIR_PATH = [
  BASE_CONFIG_DIR_PATH,
  SYSMON_CONFIG_DIR_NAME,
].join(path.sep);
export const SYSMON_CONFIG_FILE_PATH = [
  SYSMON_CONFIG_DIR_PATH,
  SYSMON_CONFIG_FILE_NAME,
].join(path.sep);

const MONITOR_OUT_DATA_DIR_NAME = 'monitor';
export const MONITOR_OUT_DATA_DIR_PATH = [
  OUT_DATA_DIR_PATH,
  MONITOR_OUT_DATA_DIR_NAME,
].join(path.sep);

const ENCODE_OUT_DATA_DIR_NAME = 'encode';
export const ENCODE_OUT_DATA_DIR_PATH = [
  OUT_DATA_DIR_PATH,
  ENCODE_OUT_DATA_DIR_NAME,
].join(path.sep);
