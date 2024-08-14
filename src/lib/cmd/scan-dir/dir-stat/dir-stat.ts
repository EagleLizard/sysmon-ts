import { readdir } from 'fs/promises';
import { Dirent } from 'fs';
import assert from 'assert';
import path from 'path';

import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../../constants';
import { LineReader2, getLineReader2 } from '../../../util/files';
import { BrailleCanvas } from '../../../util/braille';
import { DirTree } from './dir-tree';
import { FileSizeInfo, parseSizeInfo } from '../find-dupes3/parse-dupes';

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

  let filesLr = await getLineReader2(outFilesPath);
  let line: string | undefined;
  let extStatMap: Map<string, ExtStat>;
  let dirTree: DirTree;
  extStatMap = new Map();
  dirTree = new DirTree();
  while((line = await filesLr.read()) !== undefined) {
    let fileSizeInfo: FileSizeInfo;
    fileSizeInfo = parseSizeInfo(line);

    dirTree.insertFile(fileSizeInfo.filePath);

    let fileExt = path.extname(fileSizeInfo.filePath);
    let currExtStat: ExtStat | undefined;
    if((currExtStat = extStatMap.get(fileExt)) === undefined) {
      currExtStat = {
        name: fileExt,
        size: 0,
        count: 0,
      };
      extStatMap.set(fileExt, currExtStat);
    }
    currExtStat.size += fileSizeInfo.size;
    currExtStat.count += 1;
  }
  await filesLr.close();

  // dirTree.traverse((filePath) => {
  //   console.log(filePath);
  // });

  let extStats = [ ...extStatMap.values() ];
  extStats.sort((a, b) => {
    if(a.count > b.count) {
      return -1;
    } else if(a.count < b.count) {
      return 1;
    } else {
      return 0;
    }
  });
  console.log(extStats.map(extStat => {
    return {
      ...extStat,
      avgSize: Math.round(extStat.size / extStat.count),
    };
  }).sort((a, b) => {
    if(a.avgSize > b.avgSize) {
      return -1;
    } else if(a.avgSize < b.avgSize) {
      return 1;
    } else {
      return 0;
    }
  }));
  let treeMap = getTreeMap();
  console.log(treeMap);
}

function getTreeMap() {
  let brCanvas = new BrailleCanvas(process.stdout.columns, process.stdout.rows);
  for(let x = 0; x < brCanvas.width; ++x) {
    for(let y = 0; y < brCanvas.height; ++y) {
      if(x !== y * 2) {
        brCanvas.set(x, y);
      }
    }
  }
  console.log(brCanvas.getStrMatrix().flatMap(a => a.join('')).join('\n'));
}
