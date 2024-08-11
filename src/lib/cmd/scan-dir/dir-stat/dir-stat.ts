import { readdir } from 'fs/promises';
import { Dirent } from 'fs';
import assert from 'assert';
import path from 'path';

import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../../constants';
import { LineReader2, getLineReader2 } from '../../../util/files';

const OUT_FILES_SUFFIX = '_files.txt';
const OUT_DIRS_SUFFIX = '_dirs.txt';
// const OUT_FILE_DUPES_SUFFIX = '_dupes_fmt.txt';
const OUT_FILE_DUPES_SUFFIX = '_dupes.txt';

type ExtStat = {
  name: string;
  count: number;
  size: number; // total bytes
};

export async function dirStat(): Promise<void> {
  let scanDirOutPaths: Dirent[];
  console.log('dirStat()');
  scanDirOutPaths = await readdir(SCANDIR_OUT_DATA_DIR_PATH, {
    withFileTypes: true,
  });

  let outFileDirent = scanDirOutPaths.find(outDirent => {
    return outDirent.name.endsWith(OUT_FILES_SUFFIX);
  });
  assert(outFileDirent !== undefined);
  let outFilesPath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    outFileDirent.name,
  ].join(path.sep);

  let outDirsDirent = scanDirOutPaths.find(outDirent => {
    return outDirent.name.endsWith(OUT_DIRS_SUFFIX);
  });
  assert(outDirsDirent !== undefined);
  let outDirsPath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    outDirsDirent.name,
  ].join(path.sep);

  let outFileDupesDirent = scanDirOutPaths.find(outDirent => {
    return outDirent.name.endsWith(OUT_FILE_DUPES_SUFFIX);
  });
  assert(outFileDupesDirent !== undefined);
  let outFileDupesPath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    outFileDupesDirent.name,
  ].join(path.sep);

  console.log({
    outDirsPath,
    outFilesPath,
    outFileDupesPath,
  });

  let dupesLr = await getLineReader2(outFileDupesPath);
  let line: string | undefined;
  let extCountMap: Map<string, number>;
  let extSizeMap: Map<string, number>;
  extCountMap = new Map();
  extSizeMap = new Map();
  while((line = await dupesLr.read()) !== undefined) {
    let lineRx: RegExp;
    let hash: string | undefined;
    let fileSizeStr: string | undefined;
    let fileSize: number;
    let filePath: string | undefined;
    let rxExecRes: RegExpExecArray | null;
    lineRx = /^(?<hash>[a-f0-9]+) (?<fileSizeStr>[0-9]+) (?<filePath>.*)$/i;
    rxExecRes = lineRx.exec(line);
    hash = rxExecRes?.groups?.hash;
    fileSizeStr = rxExecRes?.groups?.fileSizeStr;
    filePath = rxExecRes?.groups?.filePath;
    assert(
      1
      && hash !== undefined
      && fileSizeStr !== undefined
      && filePath !== undefined
    );
    fileSize = +fileSizeStr;
    assert(!isNaN(fileSize));
    
    let pathParts = filePath.split(path.sep);
    let fileName = pathParts[pathParts.length - 1];
    // let fileExt = fileName.split('.')[1];
    let fileExt = path.extname(filePath);
    let extCount: number | undefined;
    let extSizeTotal: number | undefined;
    if((extCount = extCountMap.get(fileExt)) === undefined) {
      extCount = 0;
    }
    extCountMap.set(fileExt, extCount + 1);
    if((extSizeTotal = extSizeMap.get(fileExt)) === undefined) {
      extSizeTotal = 0;
    }
    extSizeMap.set(fileExt, extSizeTotal + fileSize);
  }
  let extCountTuples: [string, number][] = [ ...extCountMap.entries() ];
  extCountTuples.sort((a, b) => {
    if(a[1] > b[1]) {
      return -1;
    } else if(a[1] < b[1]) {
      return 1;
    } else {
      return 0;
    }
  });
  console.log(extCountTuples);
  await dupesLr.close();
}
