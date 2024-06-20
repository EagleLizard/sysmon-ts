
import {
  WriteStream,
  createWriteStream,
  readdirSync,
  writeFileSync
} from 'fs';
import path from 'path';

import { OUT_DATA_DIR_PATH, SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { mkdirIfNotExist } from '../../util/files';
import { getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import { getDateFileStr } from '../../util/datetime-util';
import { findDuplicateFiles } from './find-duplicate-files';
import { ScanDirCbParams, scanDir, scanDir2 } from './scan-dir';
import { ScanDirOpts, getScanDirArgs, getScanDirOpts } from '../parse-sysmon-args';
import { ParsedArgv2 } from '../parse-argv';

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

  dirPaths = getScanDirArgs(parsedArgv.args);
  opts = getScanDirOpts(parsedArgv.opts);

  nowDate = new Date;
  dirCount = 0;
  fileCount = 0;

  mkdirIfNotExist(OUT_DATA_DIR_PATH);
  mkdirIfNotExist(SCANDIR_OUT_DATA_DIR_PATH);

  dirsDataFilePath = getDirsDataFilePath(nowDate);
  dirsWs = createWriteStream(dirsDataFilePath);
  filesDataFilePath = getFilesDataFilePath(nowDate);
  filesWs = createWriteStream(filesDataFilePath);

  const scanDirCb = (params: ScanDirCbParams) => {
    if(params.isDir) {
      dirCount++;
      dirsWs.write(`${params.fullPath}\n`);
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
    } else {
      filesWs.write(`${params.fullPath}\n`);
      fileCount++;
    }
  };
  console.log(`Scanning:\n${dirPaths.join('\n')}`);
  timer = Timer.start();
  for(let i = 0; i < dirPaths.length; ++i) {
    let dirPath: string;
    dirPath = dirPaths[i];
    await scanDir2({
      dirPath,
      scanDirCb
    });
  }
  dirsWs.close();
  filesWs.close();
  scanMs = timer.stop();
  console.log(`# files: ${fileCount}`);
  console.log(`# dirs: ${dirCount}`);
  console.log(`Scan took: ${getIntuitiveTimeString(scanMs)}`);

  if(opts.find_duplicates === undefined) {
    return;
  }
  timer = Timer.start();
  const duplicateFiles = await findDuplicateFiles({
    filesDataFilePath,
    nowDate
  });
  let fileDupeCount: number;
  let dupeMapKeys: string[];
  const fileDupesDirName = `${getDateFileStr(nowDate)}_dupes.txt`;
  const fileDupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    fileDupesDirName,
  ].join(path.sep);

  let dupeFileLines: string[];
  dupeFileLines = [];
  fileDupeCount = 0;
  dupeMapKeys = [ ...duplicateFiles.keys() ];
  for(let i = 0; i < dupeMapKeys.length; ++i) {
    let currDupeKey = dupeMapKeys[i];
    let currDupes = duplicateFiles.get(currDupeKey);
    dupeFileLines.push(`${currDupeKey}:`);
    if(Array.isArray(currDupes)) {
      fileDupeCount += currDupes.length;
      for(let k = 0; k < currDupes.length; ++k) {
        let currDupe = currDupes[k];
        dupeFileLines.push(`\n${currDupe}`);
      }
    }
  }
  writeFileSync(fileDupesFilePath, dupeFileLines.join(''));
  console.log({ duplicateFiles: fileDupeCount });
  findDuplicatesMs = timer.stop();
  console.log(`findDuplicates took: ${getIntuitiveTimeString(findDuplicatesMs)}`);

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
