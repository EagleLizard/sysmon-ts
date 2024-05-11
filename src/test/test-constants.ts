
import path from 'path';
import { BASE_DIR } from '../constants';

const EZD_TEST_DIR_NAME = '_ezd-test_';
export const EZD_TEST_DIR_PATH = [
  BASE_DIR,
  EZD_TEST_DIR_NAME,
].join(path.sep);

const SCAN_DIR_TEST_DIR_NAME = 'scan-dir';
export const SCAN_DIR_TEST_DIR_PATH = [
  EZD_TEST_DIR_PATH,
  SCAN_DIR_TEST_DIR_NAME,
].join(path.sep);
