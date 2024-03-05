
import path from 'path';
import {
  ReadStream,
  Stats,
  createReadStream,
  createWriteStream,
  lstatSync
} from 'fs';

import { getDateFileStr } from '../../util/datetime-util';
import { DATA_DIR_PATH } from '../../../constants';
import { Hasher, getHasher } from '../../util/hasher';
import { isObject } from '../../util/validate-primitives';
import { sleep } from '../../util/sleep';

export async function findDuplicateFiles(filePaths: string[], nowDate: Date) {
  let pathMap: Map<number, string[]>;
  let hashMap: Map<string, string[]>;
  /*
    First, find potential duplicates - a file can be a duplicate if it
      has the same size as another file.
  */
  pathMap = new Map;
  filePaths.forEach((filePath) => {
    let stat: Stats;
    let size: number;
    let sizePaths: string[];
    stat = lstatSync(filePath);
    size = stat.size;
    if(!pathMap.has(size)) {
      pathMap.set(size, []);
    }
    sizePaths = pathMap.get(size)!;
    sizePaths.push(filePath);
  });

  /*
    Next, pare the list of duplicates down to actual duplicates
      by calculating the file hashes of the potential duplicates
  */

  hashMap = new Map;

  let pathMapEntries: [ number, string[] ][] = [
    ...pathMap.entries()
  ].filter(pathMapEntry => {
    return pathMapEntry[1].length > 1;
  });
  let hashCount: number = 0;

  let possibleDupesFileName = `${getDateFileStr(nowDate)}_possible-dupes.txt`;
  let possibleDupesFilePath = [
    DATA_DIR_PATH,
    possibleDupesFileName,
  ].join(path.sep);

  let ws = createWriteStream(possibleDupesFilePath);
  [ ...pathMapEntries ].forEach((curr) => {
    let [ size, dupeFilePaths ] = curr;
    ws.write(`${size}\n`);
    dupeFilePaths.forEach(dupeFilePath => {
      ws.write(`${dupeFilePath}\n`);
    });
  });
  ws.close();

  let totalFileCount = pathMapEntries.reduce((acc, curr) => {
    acc += curr[1].length;
    return acc;
  }, 0);

  let hashProgess: number;
  let hashProgessLong: number;
  hashProgess = 0;
  hashProgessLong = 0;

  let promiseQueue: [number, Promise<void>][];
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

  let promiseIdCounter: number;
  promiseQueue = [];
  promiseIdCounter = 0;

  for(let i = 0; i < pathMapEntries.length; ++i) {
    const pathMapEntry = pathMapEntries[i];
    const [ , filePaths ] = pathMapEntry;
    if(filePaths.length < 2) {
      continue;
    }
    for(let k = 0; k < filePaths.length; ++k) {
      let rs: ReadStream;
      let readPromise: Promise<void>;
      let hasher: Hasher;
      let hashStr: string;
      let hashArr: string[];

      let nextHashProgress: number;
      let nextHashProgressLong: number;

      const filePath = filePaths[k];

      hasher = getHasher();

      const chunkCb = (chunk: string | Buffer) => {
        hasher.update(chunk);
      };

      readPromise = new Promise((resolve, reject) => {
        rs = createReadStream(filePath);
        rs.on('error', err => {
          if(isObject(err) && (
            (err.code === 'EISDIR')
            || (err.code === 'ENOENT')
          )) {
            console.error(`${err.code}: ${filePath}`);
          } else {
            reject(err);
          }
        });
        rs.on('close', () => {
          resolve();
        });
        rs.on('data', chunk => {
          chunkCb(chunk);
        });
      });
      while(promiseQueue.length >= maxConcurrentHashPromises) {
        await sleep(0);
      }
      let hashPromiseId = promiseIdCounter++;
      let hashPromise = (async () => {
        await readPromise;
        hashStr = hasher.digest();
        if(!hashMap.has(hashStr)) {
          hashMap.set(hashStr, []);
        }
        hashArr = hashMap.get(hashStr)!;
        hashArr.push(filePath);
        hashCount++;
        nextHashProgress = (hashCount / totalFileCount) * 100;
        nextHashProgressLong = (hashCount / totalFileCount) * 100;
        if(
          (nextHashProgress - hashProgess) > 0.5
        ) {
          hashProgess = nextHashProgress;
          process.stdout.write('.');
          // process.stdout.write(`.${((hashCount / totalFileCount) * 100).toFixed(1)}%.`);
        }
        if(
          (nextHashProgressLong - hashProgessLong) > 2
        ) {
          hashProgessLong = nextHashProgressLong;
          process.stdout.write(`${Math.round((hashCount / totalFileCount) * 100)}`);
          // process.stdout.write(`.${((hashCount / totalFileCount) * 100).toFixed(1)}%.`);
        }
        let foundQueuedIdx = promiseQueue.findIndex(queuedPromise => {
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

  let dupesFileName = `${getDateFileStr(nowDate)}_dupes.txt`;
  let dupesFilePath = [
    DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);
  ws = createWriteStream(dupesFilePath);

  [ ...hashMap.entries() ].forEach((curr) => {

    let [ hash, dupeFilePaths ] = curr;
    ws.write(`\n${hash}\n`);
    dupeFilePaths.forEach(dupeFilePath => {
      ws.write(`${dupeFilePath}\n`);
    });
  });
  ws.close();

  process.stdout.write('\n');
  console.log(`hashMap.keys().length: ${[ ...hashMap.keys() ].length}`);
}
