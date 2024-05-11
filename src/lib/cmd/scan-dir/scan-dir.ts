
import { Dirent, Stats, WriteStream, lstatSync, readdirSync } from 'fs';

import { isObject, isString } from '../../util/validate-primitives';
import { logger } from '../../logger';
import { joinPath } from '../../util/files';

export type ScanDirCbParams = {
  isDir: boolean;
  fullPath: string;
};

type ScanDirOutStream = {
  write: WriteStream['write'];
};

export type ScanDirOpts = {
  dirPaths: string[];
  scanDirCb: (scanDirCbParams: ScanDirCbParams) => ScanDirCbResult;
  outStream?: ScanDirOutStream;
  progressMod?: number;
};

type ScanDirCbResult = {
  skip?: boolean,
} | void;

export function scanDir(opts: ScanDirOpts) {
  let outStream: ScanDirOutStream;
  let progressMod: number;
  let currDirents: Dirent[];
  let dirQueue: string[];
  let currDirPath: string;

  let pathCount: number;

  outStream = opts.outStream ?? process.stdout;
  progressMod = opts.progressMod ?? 1e4;

  dirQueue = [
    ...opts.dirPaths,
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
    scanDirCbResult = opts.scanDirCb({
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
        dirQueue.unshift(
          joinPath([
            currDirent.path,
            currDirent.name,
          ])
        );
      });
      pathCount++;
    } else {
      pathCount++;
    }
    if((pathCount % progressMod) === 0) {
      outStream.write('.');
    }
  }
  outStream.write('\n');
}
