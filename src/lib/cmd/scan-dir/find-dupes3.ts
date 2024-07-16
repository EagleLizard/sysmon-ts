
import assert from 'assert';
import path from 'path';
import { Stats, WriteStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';

import { ScanDirOpts } from '../parse-sysmon-args';
import { logger } from '../../logger';
import { isObject, isString } from '../../util/validate-primitives';
import { LineReader, getLineReader } from '../../util/files';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { Deferred } from '../../../test/deferred';
import { Timer } from '../../util/timer';
import { scanDirColors as c } from './scan-dir-colors';
import { CliColors, ColorFormatter } from '../../service/cli-colors';
import { HashFile2Opts, hashFile2 } from '../../util/hasher';
import { getIntuitiveTimeString } from '../../util/format-util';

const RFL_MOD = 500;

const HASH_RFL_MOD = 300;

// const HASH_PROMISE_CHUNK_SIZE = 16;
// const HASH_PROMISE_CHUNK_SIZE = 32;
const HASH_PROMISE_CHUNK_SIZE = 64;
// const HASH_PROMISE_CHUNK_SIZE = 128;
// const HASH_PROMISE_CHUNK_SIZE = 256;

// const HASH_HWM = 32 * 1024;
const HASH_HWM = 64 * 1024;

export async function findDupes(opts: {
  filesDataFilePath: string;
  nowDate: Date;
  debug?: {
    dirPaths: string[];
    opts: ScanDirOpts;
  }
}): Promise<Map<string, string[]>> {
  let getPossibleDupesRes: GetPossibleDupesRes;
  let possibleDupeSizeMap: Map<number, number>;
  let sizeFilePath: string;
  let possibleDupeCount: number;
  let getFileHashesRes: GetFileHashesRes;

  let fdTimer: Timer;
  let getPossibleDupesMs: number;
  let getFileHashesMs: number;
  let getFileHashesTimeStr: string;


  fdTimer = Timer.start();
  getPossibleDupesRes = await getPossibleDupes(opts.filesDataFilePath, {
    nowDate: opts.nowDate,
  });
  getPossibleDupesMs = fdTimer.currentMs();
  console.log(`getPossibleDupes() took: ${_timeStr(getPossibleDupesMs)}`);

  possibleDupeSizeMap = getPossibleDupesRes.possibleDupeSizeMap;
  sizeFilePath = getPossibleDupesRes.sizeFilePath;
  possibleDupeCount = getPossibleDupeCount(possibleDupeSizeMap);
  _print({ possibleDupeCount });

  fdTimer.reset();
  getFileHashesRes = await getFileHashes(sizeFilePath, possibleDupeSizeMap, possibleDupeCount, opts.nowDate);
  getFileHashesMs = fdTimer.currentMs();
  getFileHashesTimeStr = _timeStr(getFileHashesMs, {
    // fmtTimeFn: c.aqua,
    fmtTimeFn: c.cyan,
  });
  console.log(`getFileHashes() took: ${getFileHashesTimeStr}`);

  return new Map<string, string[]>();
}

type GetFileHashesRes = {
  hashMap: Map<string, number>;
  hashFilePath: string;
};

async function getFileHashes(
  sizeFilePath: string,
  possibleDupeSizeMap: Map<number, number>,
  possibleDupeCount: number,
  nowDate: Date
): Promise<GetFileHashesRes> {
  let getFileHashRes: GetFileHashesRes;
  let hashFileName: string;
  let hashFilePath: string;
  let hashMap: Map<string, number>;
  let hashWs: WriteStream;
  let lineReader: LineReader;
  let line: string | undefined;
  let drainDeferred: Deferred | undefined;
  let hashPromises: Promise<FileHashLineInfo | undefined>[];

  let rflTimer: Timer;
  let percentTimer: Timer;
  let finishedHashCount: number;

  // hashFileName = `${getDateFileStr(opts.nowDate)}_hashes.txt`;
  hashFileName = '0_hashes.txt';
  hashFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    hashFileName,
  ].join(path.sep);
  hashMap = new Map();

  hashWs = createWriteStream(hashFilePath);
  lineReader = getLineReader(sizeFilePath);

  hashPromises = [];
  finishedHashCount = 0;
  rflTimer = Timer.start();
  percentTimer = Timer.start();

  let lineCount = 0;

  while((line = await lineReader.read()) !== undefined) {
    let currHashPromise: Promise<FileHashLineInfo | undefined>;
    lineCount++;
    currHashPromise = getFileHashLineInfo(line, possibleDupeSizeMap);
    currHashPromise.finally(() => {
      finishedHashCount++;
      if(rflTimer.currentMs() > HASH_RFL_MOD) {
        process.stdout.write('.');
        rflTimer.reset();
      }
      if(percentTimer.currentMs() > ((HASH_RFL_MOD) * 5)) {
        process.stdout.write(((finishedHashCount / possibleDupeCount) * 100).toFixed(2));
        percentTimer.reset();
      }
    });
    hashPromises.push(currHashPromise);
    if(hashPromises.length >= HASH_PROMISE_CHUNK_SIZE) {
      await getChunkFileHashes();
    }
  }

  if(hashPromises.length > 0) {
    await getChunkFileHashes();
  }

  process.stdout.write('\n');

  _print({ lineCount });

  getFileHashRes = {
    hashMap,
    hashFilePath,
  };
  return getFileHashRes;

  async function getChunkFileHashes() {
    let fileHashLineInfos: (FileHashLineInfo | undefined)[];
    fileHashLineInfos = await Promise.all(hashPromises);
    hashPromises = [];
    for(let i = 0; i < fileHashLineInfos.length; ++i) {
      let currFileHashLineInfo: FileHashLineInfo | undefined;
      let hashCount: number | undefined;
      currFileHashLineInfo = fileHashLineInfos[i];
      if(currFileHashLineInfo !== undefined) {
        let fileHash: string;
        let fileSize: number;
        let filePath: string;
        fileHash = currFileHashLineInfo.hash;
        fileSize = currFileHashLineInfo.size;
        filePath = currFileHashLineInfo.filePath;
        if((hashCount = hashMap.get(fileHash)) === undefined) {
          hashCount = 0;
        }
        hashMap.set(fileHash, hashCount + 1);
        await _hashWsWrite(`${fileHash} ${fileSize} ${filePath}\n`);
      }
    }
  }

  async function _hashWsWrite(str: string) {
    let wsRes: boolean;
    if(drainDeferred !== undefined) {
      await drainDeferred.promise;
    }
    wsRes = hashWs.write(str);
    if(!wsRes) {
      if(drainDeferred === undefined) {
        drainDeferred = Deferred.init();
        hashWs.once('drain', () => {
          setImmediate(() => {
            assert(drainDeferred !== undefined);
            drainDeferred.resolve();
          });
        });
        drainDeferred.promise.finally(() => {
          drainDeferred = undefined;
        });
      }
    }
  }
}

type FileHashLineInfo = {
  hash: string;
  size: number;
  filePath: string;
};

async function getFileHashLineInfo(line: string, possibleDupeSizeMap: Map<number, number>): Promise<FileHashLineInfo | undefined> {
  let filePath: string;
  let fileSize: number;
  let fileHash: string | undefined;
  let lineRx: RegExp;
  let rxExecRes: RegExpExecArray | null;

  lineRx = /^(?<sizeStr>[0-9]+) (?<filePath>.*)$/i;
  rxExecRes = lineRx.exec(line);
  assert((
    (rxExecRes !== null)
    && (rxExecRes.groups?.sizeStr !== undefined)
    && (rxExecRes.groups?.filePath !== undefined)
  ), line);
  fileSize = +rxExecRes.groups.sizeStr;
  if(!possibleDupeSizeMap.has(fileSize)) {
    return;
  }
  filePath = rxExecRes.groups.filePath;
  fileHash = await getFileHash(filePath, {
    highWaterMark: HASH_HWM,
  });
  if(fileHash === undefined) {
    return;
  }
  return {
    hash: fileHash,
    size: fileSize,
    filePath,
  };
}

async function getFileHash(filePath: string, hashOpts: HashFile2Opts = {}): Promise<string | undefined> {
  let fileHash: string | undefined;
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

type GetPossibleDupesRes = {
  possibleDupeSizeMap: Map<number, number>;
  sizeFilePath: string;
};

async function getPossibleDupes(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetPossibleDupesRes> {
  let possibleDupeMap: Map<number, number>;
  let getFileSizeRes: GetFileSizeRes;
  let sizeMap: GetFileSizeRes['sizeMap'];
  let sizeFilePath: string;
  let sizeMapIter: IterableIterator<number>;
  let sizeMapIterRes: IteratorResult<number>;

  getFileSizeRes = await getFileSizes(filesDataFilePath, {
    nowDate: opts.nowDate,
  });
  sizeMap = getFileSizeRes.sizeMap;
  sizeFilePath = getFileSizeRes.sizeFilePath;

  possibleDupeMap = new Map();
  sizeMapIter = sizeMap.keys();
  while(!(sizeMapIterRes = sizeMapIter.next()).done) {
    let size: number;
    let fileCount: number | undefined;
    size = sizeMapIterRes.value;
    fileCount = sizeMap.get(size);
    assert(fileCount !== undefined);
    if(
      (size > 0)
      && (fileCount > 1)
    ) {
      possibleDupeMap.set(size, fileCount);
    }
    sizeMap.delete(size);
  }
  sizeMap.clear();

  return {
    possibleDupeSizeMap: possibleDupeMap,
    sizeFilePath,
  };
}

type GetFileSizeRes = {
  sizeFilePath: string;
  sizeMap: Map<number, number>;
};

async function getFileSizes(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetFileSizeRes> {
  let sizeMap: Map<number, number>;
  let sizeFileName: string;
  let sizeFilePath: string;
  let sizeWs: WriteStream;
  let lineReader: LineReader;
  let line: string | undefined;
  let drainDeferred: Deferred | undefined;

  let rflTimer: Timer;

  // sizeFileName = `${getDateFileStr(opts.nowDate)}_sizes.txt`;
  sizeFileName = '0_sizes.txt';
  sizeFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    sizeFileName,
  ].join(path.sep);

  sizeMap = new Map();

  sizeWs = createWriteStream(sizeFilePath);
  lineReader = getLineReader(filesDataFilePath);

  rflTimer = Timer.start();

  while((line = await lineReader.read()) !== undefined) {
    let fileStats: Stats | undefined;
    let fileSize: number;
    let fileSizeCount: number | undefined;
    let wsRes: boolean;
    try {
      fileStats = await stat(line);
    } catch(e) {
      if(
        isObject(e)
        && isString(e.code)
        && (
          (e.code === 'ENOENT')
          || (e.code === 'EACCES')
        )
      ) {
        console.log({ fileStats });
        logger.error(`findDuplicates lstat: ${e.code} ${line}`);
        continue;
      }
      console.error(e);
      throw e;
    }
    fileSize = fileStats.size;
    if((fileSizeCount = sizeMap.get(fileSize)) === undefined) {
      fileSizeCount = 0;
    }
    sizeMap.set(fileSize, fileSizeCount + 1);
    if(drainDeferred !== undefined) {
      await drainDeferred.promise;
    }
    wsRes = sizeWs.write(`${fileSize} ${line}\n`);
    if(!wsRes) {
      if(drainDeferred === undefined) {
        drainDeferred = Deferred.init();
        sizeWs.once('drain', () => {
          setImmediate(() => {
            assert(drainDeferred !== undefined);
            drainDeferred.resolve();
          });
        });
        drainDeferred.promise.finally(() => {
          drainDeferred = undefined;
        });
      }
    }
    if(rflTimer.currentMs() > RFL_MOD) {
      process.stdout.write('.');
      rflTimer.reset();
    }
  }
  process.stdout.write('\n');

  return {
    sizeFilePath,
    sizeMap,
  };
}

function getPossibleDupeCount(possibleDupeMap: Map<number, number>): number {
  let possibleDupeIter: IterableIterator<number>;
  let possibleDupeIterRes: IteratorResult<number>;
  let possibleDupeCount: number;
  possibleDupeCount = 0;

  possibleDupeIter = possibleDupeMap.keys();
  while(!(possibleDupeIterRes = possibleDupeIter.next()).done) {
    let size: number;
    let fileCount: number | undefined;
    size = possibleDupeIterRes.value;
    fileCount = possibleDupeMap.get(size);
    assert(fileCount !== undefined);
    possibleDupeCount += fileCount;
  }
  return possibleDupeCount;
}

function _print(val: unknown) {

  if(isObject(val)) {
    let keys: (string | number)[];
    keys = Object.keys(val);
    for(let i = 0; i < keys.length; ++i) {
      console.log(`${keys[i]}: ${_fmtFn(val[keys[i]])}`);
    }
  } else {
    _fmtFn(val);
  }

  function _fmtFn(_val: unknown): string {
    switch(typeof _val) {
      case 'boolean':
        return c.pink(_val);
      case 'number':
        return c.yellow_light(_val);
      case 'string':
        return CliColors.rgb(100, 255, 100)(`'${_val}'`);
      case 'object':
        throw new Error('no objects :/');
      default:
        return c.yellow_light(_val);
    }
  }
}

function _timeStr(ms: number, opts: {
    doFmt?: boolean;
    fmtTimeFn?: ColorFormatter;
} = {}): string {
  let doFmt: boolean;
  let fmtTimeFn: ColorFormatter;
  let timeStrFmt: ColorFormatter;
  let msFmt: ColorFormatter;

  doFmt = opts.doFmt ?? true;
  fmtTimeFn = opts.fmtTimeFn ?? c.peach;

  timeStrFmt = doFmt
    ? fmtTimeFn
    : (val) => `${val}`
  ;
  msFmt = doFmt
    ? c.italic
    : (val) => `${val}`
  ;
  return `${timeStrFmt(getIntuitiveTimeString(ms))} (${msFmt(ms)} ms)`;
}
