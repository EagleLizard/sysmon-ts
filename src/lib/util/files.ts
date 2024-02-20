
import { Stats, mkdirSync, statSync } from 'fs';
import path from 'path';
import { isObject } from './validate-primitives';

export function getPathRelativeToCwd(filePath: string) {
  let cwd: string;
  let absolutePath: string;
  cwd = process.cwd();
  absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(cwd, filePath)
  ;
  return absolutePath;
}

export function checkDir(dirPath: string): boolean {
  let stats: Stats;
  try {
    stats = statSync(dirPath);
  } catch(e) {
    // if(e?.code === 'ENOENT') {
    if(isObject(e) && e.code === 'ENOENT') {
      return false;
    } else {
      throw e;
    }
  }
  return stats.isDirectory();
}

export function mkdirIfNotExist(dirPath: string) {
  let dirExists: boolean;
  dirExists = checkDir(dirPath);
  if(!dirExists) {
    mkdirSync(dirPath);
  }
}
