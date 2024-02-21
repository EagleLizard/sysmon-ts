
import { SYSMON_COMMAND_ENUM, parseSysmonArgs } from './cmd/sysmon-args';
import { isString } from './util/validate-primitives';
import { Timer } from './util/timer';
import { getIntuitiveTimeString } from './util/format-util';
import { Dirent, Stats, lstatSync, readdirSync, writeFileSync } from 'fs';
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

  const duplicateFiles = findDuplicateFiles(scanDirResult.files);

  mkdirIfNotExist(DATA_DIR_PATH);
  const dirsDataFilePath = [
    DATA_DIR_PATH,
    'dirs.txt',
  ].join(path.sep);
  const filesDataFilePath = [
    DATA_DIR_PATH,
    'files.txt',
  ].join(path.sep);
  writeFileSync(dirsDataFilePath, scanDirResult.dirs.join('\n'));
  writeFileSync(filesDataFilePath, scanDirResult.files.join('\n'));
}

function findDuplicateFiles(filePaths: string[]) {
  let pathMap: Map<number, string[]>;
  pathMap = new Map;
  filePaths.forEach((filePath) => {
    let stat: Stats;
    let size: number;
    let sizePaths: string[];
    stat = lstatSync(filePath);
    size = stat.size;
    if(!pathMap.has(size)) {
      pathMap.set(size, []);
    }
    sizePaths = pathMap.get(size)!;
    sizePaths.push(filePath);
  });

  [ ...pathMap.entries() ].forEach(pathSizeTuple => {
    const [
      size,
      sizePaths,
    ] = pathSizeTuple;
    if(sizePaths.length > 1) {
      console.log(size);
      console.log(sizePaths);
    }
  });

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

  let pathCount: number;

  dirQueue = [
    dirPath,
  ];

  allDirs = [];
  allFiles = [];

  pathCount = 0;

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
        // dirQueue.push([
        //   currDirent.path,
        //   currDirent.name,
        // ].join(path.sep));
        dirQueue.unshift([
          currDirent.path,
          currDirent.name,
        ].join(path.sep));
      });
      pathCount++;
    } else {
      allFiles.push(currDirPath);
      pathCount++;
    }
    if((pathCount % 1e4) === 0) {
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');

  return {
    dirs: allDirs,
    files: allFiles,
  };
}
