
import { OUT_DATA_DIR_PATH, SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { joinPath, mkdirIfNotExist } from '../../util/files';
import { getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import {
  createWriteStream,
  writeFileSync
} from 'fs';
import { getDateFileStr } from '../../util/datetime-util';
import { findDuplicateFiles } from './find-duplicate-files';
import { ScanDirCbParams, scanDir } from './scan-dir';
import { ScanDirOpts, getScanDirArgs, getScanDirOpts } from '../parse-sysmon-args';
import { ParsedArgv2 } from '../parse-argv';

export async function scanDirCmdMain(parsedArgv: ParsedArgv2) {
  let dirPaths: string[];
  let opts: ScanDirOpts;

  let files: string[];
  let dirs: string[];
  let timer: Timer;
  let scanMs: number;
  let findDuplicatesMs: number;
  let nowDate: Date;

  dirPaths = getScanDirArgs(parsedArgv.args);
  opts = getScanDirOpts(parsedArgv.opts);

  nowDate = new Date;

  files = [];
  dirs = [];
  const scanDirCb = (params: ScanDirCbParams) => {
    if(params.isDir) {
      dirs.push(params.fullPath);
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
      files.push(params.fullPath);
    }
  };

  console.log(`Scanning: ${dirPaths}`);
  timer = Timer.start();
  await scanDir({
    dirPaths,
    scanDirCb
  });
  scanMs = timer.stop();
  console.log(`files: ${files.length}`);
  console.log(`dirs: ${dirs.length}`);
  console.log(`Scan took: ${getIntuitiveTimeString(scanMs)}`);

  mkdirIfNotExist(OUT_DATA_DIR_PATH);
  mkdirIfNotExist(SCANDIR_OUT_DATA_DIR_PATH);

  const dirsDataFileName = `${getDateFileStr(nowDate)}_dirs.txt`;
  const dirsDataFilePath = joinPath([
    SCANDIR_OUT_DATA_DIR_PATH,
    dirsDataFileName,
  ]);
  const filesDataDirName = `${getDateFileStr(nowDate)}_files.txt`;
  const filesDataFilePath = joinPath([
    SCANDIR_OUT_DATA_DIR_PATH,
    filesDataDirName,
  ]);
  writeFileSync(dirsDataFilePath, dirs.join('\n'));
  let ws = createWriteStream(filesDataFilePath);
  files.forEach(filePath => {
    ws.write(`${filePath}\n`);
  });
  ws.close();

  if(opts.find_duplicates === undefined) {
    return;
  }
  timer = Timer.start();
  const duplicateFiles = await findDuplicateFiles({
    filePaths: files,
    nowDate
  });
  let fileDupeCount: number;
  let dupeMapKeys: string[];
  const fileDupesDirName = `${getDateFileStr(nowDate)}_dupes.txt`;
  const fileDupesFilePath = joinPath([
    SCANDIR_OUT_DATA_DIR_PATH,
    fileDupesDirName,
  ]);

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
