
import { SYSMON_COMMAND_ENUM, parseSysmonArgs } from './cmd/sysmon-args';
import { isString } from './util/validate-primitives';
import { Timer } from './util/timer';
import { getIntuitiveTimeString } from './util/format-util';
import { Dirent, Stats, lstatSync, opendirSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { mkdirIfNotExist } from './util/files';
import { DATA_DIR_PATH } from '../constants';

export async function sysmonMain() {
  const cmd = parseSysmonArgs();
  console.log(cmd);
  switch(cmd.kind) {
    case SYSMON_COMMAND_ENUM.SCAN_DIR:
      if(!isString(cmd.arg)) {
        throw new Error(`Unexpected ${cmd.command} dir arg type: expected 'string', found ${typeof cmd.arg}`);
      }
      scanDirMain(cmd.arg);
      break;
    default:
      throw new Error(`unhandled command kind: ${cmd.kind}`);
  }
}

function scanDirMain(dirPath: string) {
  let scanDirResult: ScanDirResult;
  let timer: Timer;
  let scanMs: number;
  console.log(`Scanning: ${dirPath}`);
  timer = Timer.start();
  scanDirResult = scanDir(dirPath);
  scanMs = timer.stop();
  console.log(`files: ${scanDirResult.files.length}`);
  console.log(`dirs: ${scanDirResult.dirs.length}`);
  console.log(`Scan took: ${getIntuitiveTimeString(scanMs)}`);
  mkdirIfNotExist(DATA_DIR_PATH);
  const dirsDataFilePath = [
    DATA_DIR_PATH,
    'dirs.txt',
  ].join(path.sep);
  writeFileSync(dirsDataFilePath, scanDirResult.dirs.join('\n'));
}

type ScanDirResult = {
  dirs: string[];
  files: string[];
};

function scanDir(dirPath: string): ScanDirResult {
  let allDirs: string[];
  let allFiles: string[];

  let currDirents: Dirent[];
  let dirQueue: string[];
  let currDirPath: string;

  dirQueue = [
    dirPath,
  ];

  allDirs = [];
  allFiles = [];

  while(dirQueue.length > 0) {
    let rootDirent: Stats;
    currDirPath = dirQueue.shift()!;
    rootDirent = lstatSync(currDirPath);
    if(rootDirent.isDirectory()) {
      currDirents = readdirSync(currDirPath, {
        withFileTypes: true,
      });
      allDirs.push(currDirPath);
      currDirents.forEach(currDirent => {
        dirQueue.push([
          currDirent.path,
          currDirent.name,
        ].join(path.sep));
      });
    } else {
      allFiles.push(currDirPath);
    }
  }

  return {
    dirs: allDirs,
    files: allFiles,
  };
}
