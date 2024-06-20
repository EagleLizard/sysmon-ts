
import {
  Stats,
  WriteStream,
  createWriteStream,
  lstatSync
} from 'fs';

import { getDateFileStr } from '../../util/datetime-util';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { HashFileResult, hashFile, hashFile2 } from '../../util/hasher';
import { isObject, isString } from '../../util/validate-primitives';
import { sleep } from '../../util/sleep';
import { joinPath, readFileByLine } from '../../util/files';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { logger } from '../../logger';
import path, { ParsedPath } from 'path';
import assert from 'assert';

let maxConcurrentHashPromises: number;

// maxConcurrentHashPromises = 200;
// maxConcurrentHashPromises = 1;
// maxConcurrentHashPromises = 3;
// maxConcurrentHashPromises = 6;
// maxConcurrentHashPromises = 12;
// maxConcurrentHashPromises = 24;
// maxConcurrentHashPromises = 48;
// maxConcurrentHashPromises = 96;

// maxConcurrentHashPromises = 32;  // 3.394m
// maxConcurrentHashPromises = 64;
// maxConcurrentHashPromises = 128;
maxConcurrentHashPromises = 256; // best 3.334m
// maxConcurrentHashPromises = 512; // best 36s

// maxConcurrentHashPromises = 1;

type FindDuplicatesOutStream = {
  write: WriteStream['write'];
};
type FindDuplicatesWriteStream = {
  write: WriteStream['write'];
  close: WriteStream['close'];
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

  let hashCount: number;
  let sizeMap: Map<number, string[]>;
  let possibleDupes: Map<number, string[]>;
  let possibleDupesFileName: string;
  let possibleDupesFilePath: string;
  let possibleDupesWs: FindDuplicatesWriteStream;
  let currSizeKeyIter: IterableIterator<number>;
  let currSizeKeyRes: IteratorResult<number>;

  let totalFileCount: number;
  let hashProgess: number;
  let hashProgessLong: number;
  let promiseQueue: [number, Promise<void>][];
  let promiseIdCounter: number;

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
        && (e.code === 'ENOENT')
      ) {
        logger.error(`getPotentialDupes lstatSync: ${e.code} ${line}`);
      } else {
        console.error(e);
        throw e;
      }
    }
    size = stat?.size ?? -1;
    if((sizePaths = sizeMap.get(size)) === undefined) {
      sizePaths = [];
      sizeMap.set(size, sizePaths);
    }
    sizePaths.push(line);
  };
  await readFileByLine(opts.filesDataFilePath, {
    lineCb: filesDataFileLineCb,
  });
  possibleDupes = new Map;

  currSizeKeyIter = sizeMap.keys();
  totalFileCount = 0;
  while(!(currSizeKeyRes = currSizeKeyIter.next()).done) {
    let currSizeKey: number;
    let currSizeVal: string[] | undefined;
    currSizeKey = currSizeKeyRes.value;
    currSizeVal = sizeMap.get(currSizeKey);
    assert(currSizeVal !== undefined, 'unexpected empty paths arr in sizeMap');
    if(currSizeVal.length > 1) {
      possibleDupes.set(currSizeKey, currSizeVal);
      totalFileCount += currSizeVal.length;
    }
    sizeMap.delete(currSizeKey);
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
  writePotentialDupes(possibleDupesWs, possibleDupes);
  possibleDupesWs.close();
  // totalFileCount = 0;
  // for(let i = 0; i < pathMapEntries.length; ++i) {
  //   totalFileCount += pathMapEntries[i][1].length;
  // }

  hashProgess = 0;
  hashProgessLong = 0;

  promiseQueue = [];
  promiseIdCounter = 0;

  hashMap = new Map;
  hashCount = 0;
  let currPathMapIter: IterableIterator<number>;
  let currPathMapRes: IteratorResult<number>;
  currPathMapIter = possibleDupes.keys();
  // for(let i = 0; i < pathMapEntries.length; ++i) {
  hashMap = await getDupes(possibleDupes, totalFileCount, outStream);

  dupesFileName = `${getDateFileStr(opts.nowDate)}_dupes.txt`;
  dupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);
  dupesWs = opts.dupesWs ?? createWriteStream(dupesFilePath);
  writeDupes(dupesWs, hashMap);
  dupesWs.close();

  outStream.write('\n');
  outStream.write(`hashMap.keys().length: ${[ ...hashMap.keys() ].length}\n`);

  return hashMap;
  while(!(currPathMapRes = currPathMapIter.next()).done) {
    let filePaths: string[] | undefined;
    filePaths = possibleDupes.get(currPathMapRes.value);
    assert(filePaths !== undefined, 'unexpected undefined possibleDupes filesPaths');
    assert(filePaths.length > 1, `unexpected possibleDupes filePaths length: ${filePaths.length}`)
    for(let k = 0; k < filePaths.length; ++k) {
      let hashFileRes: HashFileResult;
      let hashPromiseId: number;
      let hashPromise: Promise<void>;

      while(promiseQueue.length >= maxConcurrentHashPromises) {
        await sleep(0);
      }

      const filePath = filePaths[k];

      hashFileRes = hashFile(filePath);

      hashPromiseId = promiseIdCounter++;
      hashPromise = (async () => {
        let hashStr: string;
        let hashArr: string[];
        let foundQueuedIdx: number;
        let nextHashProgress: number;

        try {
          await hashFileRes.fileReadPromise;
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
          } else {
            throw e;
          }
        }
        hashStr = hashFileRes.hasher.digest();
        if(!hashMap.has(hashStr)) {
          hashMap.set(hashStr, []);
        }
        hashArr = hashMap.get(hashStr)!;
        hashArr.push(filePath);
        hashCount++;
        nextHashProgress = (hashCount / totalFileCount) * 100;
        if((nextHashProgress - hashProgess) > 0.5) {
          hashProgess = nextHashProgress;
          outStream.write('.');
        }
        if((nextHashProgress - hashProgessLong) > 2) {
          hashProgessLong = nextHashProgress;
          outStream.write(`${Math.round((hashCount / totalFileCount) * 100)}`);
        }
        foundQueuedIdx = promiseQueue.findIndex(queuedPromise => {
          return queuedPromise[0] === hashPromiseId;
        });
        promiseQueue.splice(foundQueuedIdx, 1);
      })();
      promiseQueue.push([
        hashPromiseId,
        hashPromise,
      ]);
    }
  }

  while(promiseQueue.length > 0) {
    await sleep(0);
  }

  dupesFileName = `${getDateFileStr(opts.nowDate)}_dupes.txt`;
  dupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);
  dupesWs = opts.dupesWs ?? createWriteStream(dupesFilePath);
  writeDupes(dupesWs, hashMap);
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

  let hashCount: number;
  let hashProgess: number;
  let hashProgessLong: number;

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
      let hashFileRes: HashFileResult;
      let fileHash: string;
      let dupesArr: string[] | undefined;

      let nextHashProgress: number;

      filePath = filePaths[i];
      fileHash = await hashFile2(filePath);
      if((dupesArr = hashMap.get(fileHash)) === undefined) {
        dupesArr = [];
        hashMap.set(fileHash, dupesArr);
      }
      dupesArr.push(filePath);
      hashCount++;
      // possibleDupes.delete(currPathMapRes.value);

      nextHashProgress = (hashCount / totalFileCount) * 100;
      if((nextHashProgress - hashProgess) > 0.5) {
        hashProgess = nextHashProgress;
        outStream.write('.');
      }
      if((nextHashProgress - hashProgessLong) > 2) {
        hashProgessLong = nextHashProgress;
        outStream.write(`${Math.round((hashCount / totalFileCount) * 100)}`);
      }
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

function getPotentialDupes(filePaths: string[]): [ number, string[] ][] {
  let pathMap: Map<number, string[]>;
  let pathMapEntries: [ number, string[] ][];
  pathMap = new Map;
  for(let i = 0; i < filePaths.length; ++i) {
    let stat: Stats | undefined;
    let size: number;
    let sizePaths: string[];
    let filePath = filePaths[i];
    try {
      stat = lstatSync(filePath);
    } catch(e) {
      if(
        isObject(e)
        && isString(e.code)
        && (e.code === 'ENOENT')
      ) {
        logger.error(`getPotentialDupes() lstatSync: ${e.code} ${filePath}`);
      } else {
        console.error(e);
        throw e;
      }
    }
    size = stat?.size ?? -1;
    // size = 0;
    if(!pathMap.has(size)) {
      pathMap.set(size, []);
    }
    sizePaths = pathMap.get(size)!;
    sizePaths.push(filePath);
  }
  pathMapEntries = [
    ...pathMap.entries()
  ].filter(pathMapEntry => {
    return pathMapEntry[1].length > 1;
  });
  return pathMapEntries;
}

function writePotentialDupes(ws: FindDuplicatesWriteStream, sizeMap: Map<number, string[]>) {
  let currSizeKeyIter: IterableIterator<number>;
  let currSizeKeyRes: IteratorResult<number>;
  currSizeKeyIter = sizeMap.keys();
  while(!(currSizeKeyRes = currSizeKeyIter.next()).done) {
    let size: number;
    let dupeFilePaths: string[] | undefined;
    size = currSizeKeyRes.value;
    dupeFilePaths = sizeMap.get(size);
    assert(dupeFilePaths !== undefined, 'unexpect expty dupeFilePaths in sizeMap');
    ws.write(`${size}\n`);
    for(let i = 0; i < dupeFilePaths.length; ++i) {
      ws.write(`${dupeFilePaths[i]}\n`);
    }
  }
  // [ ...sizeMap ].forEach((curr) => {
  //   let [ size, dupeFilePaths ] = curr;
  //   ws.write(`${size}\n`);
  //   dupeFilePaths.forEach(dupeFilePath => {
  //     ws.write(`${dupeFilePath}\n`);
  //   });
  // });
}

function writeDupes(ws: FindDuplicatesWriteStream, hashMap: Map<string, string[]>) {
  let hashMapKeyIter: IterableIterator<string>;
  hashMapKeyIter = hashMap.keys();
  let currRes: IteratorResult<string> | undefined;

  while(!(currRes = hashMapKeyIter.next()).done) {
    let parsedPaths: ParsedPath[];
    let curr: string;
    curr = currRes.value;
    parsedPaths = [];
    let dupeFilePaths: string[] | undefined;
    if((dupeFilePaths = hashMap.get(curr)) === undefined) {
      throw new Error(`unexpected empty dupeFilePaths for hash: ${curr}`);
    }
    ws.write(`\n${curr}\n`);
    for(let i = 0; i < dupeFilePaths.length; ++i) {
      let dupeFilePath: string;
      let parsedFilePath: ParsedPath;
      dupeFilePath = dupeFilePaths[i];
      parsedFilePath = path.parse(dupeFilePath);
      parsedPaths.push(parsedFilePath);
      ws.write(`${dupeFilePath}\n`);
    }
    for(let i = 0; i < parsedPaths.length; ++i) {
      ws.write(`  ${parsedPaths[i].base}\n`);
    }
  }
  // [ ...hashMap.entries() ].forEach((curr) => {
  //   let parsedPaths: ParsedPath[];
  //   let [ hash, dupeFilePaths ] = curr;
  //   parsedPaths = [];
  //   ws.write(`\n${hash}\n`);
  //   dupeFilePaths.forEach(dupeFilePath => {
  //     let parsedFilePath: ParsedPath;
  //     parsedFilePath = path.parse(dupeFilePath);
  //     parsedPaths.push(parsedFilePath);
  //     ws.write(`${dupeFilePath}\n`);
  //   });
  //   parsedPaths.forEach(parsedPath => {
  //     ws.write(`  ${parsedPath.base}\n`);
  //   });
  // });
}
