import path from 'path';

import { DATA_DIR_PATH } from '../../../constants';
import { mkdirIfNotExist } from '../../util/files';
import { getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import {
  Dirent,
  Stats,
  createWriteStream,
  lstatSync,
  readdirSync,
  writeFileSync
} from 'fs';
import { isObject, isString } from '../../util/validate-primitives';
import { FIND_DUPLICATES_FLAG_CMD, SysmonCommand } from '../sysmon-args';
import { logger } from '../../logger';
import { getDateFileStr } from '../../util/datetime-util';
import { findDuplicateFiles } from './find-duplicate-files';

export async function scanDirMain(cmd: SysmonCommand) {
  let scanDirResult: ScanDirResult;
  let timer: Timer;
  let scanMs: number;
  let findDuplicatesMs: number;
  let dirPaths: string[];
  let nowDate: Date;

  nowDate = new Date;

  if(cmd.args === undefined) {
    throw new Error(`at least 1 positional argument required for command '${cmd.command}'`);
  }
  dirPaths = cmd.args;

  console.log(`Scanning: ${dirPaths}`);
  timer = Timer.start();
  scanDirResult = scanDir(dirPaths);
  scanMs = timer.stop();
  console.log(`files: ${scanDirResult.files.length}`);
  console.log(`dirs: ${scanDirResult.dirs.length}`);
  console.log(`Scan took: ${getIntuitiveTimeString(scanMs)}`);

  if(cmd.opts?.[FIND_DUPLICATES_FLAG_CMD.flag] === undefined) {
    return;
  }
  timer = Timer.start();
  const duplicateFiles = await findDuplicateFiles(scanDirResult.files, nowDate);
  console.log({ duplicateFiles });
  findDuplicatesMs = timer.stop();
  console.log(`findDuplicates took: ${getIntuitiveTimeString(findDuplicatesMs)}`);

  mkdirIfNotExist(DATA_DIR_PATH);
  const dirsDataFileName = `${getDateFileStr(nowDate)}_dirs.txt`;
  const dirsDataFilePath = [
    DATA_DIR_PATH,
    dirsDataFileName,
  ].join(path.sep);
  const filesDataDirName = `${getDateFileStr(nowDate)}_files.txt`;
  const filesDataFilePath = [
    DATA_DIR_PATH,
    filesDataDirName,
  ].join(path.sep);
  writeFileSync(dirsDataFilePath, scanDirResult.dirs.join('\n'));
  let ws = createWriteStream(filesDataFilePath);
  scanDirResult.files.forEach(filePath => {
    ws.write(`${filePath}\n`);
  });
  ws.close();
}

type ScanDirResult = {
  dirs: string[];
  files: string[];
};

function scanDir(dirPaths: string[]): ScanDirResult {
  let allDirs: string[];
  let allFiles: string[];

  let currDirents: Dirent[];
  let dirQueue: string[];
  let currDirPath: string;

  let pathCount: number;

  dirQueue = [
    ...dirPaths,
  ];

  allDirs = [];
  allFiles = [];

  pathCount = 0;

  while(dirQueue.length > 0) {
    let rootDirent: Stats | undefined;
    currDirPath = dirQueue.shift()!;
    try {
      rootDirent = lstatSync(currDirPath);
    } catch(e) {
      if(
        isObject(e)
        && isString(e.code)
        && (e.code === 'EACCES')
      ) {
        logger.error(`${e.code} ${currDirPath}`);
      } else {
        console.error(e);
        logger.error(e);
        throw e;
      }
    }
    if(
      (rootDirent !== undefined)
      && rootDirent.isDirectory()
    ) {
      try {
        currDirents = readdirSync(currDirPath, {
          withFileTypes: true,
        });
      } catch(e) {
        if(isObject(e) && (
          e.code === 'EACCES'
        )) {
          console.error(`${e.code} ${currDirPath}`);
          continue;
        } else {
          throw e;
        }
      }
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

