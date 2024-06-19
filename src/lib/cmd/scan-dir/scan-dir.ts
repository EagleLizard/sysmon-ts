
import { Dirent, Stats, WriteStream, lstatSync, readdirSync } from 'fs';
import assert from 'assert';
import path from 'path';

import { isObject, isString } from '../../util/validate-primitives';
import { logger } from '../../logger';
import { joinPath } from '../../util/files';
import { Dll } from '../../models/lists/dll';
import { Sll } from '../../models/lists/sll';

const INTERRUPT_MS = 1e3;
const INTERRUPT_NSECS = BigInt(INTERRUPT_MS * 1e6);

export type ScanDirCbParams = {
  isDir: boolean;
  fullPath: string;
};

type ScanDirOutStream = {
  write: WriteStream['write'];
};

export type ScanDirOpts = {
  dirPath: string;
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
  let dirQueue: Dll<string>;
  let currDirPath: string;

  let pathCount: number;

  outStream = opts.outStream ?? process.stdout;
  progressMod = opts.progressMod ?? 1e4;

  dirQueue = new Dll([ opts.dirPath ]);

  pathCount = 0;

  while(dirQueue.length > 0) {
    let rootDirent: Stats | undefined;
    let scanDirCbResult: ScanDirCbResult;
    currDirPath = dirQueue.popFront()!;
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
        dirQueue.pushFront(
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
  let dirScanner: Generator<ScanDirCbParams>;
  let iterRes: IteratorResult<ScanDirCbParams>;
  let progressMod: number;
  let outStream: ScanDirOutStream;
  let pathCount: number;
  let scanDirCbResult: ScanDirCbResult | undefined;
  let iterCount: number;
  let startTime: bigint;
  progressMod = opts.progressMod ?? 1e4;
  outStream = opts.outStream ?? process.stdout;

  pathCount = 0;
  iterCount = 0;
  startTime = process.hrtime.bigint();

  dirScanner = getDirScanner(opts);
  /*
    We need to interrupt the synchronous while() loop so that the
      main process can exit gracefully (e.g. SIGTERM)
  */
  return new Promise<void>((resolve) => {
    (function doIter() {
      while(
        !(iterRes = dirScanner.next(scanDirCbResult)).done
        && (process.exitCode === undefined)
      ) {
        let currRes: ScanDirCbParams;
        currRes = iterRes.value;
        scanDirCbResult = opts.scanDirCb({
          isDir: currRes.isDir,
          fullPath: currRes.fullPath,
        });
        if((pathCount++ % progressMod) === 0) {
          outStream.write('.');
        }
        if(
          true
          && ((iterCount++ % 100) === 0)
          && ((process.hrtime.bigint() - startTime) > INTERRUPT_NSECS)
        ) {
          startTime = process.hrtime.bigint();
          outStream.write('!');
          setImmediate(doIter);
          return;
        }
      }
      outStream.write('\n');
      resolve();
    })();
  });
}

function *getDirScanner(opts: ScanDirOpts): Generator<ScanDirCbParams, undefined, ScanDirCbResult> {
  let currDirents: Dirent[];
  let dirQueue: Sll<string>;
  let currDirPath: string | undefined;

  dirQueue = new Sll([ opts.dirPath ]);

  while(dirQueue.length > 0) {
    let rootDirent: Stats | undefined;
    let currRes: ScanDirCbParams;
    let scanDirCbResult: ScanDirCbResult | undefined;
    currDirPath = dirQueue.popFront();
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
    currRes = {
      isDir: rootDirent?.isDirectory() ?? false,
      fullPath: currDirPath,
    };

    scanDirCbResult = yield currRes;
    if(scanDirCbResult === undefined) {
      scanDirCbResult = undefined;
    }

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
        dirQueue.pushFront([
          currDirents[i].path,
          currDirents[i].name,
        ].join(path.sep));
      }
    }
  }
}
