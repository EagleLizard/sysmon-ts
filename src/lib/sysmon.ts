
import { SYSMON_COMMAND_ENUM, parseSysmonArgs } from './cmd/sysmon-args';
import { isString } from './util/validate-primitives';
import { Timer } from './util/timer';
import { getIntuitiveTimeString } from './util/format-util';
import { Dirent, opendirSync, readdirSync } from 'fs';
import path from 'path';

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
}

type ScanDirResult = {
  dirs: string[];
  files: string[];
};

function scanDir(dirPath: string): ScanDirResult {
  let allDirs: string[];
  let allFiles: string[];

  let dirDirents: Dirent[];
  let fileDirents: Dirent[];

  let currDirents: Dirent[];
  let dirQueue: Dirent[];
  let currDirPath: string;

  currDirPath = dirPath;
  currDirents = readdirSync(dirPath, {
    withFileTypes: true
  });

  dirQueue = [
    ...currDirents
  ];

  dirDirents = [];
  fileDirents = [];

  while(dirQueue.length > 0) {
    let rootDirent: Dirent;
    rootDirent = dirQueue.shift()!;
    currDirPath = [
      rootDirent.path,
      rootDirent.name
    ].join(path.sep);
    if(rootDirent.isDirectory()) {
      currDirents = readdirSync(currDirPath, {
        withFileTypes: true,
      });
      dirDirents.push(rootDirent);
      currDirents.forEach(currDirent => {
        dirQueue.push(currDirent);
      });
    } else {
      fileDirents.push(rootDirent);
    }
  }

  allDirs = dirDirents.map(dirDirent => {
    return [
      dirDirent.path,
      dirDirent.name
    ].join(path.sep);
  });
  allFiles = fileDirents.map(fileDirent => {
    return [
      fileDirent.path,
      fileDirent.name
    ].join(path.sep);
  });

  // allDirs = [];
  // allFiles = [];
  return {
    dirs: allDirs,
    files: allFiles,
  };
}
