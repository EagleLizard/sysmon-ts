
import {
  Stats,
  WriteStream,
  createWriteStream,
  lstatSync
} from 'fs';

import { getDateFileStr } from '../../util/datetime-util';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { HashFile2Opts, hashFile2 } from '../../util/hasher';
import { isObject, isString } from '../../util/validate-primitives';
import { sleep } from '../../util/sleep';
import { ReadFileByLineOpts, readFileByLine } from '../../util/files';
import { Timer } from '../../util/timer';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { logger } from '../../logger';
import path, { ParsedPath } from 'path';
import assert from 'assert';
import { Deferred } from '../../../test/deferred';
import { lstat } from 'fs/promises';

let maxConcurrentHashPromises: number;
let maxSizePromises: number;
let maxDupePromises: number;

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

const HASH_HWM = 32 * 1024;

const rflMod = 500;

type FindDuplicatesOutStream = {
  write: WriteStream['write'];
};
type FindDuplicatesWriteStream = {
  write: WriteStream['write'];
  close: WriteStream['close'];
  once: WriteStream['once'];
};

export type FindDuplicateFilesOpts = {
  // filePaths: string[];
  filesDataFilePath: string;
  nowDate: Date;
  outStream?: FindDuplicatesOutStream;
  possibleDupesWs?: FindDuplicatesWriteStream;
  dupesWs?: FindDuplicatesWriteStream;
};

export async function findDuplicateFiles2(opts: FindDuplicateFilesOpts) {
  let runningSizePromises: number;
  let lineCount: number;
  let sizeFileName: string;
  let sizeFilePath: string;
  let sizeWs: WriteStream;
  let drainDeferred: Deferred | undefined;
  let sizeMap: Map<number, number>;

  let rflTimer: Timer;

  lineCount = 0;
  runningSizePromises = 0;
  sizeMap = new Map();
  rflTimer = Timer.start();

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

  await readFileByLine(opts.filesDataFilePath, {
    lineCb: fileDataFileLineCb,
  });
  console.log('rfl done');
  while(runningSizePromises > 0) {
    await sleep(0);
  }
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
  console.log({ lineCount });

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

  let hashFileName: string;
  let hashFilePath: string;
  let hashWs: WriteStream;
  let runningHashPromises: number;
  let hashMap: Map<string, number>;
  // hashFileName = `${getDateFileStr(opts.nowDate)}_hashes.txt`;
  hashFileName = '0_hashes.txt';
  hashFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    hashFileName,
  ].join(path.sep);
  hashWs = createWriteStream(hashFilePath);
  runningHashPromises = 0;
  drainDeferred = undefined;
  hashMap = new Map();
  rflTimer = Timer.start();

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
    let filePath: string;
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

export async function findDuplicateFiles(opts: FindDuplicateFilesOpts): Promise<Map<string, string[]>> {
  let outStream: FindDuplicatesOutStream;
  let hashMap: Map<string, string[]>;

  let sizeMap: Map<number, string[]>;
  let possibleDupes: Map<number, string[]>;
  let possibleDupesFileName: string;
  let possibleDupesFilePath: string;
  let possibleDupesWs: FindDuplicatesWriteStream;
  let currSizeKeyIter: IterableIterator<number>;
  let currSizeKeyRes: IteratorResult<number>;

  let totalFileCount: number;

  let dupesFileName: string;
  let dupesFilePath: string;
  let dupesWs: FindDuplicatesWriteStream;

  outStream = opts.outStream ?? process.stdout;

  /*
    First, find potential duplicates - a file can be a duplicate if it
      has the same size as another file.
  */
  let potentialDupesTimer = Timer.start();
  sizeMap = new Map();
  let rflTimer: Timer;

  const filesDataFileLineCb = (line: string) => {
    let stat: Stats | undefined;
    let size: number;
    let sizePaths: string[] | undefined;
    try {
      stat = lstatSync(line);
    } catch(e) {
      if(
        isObject(e)
        && isString(e.code)
        && (
          (e.code === 'ENOENT')
          || (e.code === 'EACCES')
        )
      ) {
        logger.error(`getPotentialDupes lstatSync: ${e.code} ${line}`);
      } else {
        console.error(e);
        throw e;
      }
    }
    size = stat?.size ?? -1;
    if(size === 0) {
      /*
        There is no point in hashing files with zero length,
          they will deterministically be duplicates because
          the hash of nothing is the same as the hash of
          nothing.
        I'm mot sure how to report them. I don't consider reporting
          zero-length files helpful, because they are not truly
          duplicates, and deleting them could cause loss of
          information (file name)
      */
    } else {
      if((sizePaths = sizeMap.get(size)) === undefined) {
        sizePaths = [];
        sizeMap.set(size, sizePaths);
      }
      sizePaths.push(line);
    }

    if(rflTimer.currentMs() > rflMod) {
      outStream.write('.');
      rflTimer.reset();
    }
  };
  rflTimer = Timer.start();
  await readFileByLine(opts.filesDataFilePath, {
    lineCb: filesDataFileLineCb,
  });
  outStream.write('\n');
  possibleDupes = new Map;

  currSizeKeyIter = sizeMap.keys();
  totalFileCount = 0;
  while(!(currSizeKeyRes = currSizeKeyIter.next()).done) {
    let currSizeKey: number;
    let currSizeVal: string[] | undefined;
    currSizeKey = currSizeKeyRes.value;
    currSizeVal = sizeMap.get(currSizeKey);
    sizeMap.delete(currSizeKey);
    assert(currSizeVal !== undefined, 'unexpected empty paths arr in sizeMap');
    if(currSizeVal.length > 1) {
      possibleDupes.set(currSizeKey, currSizeVal);
      totalFileCount += currSizeVal.length;
    }
  }
  // for(let i = 0; i < pathMapEntries.length; ++i) {
  //   if(pathMapEntries[i][1].length > 1) {
  //     possibleDupes.push(pathMapEntries[i]);
  //   }
  // }

  console.log(`getPotentialDupes took: ${getIntuitiveTimeString(potentialDupesTimer.stop())}`);

  /*
    Next, pare the list of duplicates down to actual duplicates
      by calculating the file hashes of the potential duplicates
  */

  possibleDupesFileName = `${getDateFileStr(opts.nowDate)}_possible-dupes.txt`;
  possibleDupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    possibleDupesFileName,
  ].join(path.sep);
  possibleDupesWs = opts.possibleDupesWs ?? createWriteStream(possibleDupesFilePath);
  await writePotentialDupes(possibleDupesWs, possibleDupes);
  possibleDupesWs.close();

  hashMap = await getDupes(possibleDupes, totalFileCount, outStream);

  dupesFileName = `${getDateFileStr(opts.nowDate)}_dupes.txt`;
  dupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);
  dupesWs = opts.dupesWs ?? createWriteStream(dupesFilePath);
  await writeDupes(dupesWs, hashMap);
  dupesWs.close();

  outStream.write('\n');
  outStream.write(`hashMap.keys().length: ${[ ...hashMap.keys() ].length}\n`);

  return hashMap;
}

async function getDupes(possibleDupes: Map<number, string[]>, totalFileCount: number, outStream: FindDuplicatesOutStream): Promise<Map<string, string[]>> {
  let hashMap: Map<string, string[]>;
  let dupeHashMap: Map<string, string[]>;
  let currPathMapIter: IterableIterator<number>;
  let currPathMapRes: IteratorResult<number>;
  let hashMapIt: IterableIterator<string>;
  let hashMapRes: IteratorResult<string>;

  let runningPromises: number;
  let hashCount: number;
  let hashProgess: number;
  let hashProgessLong: number;

  runningPromises = 0;
  hashMap = new Map;
  hashCount = 0;
  hashProgess = 0;
  hashProgessLong = 0;

  currPathMapIter = possibleDupes.keys();
  while(!(currPathMapRes = currPathMapIter.next()).done) {
    let filePaths: string[] | undefined;
    filePaths = possibleDupes.get(currPathMapRes.value);
    assert(filePaths !== undefined, 'unexpected undefined filePaths in getDupes()');
    for(let i = 0; i < filePaths.length; ++i) {
      let filePath: string;
      let fileHash: string | undefined;
      let dupesArr: string[] | undefined;

      let nextHashProgress: number;

      let hashPromise: Promise<void>;

      filePath = filePaths[i];

      while(runningPromises > maxConcurrentHashPromises) {
        await sleep(0);
      }
      runningPromises++;

      hashPromise = (async () => {
        try {
          fileHash = await hashFile2(filePath);
        } catch(e) {
          if(isObject(e) && (
            (e.code === 'EISDIR')
            || (e.code === 'ENOENT')
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
        if((dupesArr = hashMap.get(fileHash)) === undefined) {
          dupesArr = [];
          hashMap.set(fileHash, dupesArr);
        }
        dupesArr.push(filePath);
        hashCount++;
        // possibleDupes.delete(currPathMapRes.value);
        /*
          print progress
        */
        nextHashProgress = (hashCount / totalFileCount) * 100;
        if((nextHashProgress - hashProgess) > 0.5) {
          hashProgess = nextHashProgress;
          outStream.write('.');
        }
        if((nextHashProgress - hashProgessLong) > 2) {
          hashProgessLong = nextHashProgress;
          outStream.write(`${Math.round((hashCount / totalFileCount) * 100)}`);
        }
      })();

      hashPromise.finally(() => {
        runningPromises--;
      });
    }
    while(runningPromises > 0) {
      await sleep(0);
    }
  }

  dupeHashMap = new Map;

  hashMapIt = hashMap.keys();
  while(!(hashMapRes = hashMapIt.next()).done) {
    let filePaths: string[] | undefined;
    filePaths = hashMap.get(hashMapRes.value);
    assert(filePaths !== undefined, 'unexpected undefined filePaths in getDupes()');
    if(filePaths.length > 1) {
      dupeHashMap.set(hashMapRes.value, filePaths);
    }
    hashMap.delete(hashMapRes.value);
  }

  return dupeHashMap;
}

async function writePotentialDupes(ws: FindDuplicatesWriteStream, sizeMap: Map<number, string[]>) {
  let currSizeKeyIter: IterableIterator<number>;
  let currSizeKeyRes: IteratorResult<number>;
  let wsRes: boolean;
  wsRes = true;
  currSizeKeyIter = sizeMap.keys();
  while(!(currSizeKeyRes = currSizeKeyIter.next()).done) {
    let size: number;
    let dupeFilePaths: string[] | undefined;
    let deferred: Deferred<void>;
    size = currSizeKeyRes.value;
    dupeFilePaths = sizeMap.get(size);
    assert(dupeFilePaths !== undefined, 'unexpect expty dupeFilePaths in sizeMap');
    wsRes = ws.write(`${size}\n`);
    if(!wsRes) {
      deferred = Deferred.init();
      ws.once('drain', deferred.resolve);
      await deferred.promise;
    }
    for(let i = 0; i < dupeFilePaths.length; ++i) {
      wsRes = ws.write(`${dupeFilePaths[i]}\n`);
      if(!wsRes) {
        deferred = Deferred.init();
        ws.once('drain', deferred.resolve);
        await deferred.promise;
      }
    }
  }
}

async function writeDupes(ws: FindDuplicatesWriteStream, hashMap: Map<string, string[]>) {
  let hashMapKeyIter: IterableIterator<string>;
  let currRes: IteratorResult<string> | undefined;
  let wsRes: boolean;

  wsRes = true;

  hashMapKeyIter = hashMap.keys();

  while(!(currRes = hashMapKeyIter.next()).done) {
    let parsedPaths: ParsedPath[];
    let curr: string;
    let deferred: Deferred<void>;
    curr = currRes.value;
    parsedPaths = [];
    let dupeFilePaths: string[] | undefined;
    if((dupeFilePaths = hashMap.get(curr)) === undefined) {
      throw new Error(`unexpected empty dupeFilePaths for hash: ${curr}`);
    }
    wsRes = ws.write(`\n${curr}\n`);
    if(!wsRes) {
      deferred = Deferred.init();
      ws.once('drain', deferred.resolve);
      await deferred.promise;
    }
    for(let i = 0; i < dupeFilePaths.length; ++i) {
      let dupeFilePath: string;
      let parsedFilePath: ParsedPath;
      dupeFilePath = dupeFilePaths[i];
      parsedFilePath = path.parse(dupeFilePath);
      parsedPaths.push(parsedFilePath);
      wsRes = ws.write(`${dupeFilePath}\n`);
      if(!wsRes) {
        deferred = Deferred.init();
        ws.once('drain', deferred.resolve);
        await deferred.promise;
      }
    }
    for(let i = 0; i < parsedPaths.length; ++i) {
      wsRes = ws.write(`  ${parsedPaths[i].base}\n`);
      if(!wsRes) {
        deferred = Deferred.init();
        ws.once('drain', deferred.resolve);
        await deferred.promise;
      }
    }
  }
}
