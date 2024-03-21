import path from 'path';

import { OUT_DATA_DIR_PATH } from '../../../constants';
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
import { FIND_DUPLICATES_FLAG_CMD, SCANDIR_CMD_FLAGS, SysmonCommand } from '../sysmon-args';
import { logger } from '../../logger';
import { getDateFileStr } from '../../util/datetime-util';
import { findDuplicateFiles } from './find-duplicate-files';

export async function scanDirMain(cmd: SysmonCommand) {
  let files: string[];
  let dirs: string[];
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
  files = [];
  dirs = [];
  const scanDirCb = (params: ScanDirCbParams) => {
    // console.log(scanDirCbParams.fullPath);
    if(params.isDir) {
      dirs.push(params.fullPath);
      let skipDir = (
        (cmd.opts?.[SCANDIR_CMD_FLAGS.FIND_DIRS.flag] !== undefined)
        && cmd.opts[SCANDIR_CMD_FLAGS.FIND_DIRS.flag].value.some(findDirPath => {
          return params.fullPath.includes(findDirPath);
        })
      );
      if(
        skipDir
      ) {
        return {
          skip: true,
        };
      }
    } else {
      files.push(params.fullPath);
    }
  };

  console.log(`Scanning: ${dirPaths}`);
  timer = Timer.start();
  scanDir(dirPaths, scanDirCb);
  scanMs = timer.stop();
  console.log(`files: ${files.length}`);
  console.log(`dirs: ${dirs.length}`);
  console.log(`Scan took: ${getIntuitiveTimeString(scanMs)}`);

  mkdirIfNotExist(OUT_DATA_DIR_PATH);
  const dirsDataFileName = `${getDateFileStr(nowDate)}_dirs.txt`;
  const dirsDataFilePath = [
    OUT_DATA_DIR_PATH,
    dirsDataFileName,
  ].join(path.sep);
  const filesDataDirName = `${getDateFileStr(nowDate)}_files.txt`;
  const filesDataFilePath = [
    OUT_DATA_DIR_PATH,
    filesDataDirName,
  ].join(path.sep);
  writeFileSync(dirsDataFilePath, dirs.join('\n'));
  let ws = createWriteStream(filesDataFilePath);
  files.forEach(filePath => {
    ws.write(`${filePath}\n`);
  });
  ws.close();

  if(cmd.opts?.[FIND_DUPLICATES_FLAG_CMD.flag] === undefined) {
    return;
  }
  timer = Timer.start();
  const duplicateFiles = await findDuplicateFiles(files, nowDate);
  console.log({ duplicateFiles });
  findDuplicatesMs = timer.stop();
  console.log(`findDuplicates took: ${getIntuitiveTimeString(findDuplicatesMs)}`);

}

type ScanDirCbParams = {
  isDir: boolean;
  fullPath: string;
};

type ScanDirCbResult = {
  skip?: boolean,
} | void;

function scanDir(
  dirPaths: string[],
  scanDirCb: (scanDirCbParams: ScanDirCbParams) => ScanDirCbResult
) {

  let currDirents: Dirent[];
  let dirQueue: string[];
  let currDirPath: string;

  let pathCount: number;

  dirQueue = [
    ...dirPaths,
  ];

  pathCount = 0;

  while(dirQueue.length > 0) {
    let rootDirent: Stats | undefined;
    let scanDirCbResult: ScanDirCbResult;
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
    scanDirCbResult = scanDirCb({
      isDir: rootDirent?.isDirectory() ?? false,
      fullPath: currDirPath,
    });
    if(
      (rootDirent !== undefined)
      && rootDirent.isDirectory()
      && !scanDirCbResult?.skip
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
      pathCount++;
    }
    if((pathCount % 1e4) === 0) {
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');
}

