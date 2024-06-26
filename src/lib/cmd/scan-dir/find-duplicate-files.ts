
import {
  Stats,
  WriteStream,
  createWriteStream,
  lstatSync
} from 'fs';

import { getDateFileStr } from '../../util/datetime-util';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { hashFile2 } from '../../util/hasher';
import { isObject, isString } from '../../util/validate-primitives';
import { sleep } from '../../util/sleep';
import { readFileByLine } from '../../util/files';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { logger } from '../../logger';
import path, { ParsedPath } from 'path';
import assert from 'assert';
import { Deferred } from '../../../test/deferred';

let maxConcurrentHashPromises: number;

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
