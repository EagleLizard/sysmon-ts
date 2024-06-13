
import path from 'path';
import fs from 'fs';
import { mkdirIfNotExist } from '../lib/util/files';
import { isNumber } from '../lib/util/validate-primitives';

export type GenTestDirRes = {
  numFiles: number;
  numDirs: number;
  numFileDupes: number;
};

type GenTestDirsOpts = {
  basePath: string,
  dirDepth: number,
  dirsPerLevel: number,
  filesPerDir: number
};

export function genTestDirs(opts: GenTestDirsOpts): GenTestDirRes {
  let dupeMap: Map<string, number>;
  let dupeMapKeys: string[];
  let dupeCount: number;
  let fileCount = 0;
  let dirCount = 0;
  dupeMap = new Map;
  _genTestDirs([], 0);
  function _genTestDirs(soFar: string[], depth: number) {
    if(depth > opts.dirDepth) {
      return;
    }
    if(depth < opts.dirDepth) {
      for(let i = 0; i < opts.dirsPerLevel; ++i) {
        let currDirName: string;
        let currDirPath: string;
        currDirName = `test-dir_${depth}_${i}`;
        currDirPath = [
          opts.basePath,
          ...soFar,
          currDirName,
        ].join(path.sep);
        mkdirIfNotExist(currDirPath);
        dirCount++;
        soFar.push(currDirName);
        _genTestDirs(soFar, depth + 1);
        soFar.pop();
      }
    }
    for(let i = 0; i < opts.filesPerDir; ++i) {
      let currFileName: string;
      let currFilePath: string;
      let currFileData: string;
      let currDupeCount: number | undefined;
      currFileName = `test-file_${depth}_${fileCount}`;
      currFilePath = [
        opts.basePath,
        ...soFar,
        currFileName,
      ].join(path.sep);
      currFileData = `${i}`.repeat(8);
      currDupeCount = dupeMap.get(currFileData);
      if(currDupeCount === undefined) {
        currDupeCount = 0;
      }
      dupeMap.set(currFileData, currDupeCount + 1);

      fs.writeFileSync(currFilePath, currFileData);
      fileCount++;
    }
  }
  dupeCount = 0;
  dupeMapKeys = [ ...dupeMap.keys() ];
  for(let i = 0; i < dupeMapKeys.length; ++i) {
    let currDupeCount = dupeMap.get(dupeMapKeys[i]);
    if(isNumber(currDupeCount)) {
      dupeCount += currDupeCount;
    }
  }

  return {
    numFiles: fileCount,
    numDirs: dirCount,
    numFileDupes: dupeCount,
  };
}
