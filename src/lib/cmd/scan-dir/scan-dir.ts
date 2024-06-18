
import { Dirent, Stats, WriteStream, lstatSync, readdirSync } from 'fs';

import { isObject, isString } from '../../util/validate-primitives';
import { logger } from '../../logger';
import { joinPath } from '../../util/files';
import assert from 'assert';
import { lstat, readdir } from 'fs/promises';
import path from 'path';

export type ScanDirCbParams = {
  isDir: boolean;
  fullPath: string;
};

export type DirScannerRes = ScanDirCbParams & {
  pathCount: number;
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

/*
  This function is async currently ONLY because otherwise,
    the interface would need to be changed in order to test
    it properly.
  As the filesystem calls in the function are still synchronous,
    I don't expect to incur significant performance cost;
    it will only create a single promise for each dir
    hierarchy scanned
*/
export async function scanDir(opts: ScanDirOpts) {
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

export async function scanDir2(opts: ScanDirOpts) {
  let dirScanner: Generator<DirScannerRes>;
  let iterRes: IteratorResult<DirScannerRes>;
  let progressMod: number;
  let outStream: ScanDirOutStream;
  progressMod = opts.progressMod ?? 1e4;
  outStream = opts.outStream ?? process.stdout;

  dirScanner = getDirScanner(opts);

  while(!(iterRes = dirScanner.next()).done) {
    let currRes: DirScannerRes;
    currRes = iterRes.value;
    opts.scanDirCb({
      isDir: currRes.isDir,
      fullPath: currRes.fullPath,
    });
    if((currRes.pathCount % progressMod) === 0) {
      outStream.write('.');
    }
  }
}

function *getDirScanner(opts: ScanDirOpts): Generator<DirScannerRes> {
  let currDirents: Dirent[];
  let dirQueue: string[];
  let currDirPath: string | undefined;

  let pathCount = 0;

  dirQueue = [ ...opts.dirPaths ];

  pathCount = 0;

  while(dirQueue.length > 0) {
    let rootDirent: Stats | undefined;
    let currRes: DirScannerRes;
    currDirPath = dirQueue.shift();
    assert(currDirPath !== undefined, 'Path undefined in queue unexpectedly while scanning dir');
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
        console.log(currDirPath);
        console.error(e);
        logger.error(e);
        throw e;
      }
    }
    pathCount++;
    currRes = {
      isDir: rootDirent?.isDirectory() ?? false,
      fullPath: currDirPath,
      pathCount,
    };

    yield currRes;

    if(
      (rootDirent !== undefined)
      && rootDirent.isDirectory()
    ) {
      try {
        currDirents = readdirSync(currDirPath, {
          withFileTypes: true,
        });
      } catch(e) {
        if(
          isObject(e)
          && (e.code === 'EACCES')
        ) {
          console.error(`${e.code} ${currDirPath}`);
          continue;
        } else {
          throw e;
        }
      }
      for(let i = 0; i < currDirents.length; ++i) {
        let direntPath: string;
        let currDirent = currDirents[i];
        direntPath = [
          currDirent.path,
          currDirent.name,
        ].join(path.sep);
        dirQueue.unshift(direntPath);
      }
    }
  }
}
