
import { OUT_DATA_DIR_PATH, SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { joinPath, mkdirIfNotExist } from '../../util/files';
import { getIntuitiveTimeString } from '../../util/format-util';
import { Timer } from '../../util/timer';
import {
  createWriteStream,
  writeFileSync
} from 'fs';
import { FIND_DUPLICATES_FLAG_CMD, SCANDIR_CMD_FLAGS, SysmonCommand } from '../sysmon-args';
import { getDateFileStr } from '../../util/datetime-util';
import { findDuplicateFiles } from './find-duplicate-files';
import { ScanDirCbParams, scanDir } from './scan-dir';

export async function scanDirCmdMain(cmd: SysmonCommand) {
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
  scanDir({
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

  if(cmd.opts?.[FIND_DUPLICATES_FLAG_CMD.flag] === undefined) {
    return;
  }
  timer = Timer.start();
  const duplicateFiles = await findDuplicateFiles({
    filePaths: files,
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
      fileDupeCount += currDupeKey.length;
    }
  }
  // console.log({ duplicateFiles });
  console.log({ duplicateFiles: fileDupeCount });
  findDuplicatesMs = timer.stop();
  console.log(`findDuplicates took: ${getIntuitiveTimeString(findDuplicatesMs)}`);

}
