
import {
  WriteStream,
  createWriteStream,
} from 'fs';
import path from 'path';

import { OUT_DATA_DIR_PATH, SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { mkdirIfNotExist } from '../../util/files';
import { getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import { getDateFileStr } from '../../util/datetime-util';
import { findDuplicateFiles } from './find-duplicate-files';
import { findDuplicateFiles2 } from './find-duplicate-files2';
import { ScanDirCbParams, scanDir, scanDir2 } from './scan-dir';
import { ScanDirOpts, getScanDirArgs, getScanDirOpts } from '../parse-sysmon-args';
import { ParsedArgv2 } from '../parse-argv';
import { Deferred } from '../../../test/deferred';

export async function scanDirCmdMain(parsedArgv: ParsedArgv2) {
  let dirPaths: string[];
  let opts: ScanDirOpts;

  // let files: string[];
  // let dirs: string[];
  let dirCount: number;
  let fileCount: number;
  let timer: Timer;
  let scanMs: number;
  let findDuplicatesMs: number;
  let nowDate: Date;

  let dirsDataFilePath: string;
  let filesDataFilePath: string;
  let dirsWs: WriteStream;
  let filesWs: WriteStream;
  let scanDirPromises: Promise<void>[];
  let dirsDrainDeferred: Deferred<void> | undefined;
  let filesDrainDeferred: Deferred<void> | undefined;

  let totalTimer: Timer;

  totalTimer = Timer.start();

  dirPaths = getScanDirArgs(parsedArgv.args);
  opts = getScanDirOpts(parsedArgv.opts);

  nowDate = new Date;
  dirCount = 0;
  fileCount = 0;

  mkdirIfNotExist(OUT_DATA_DIR_PATH);
  mkdirIfNotExist(SCANDIR_OUT_DATA_DIR_PATH);

  // dirsDataFilePath = getDirsDataFilePath(nowDate);
  dirsDataFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    '0_dirs.txt',
  ].join(path.sep);
  dirsWs = createWriteStream(dirsDataFilePath);
  // filesDataFilePath = getFilesDataFilePath(nowDate);
  filesDataFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    '0_files.txt',
  ].join(path.sep);
  filesWs = createWriteStream(filesDataFilePath);

  const scanDirCb = async (params: ScanDirCbParams) => {
    let wsRes: boolean;
    if(params.isDir) {
      dirCount++;
      wsRes = dirsWs.write(`${params.fullPath}\n`);
      if(!wsRes) {
        if(dirsDrainDeferred === undefined) {
          dirsDrainDeferred = Deferred.init();
          dirsWs.once('drain', dirsDrainDeferred.resolve);
          dirsDrainDeferred.promise.finally(() => {
            dirsDrainDeferred = undefined;
          });
        }
        await dirsDrainDeferred.promise;
      }
      let skipDir = (
        (opts.find_dirs !== undefined)
        && opts.find_dirs.some(findDirPath => {
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
    } else if(!params.isSymLink) {
      /*
        Skip symlinks for now, because they will throw a
          ENOENT in find-duplicates.
        TODO: Explore resolving symlinks, research best
          practices for dealing with them.
      */
      wsRes = filesWs.write(`${params.fullPath}\n`);
      if(!wsRes) {
        if(filesDrainDeferred === undefined) {
          filesDrainDeferred = Deferred.init();
          filesWs.once('drain', filesDrainDeferred.resolve);
          filesDrainDeferred.promise.finally(() => {
            filesDrainDeferred = undefined;
          });
        }
        await filesDrainDeferred.promise;
      }
      fileCount++;
    }
  };
  console.log(`Scanning:\n${dirPaths.join('\n')}`);
  timer = Timer.start();
  scanDirPromises = [];
  for(let i = 0; i < dirPaths.length; ++i) {
    let scanDirPromise: Promise<void>;
    let dirPath: string;
    dirPath = dirPaths[i];
    scanDirPromise = scanDir2({
      dirPath,
      scanDirCb
    });
    scanDirPromises.push(scanDirPromise);
    // await scanDirPromise;
  }
  await Promise.all(scanDirPromises);
  dirsWs.close();
  filesWs.close();
  scanMs = timer.stop();
  console.log(`# files: ${fileCount}`);
  console.log(`# dirs: ${dirCount}`);
  console.log(`Scan took: ${getIntuitiveTimeString(scanMs)}`);

  if(opts.find_duplicates === undefined) {
    logTotalTime(totalTimer.stop());
    return;
  }
  timer = Timer.start();
  const duplicateFiles = await findDuplicateFiles2({
    filesDataFilePath,
    nowDate
  });
  let fileDupeCount: number;
  let dupeMapKeys: string[];

  fileDupeCount = 0;
  dupeMapKeys = [ ...duplicateFiles.keys() ];
  for(let i = 0; i < dupeMapKeys.length; ++i) {
    let currDupeKey = dupeMapKeys[i];
    let currDupes = duplicateFiles.get(currDupeKey);
    if(Array.isArray(currDupes)) {
      fileDupeCount += currDupes.length;
    }
  }
  // writeFileSync(fileDupesFilePath, dupeFileLines.join(''));
  console.log({ duplicateFiles: fileDupeCount });
  findDuplicatesMs = timer.stop();
  console.log(`findDuplicates took: ${getIntuitiveTimeString(findDuplicatesMs)}`);
  logTotalTime(totalTimer.stop());
}

function logTotalTime(ms: number) {
  console.log(`Total time: ${getIntuitiveTimeString(ms)}`);
}

function getDirsDataFilePath(date: Date): string {
  const dirsDataFileName = `${getDateFileStr(date)}_dirs.txt`;
  const dirsDataFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dirsDataFileName,
  ].join(path.sep);
  return dirsDataFilePath;
}
function getFilesDataFilePath(date: Date): string {
  const filesDataDirName = `${getDateFileStr(date)}_files.txt`;
  const filesDataFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    filesDataDirName,
  ].join(path.sep);
  return filesDataFilePath;
}
