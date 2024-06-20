
import {
  Stats,
  WriteStream,
  createWriteStream,
  lstatSync
} from 'fs';

import { getDateFileStr } from '../../util/datetime-util';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { HashFileResult, hashFile } from '../../util/hasher';
import { isObject, isString } from '../../util/validate-primitives';
import { sleep } from '../../util/sleep';
import { joinPath, readFileByLine } from '../../util/files';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';
import { logger } from '../../logger';
import path, { ParsedPath } from 'path';

let maxConcurrentHashPromises: number;

// maxConcurrentHashPromises = 200;
// maxConcurrentHashPromises = 1;
// maxConcurrentHashPromises = 3;
// maxConcurrentHashPromises = 6;
// maxConcurrentHashPromises = 12;
// maxConcurrentHashPromises = 24;
// maxConcurrentHashPromises = 48;
// maxConcurrentHashPromises = 96;

// maxConcurrentHashPromises = 32;
// maxConcurrentHashPromises = 64;
// maxConcurrentHashPromises = 128;
maxConcurrentHashPromises = 256; // best 36s
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

  let filePaths: string[];
  let pathMapEntries: [ number, string[] ][];
  let hashCount: number;
  let sizeMap: Map<number, string[]>;
  let possibleDupesFileName: string;
  let possibleDupesFilePath: string;
  let possibleDupesWs: FindDuplicatesWriteStream;

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
  filePaths = [];
  sizeMap = new Map();
  const filesDataFileLineCb = (line: string) => {
    filePaths.push(line);
  };
  await readFileByLine(opts.filesDataFilePath, {
    lineCb: filesDataFileLineCb,
  });
  pathMapEntries = getPotentialDupes(filePaths);
  // pathMapEntries = await getPotentialDupesAsync(opts.filePaths);
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
  writePotentialDupes(possibleDupesWs, pathMapEntries);
  possibleDupesWs.close();

  totalFileCount = pathMapEntries.reduce((acc, curr) => {
    acc += curr[1].length;
    return acc;
  }, 0);

  hashProgess = 0;
  hashProgessLong = 0;

  promiseQueue = [];
  promiseIdCounter = 0;

  hashMap = new Map;
  hashCount = 0;

  for(let i = 0; i < pathMapEntries.length; ++i) {
    const pathMapEntry = pathMapEntries[i];
    const [ , filePaths ] = pathMapEntry;
    if(filePaths.length < 2) {
      continue;
    }
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
  dupesFilePath = joinPath([
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ]);
  dupesWs = opts.dupesWs ?? createWriteStream(dupesFilePath);
  writeDupes(dupesWs, hashMap);
  dupesWs.close();

  outStream.write('\n');
  outStream.write(`hashMap.keys().length: ${[ ...hashMap.keys() ].length}\n`);
  return hashMap;
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

function writePotentialDupes(ws: FindDuplicatesWriteStream, pathMapEntries: [ number, string[] ][]) {
  [ ...pathMapEntries ].forEach((curr) => {
    let [ size, dupeFilePaths ] = curr;
    ws.write(`${size}\n`);
    dupeFilePaths.forEach(dupeFilePath => {
      ws.write(`${dupeFilePath}\n`);
    });
  });
}

function writeDupes(ws: FindDuplicatesWriteStream, hashMap: Map<string, string[]>) {
  [ ...hashMap.entries() ].forEach((curr) => {
    let parsedPaths: ParsedPath[];
    let [ hash, dupeFilePaths ] = curr;
    parsedPaths = [];
    ws.write(`\n${hash}\n`);
    dupeFilePaths.forEach(dupeFilePath => {
      let parsedFilePath: ParsedPath;
      parsedFilePath = path.parse(dupeFilePath);
      parsedPaths.push(parsedFilePath);
      ws.write(`${dupeFilePath}\n`);
    });
    parsedPaths.forEach(parsedPath => {
      ws.write(`  ${parsedPath.base}\n`);
    });
  });
}
