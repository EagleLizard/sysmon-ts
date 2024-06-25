
import path from 'path';
import { Stats, WriteStream, createWriteStream } from 'fs';
import { lstat } from 'fs/promises';

import { FindDuplicateFilesOpts } from './find-duplicate-files';
import { Deferred } from '../../../test/deferred';
import { Timer } from '../../util/timer';
import { getDateFileStr } from '../../util/datetime-util';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { ReadFileByLineOpts, readFileByLine } from '../../util/files';
import { isObject, isString } from '../../util/validate-primitives';
import { logger } from '../../logger';
import { sleep } from '../../util/sleep';
import assert from 'assert';
import { HashFile2Opts, hashFile2 } from '../../util/hasher';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';

let maxConcurrentHashPromises: number;
let maxSizePromises: number;
let maxDupePromises: number;

const HASH_HWM = 32 * 1024;

// maxConcurrentHashPromises = 200;
// maxConcurrentHashPromises = 1;
// maxConcurrentHashPromises = 3;
// maxConcurrentHashPromises = 6;
// maxConcurrentHashPromises = 12;
// maxConcurrentHashPromises = 24;
// maxConcurrentHashPromises = 48;
// maxConcurrentHashPromises = 96;

// maxConcurrentHashPromises = 8;
// maxConcurrentHashPromises = 16;
// maxConcurrentHashPromises = 32;  // 3.394m
// maxConcurrentHashPromises = 64;
// maxConcurrentHashPromises = 128;
maxConcurrentHashPromises = 256; // best 3.334m
// maxConcurrentHashPromises = 512; // best 36s
// maxConcurrentHashPromises = 1024;
// maxConcurrentHashPromises = 2048;

// maxConcurrentHashPromises = 1;

maxSizePromises = 32;
// maxSizePromises = 64;
// maxSizePromises = 256;
// maxSizePromises = 1024;

maxDupePromises = 1;

const rflMod = 500;

export async function findDuplicateFiles2(opts: FindDuplicateFilesOpts) {
  let sizeFilePath: string;
  let drainDeferred: Deferred | undefined;
  let getFileSizesRes: GetFileSizesRes;
  let sizeMap: Map<number, number>;

  let rflTimer: Timer;

  getFileSizesRes = await getFileSizes(opts.filesDataFilePath, {
    nowDate: opts.nowDate,
  });
  sizeMap = getFileSizesRes.sizeMap;
  sizeFilePath = getFileSizesRes.sizeFilePath;

  console.log(`sizeMap.size: ${sizeMap.size}`);
  let sizeMapIter: IterableIterator<number>;
  let sizeMapIterRes: IteratorResult<number>;
  let possibleDupeSizeMap: Map<number, number>;

  sizeMapIter = sizeMap.keys();
  possibleDupeSizeMap = new Map();
  while(!(sizeMapIterRes = sizeMapIter.next()).done) {
    let size: number;
    let fileCount: number | undefined;
    size = sizeMapIterRes.value;
    fileCount = sizeMap.get(size);
    assert(fileCount !== undefined);
    if(
      1
      // && (size !== 0)
      && (size !== 0)
      && (fileCount > 1)
    ) {
      possibleDupeSizeMap.set(size, fileCount);
    }
    sizeMap.delete(size);
  }
  sizeMap.clear();
  // console.log({ possibleDupeSizes: possibleDupeSizeMap.size });
  let possibleDupeIter: IterableIterator<number>;
  let possibleDupeIterRes: IteratorResult<number>;
  let possibleDupeCount: number;
  possibleDupeCount = 0;

  possibleDupeIter = possibleDupeSizeMap.keys();
  while(!(possibleDupeIterRes = possibleDupeIter.next()).done) {
    let size: number;
    let fileCount: number | undefined;
    size = possibleDupeIterRes.value;
    fileCount = possibleDupeSizeMap.get(size);
    assert(fileCount !== undefined);
    possibleDupeCount += fileCount;
  }

  console.log({ possibleDupes: possibleDupeCount });

  let hashFilePath: string;
  let hashMap: Map<string, number>;
  let getFileHashesRes: GetFileHashesRes;

  getFileHashesRes = await getFileHashes(sizeFilePath, possibleDupeSizeMap);
  hashMap = getFileHashesRes.hashMap;
  hashFilePath = getFileHashesRes.hashFilePath;

  let dupeMap: Map<string, number>;
  let hashMapIter: IterableIterator<string>;
  let hashMapIterRes: IteratorResult<string>;
  let dupeCount: number;

  dupeMap = new Map();
  dupeCount = 0;

  hashMapIter = hashMap.keys();
  while(!(hashMapIterRes = hashMapIter.next()).done) {
    let fileHash: string;
    let hashFileCount: number | undefined;
    fileHash = hashMapIterRes.value;
    hashFileCount = hashMap.get(fileHash);
    assert(hashFileCount !== undefined);
    if(hashFileCount > 1) {
      dupeMap.set(fileHash, hashFileCount);
      dupeCount++;
    }
    hashMap.delete(fileHash);
  }
  hashMap.clear();
  console.log({ dupeCount });

  let dupesFileName: string;
  let dupesFilePath: string;
  let dupesWs: WriteStream;
  let runningDupePromises: number;
  let totalHashCount: number;
  let totalDupeHashCount: number;
  let hashSizeMap: Map<string, number>;

  dupesFileName = '0_dupes.txt';
  dupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);

  dupesWs = createWriteStream(dupesFilePath);
  runningDupePromises = 0;
  drainDeferred = undefined;
  totalHashCount = 0;
  totalDupeHashCount = 0;
  hashSizeMap = new Map();

  rflTimer = Timer.start();

  const fileHashesFileLineCb: ReadFileByLineOpts['lineCb'] = (line, resumeCb) => {
    let fileHash: string;
    let sizeStr: string;
    let dupePromise: Promise<void>;
    [ fileHash, sizeStr, ] = line.split(' ');
    totalHashCount++;
    if(!dupeMap.has(fileHash)) {
      return;
    }
    totalDupeHashCount++;
    runningDupePromises++;
    dupePromise = (async () => {
      let wsRes: boolean;
      let fileSize: number;
      if(!hashSizeMap.has(fileHash)) {
        fileSize = +sizeStr;
        assert(!isNaN(fileSize));
        hashSizeMap.set(fileHash, fileSize);
      }
      wsRes = dupesWs.write(`${line}\n`);
      if(!wsRes) {
        if(drainDeferred === undefined) {
          drainDeferred = Deferred.init();
          dupesWs.once('drain', drainDeferred.resolve);
          drainDeferred.promise.finally(() => {
            drainDeferred = undefined;
          });
        }
        await drainDeferred.promise;
      }
    })();
    dupePromise.finally(() => {
      runningDupePromises--;
      if(runningDupePromises < maxDupePromises) {
        resumeCb();
      }
    });
    if(rflTimer.currentMs() > rflMod) {
      process.stdout.write('.');
      rflTimer.reset();
    }
    if(runningDupePromises >= maxDupePromises) {
      return 'pause';
    }
  };
  await readFileByLine(hashFilePath, {
    lineCb: fileHashesFileLineCb,
  });
  console.log('rfl done');
  while(runningDupePromises > 0) {
    await sleep(0);
  }
  console.log({ totalHashCount });
  console.log({ totalDupeHashCount });

  let hashSizeMapIter: IterableIterator<string>;
  let hashSizeMapIterRes: IteratorResult<string>;
  let maxFileSize: number;
  let maxFileSizeHash: string | undefined;
  let unqiueDupeFiles: number;
  hashSizeMapIter = hashSizeMap.keys();
  maxFileSize = -Infinity;
  unqiueDupeFiles = 0;
  while(!(hashSizeMapIterRes = hashSizeMapIter.next()).done) {
    let currHash: string;
    let currHashCount: number | undefined;
    unqiueDupeFiles++;
    currHash = hashSizeMapIterRes.value;
    currHashCount = hashSizeMap.get(currHash);
    assert(currHashCount !== undefined);
    if(currHashCount > maxFileSize) {
      maxFileSize = currHashCount;
      maxFileSizeHash = currHash;
    }
  }
  assert(maxFileSizeHash !== undefined);
  console.log(`unique dupe files: ${unqiueDupeFiles}`);
  console.log(`\nmaxFileSize: ${getIntuitiveByteString(maxFileSize)} (${maxFileSize} bytes)\nhash: ${maxFileSizeHash}\n`);

  let hashFileReadTimer: Timer;
  let hashFileReadMs: number;
  let totalBytes: number;
  totalBytes = 0;
  const hashFileLineCb: ReadFileByLineOpts['lineCb'] = (line, resumeCb) => {
    let sizeStr: string;
    let fileSize: number;
    [ , sizeStr, ] = line.split(' ');
    fileSize = +sizeStr;
    if(isNaN(fileSize)) {
      return;
    }
    totalBytes += fileSize;
  };
  hashFileReadTimer = Timer.start();
  await readFileByLine(hashFilePath, {
    lineCb: hashFileLineCb,
  });
  hashFileReadMs = hashFileReadTimer.stop();
  console.log(`totalBytes: ${totalBytes} - ${getIntuitiveByteString(totalBytes)}`);
  console.log(`hashFileRead took: ${hashFileReadMs} - ${getIntuitiveTimeString(hashFileReadMs)}`);

  return new Map<string, string[]>();
}

type GetFileHashesRes = {
  hashMap: Map<string, number>;
  hashFilePath: string;
};

async function getFileHashes(sizeFilePath: string, possibleDupeSizeMap: Map<number, number>): Promise<GetFileHashesRes> {
  let hashFileName: string;
  let hashFilePath: string;
  let hashWs: WriteStream;
  let runningHashPromises: number;
  let hashMap: Map<string, number>;
  let drainDeferred: Deferred | undefined;
  let rflTimer: Timer;
  let possibleDupeCount: number;

  let getFileHashesRes: GetFileHashesRes;

  // hashFileName = `${getDateFileStr(opts.nowDate)}_hashes.txt`;
  hashFileName = '0_hashes.txt';
  hashFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    hashFileName,
  ].join(path.sep);
  hashWs = createWriteStream(hashFilePath);
  runningHashPromises = 0;
  hashMap = new Map();
  rflTimer = Timer.start();
  possibleDupeCount = 0;

  const fileSizesFileLineCb: ReadFileByLineOpts['lineCb'] = (line, resumeCb) => {
    let sizeStr: string;
    let filePath: string;
    let fileSize: number;
    let hashPromise: Promise<void>;
    [ sizeStr, filePath ] = line.split(' ');
    fileSize = +sizeStr;
    if(!possibleDupeSizeMap.has(fileSize)) {
      return;
    }
    runningHashPromises++;
    hashPromise = (async () => {
      let fileHash: string | undefined;
      let hashFileLine: string;
      let wsRes: boolean;
      let hashCount: number | undefined;
      fileHash = await getFileHash(filePath, {
        highWaterMark: HASH_HWM,
      });
      if(fileHash === undefined) {
        return;
      }

      if((hashCount = hashMap.get(fileHash)) === undefined) {
        hashCount = 0;
      }
      hashMap.set(fileHash, hashCount + 1);

      hashFileLine = `${fileHash} ${fileSize} ${filePath}`;
      wsRes = hashWs.write(`${hashFileLine}\n`);
      if(!wsRes) {
        if(drainDeferred === undefined) {
          drainDeferred = Deferred.init();
          hashWs.once('drain', drainDeferred.resolve);
          drainDeferred.promise.finally(() => {
            drainDeferred = undefined;
          });
        }
        await drainDeferred.promise;
      }
    })();
    hashPromise.finally(() => {
      runningHashPromises--;
      if(runningHashPromises < maxConcurrentHashPromises) {
        resumeCb();
      }
    });
    if(rflTimer.currentMs() > rflMod) {
      process.stdout.write('.');
      rflTimer.reset();
    }
    if(runningHashPromises >= maxConcurrentHashPromises) {
      return 'pause';
    }
  };
  await readFileByLine(sizeFilePath, {
    lineCb: fileSizesFileLineCb,
    // highWaterMark: 64 * 1024,
    // highWaterMark: 8 * 1024,
    // highWaterMark: 4  * 1024,
    // highWaterMark: 2  * 1024,
    highWaterMark: 1024,
    // highWaterMark: 512,
  });
  console.log('rfl done');
  while(runningHashPromises > 0) {
    await sleep(0);
  }
  console.log({ possibleDupeCount });
  getFileHashesRes = {
    hashFilePath,
    hashMap,
  };
  return getFileHashesRes;
}

type GetFileSizesRes = {
  sizeFilePath: string;
  sizeMap: Map<number, number>;
}

async function getFileSizes(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetFileSizesRes> {
  let runningSizePromises: number;
  let sizeMap: Map<number, number>;
  let rflTimer: Timer;
  let sizeFileName: string;
  let sizeFilePath: string;
  let sizeWs: WriteStream;
  let drainDeferred: Deferred | undefined;
  let lineCount: number;

  let getFileSizeRes: GetFileSizesRes;

  runningSizePromises = 0;
  sizeMap = new Map();
  rflTimer = Timer.start();
  lineCount = 0;

  sizeFileName = `${getDateFileStr(opts.nowDate)}_sizes.txt`;
  // sizeFileName = 'sizes.txt';
  sizeFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    sizeFileName,
  ].join(path.sep);
  sizeWs = createWriteStream(sizeFilePath);

  const fileDataFileLineCb: ReadFileByLineOpts['lineCb'] = (line: string, resumeCb: () => void) => {
    let sizePromise: Promise<void>;
    runningSizePromises++;
    sizePromise = (async () => {
      let fileStats: Stats | undefined;
      let fileSize: number;
      let fileSizeCount: number | undefined;
      let sizeFileLine: string;
      let wsRes: boolean;
      try {
        fileStats = await lstat(line);
      } catch(e) {
        if(
          isObject(e)
          && isString(e.code)
          && (
            (e.code === 'ENOENT')
            || (e.code === 'EACCES')
          )
        ) {
          logger.error(`findDuplicates lstat: ${e.code} ${line}`);
        } else {
          console.error(e);
          throw e;
        }
      }
      fileSize = fileStats?.size ?? -1;
      if((fileSizeCount = sizeMap.get(fileSize)) === undefined) {
        fileSizeCount = 0;
      }
      sizeMap.set(fileSize, fileSizeCount + 1);
      sizeFileLine = `${fileSize} ${line}`;
      wsRes = sizeWs.write(`${sizeFileLine}\n`);
      if(!wsRes) {
        if(drainDeferred === undefined) {
          /*
            use one deferred promise across all async
              hash promises to ensure only one drain
              event gets scheduled
          */
          drainDeferred = Deferred.init();
          sizeWs.once('drain', drainDeferred.resolve);
          drainDeferred.promise.finally(() => {
            drainDeferred = undefined;
          });
        }
        await drainDeferred.promise;
      }

      lineCount++;
    })();
    sizePromise.finally(() => {
      runningSizePromises--;
      if(runningSizePromises < maxSizePromises) {
        // process.stdout.write(`_${runningHashPromises}_`);
        resumeCb();
      }
      if(rflTimer.currentMs() > rflMod) {
        process.stdout.write('.');
        rflTimer.reset();
      }
    });
    if(runningSizePromises >= maxSizePromises) {
      // console.log({ runningHashPromises });
      // process.stdout.write('^');
      return 'pause';
    }
  };

  await readFileByLine(filesDataFilePath, {
    lineCb: fileDataFileLineCb,
  });
  console.log('rfl done');
  console.log({ lineCount });
  while(runningSizePromises > 0) {
    await sleep(0);
  }
  getFileSizeRes = {
    sizeFilePath,
    sizeMap,
  };
  return getFileSizeRes;
}

async function getFileHash(filePath: string, hashOpts: HashFile2Opts = {}): Promise<string | undefined> {
  let fileHash: string;
  try {
    fileHash = await hashFile2(filePath, hashOpts);
  } catch(e) {
    if(isObject(e) && (
      (e.code === 'EISDIR')
      || (e.code === 'ENOENT')
      || (e.code === 'EACCES')
    )) {
      let stackStr = (new Error).stack;
      let errMsg = `${e.code}: ${filePath}`;
      let errObj = Object.assign({}, {
        errMsg,
        stackStr,
      }, e);
      logger.warn(errObj);
      return;
    } else {
      console.error(e);
      logger.error(e);
      throw e;
    }
  }
  return fileHash;
}
