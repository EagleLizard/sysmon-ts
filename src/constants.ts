
import path from 'path';

export const BASE_DIR = path.resolve(__dirname, '..');

const DATA_DIR_NAME = 'data';
export const DATA_DIR_PATH = [
  BASE_DIR,
  DATA_DIR_NAME,
].join(path.sep);

