
import path from 'path';
import { Stats, WriteStream, createWriteStream, statSync } from 'fs';
import fs, { FileHandle, FileReadResult } from 'fs/promises';
import assert from 'assert';

import { config } from '../../../config';
import { FindDuplicateFilesOpts } from './find-duplicate-files';
import { Deferred } from '../../../test/deferred';
import { Timer } from '../../util/timer';
import {
  // getDateFileStr,
  getDateStr,
} from '../../util/datetime-util';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { ReadFileByLineOpts, readFileByLine } from '../../util/files';
import { isObject, isString } from '../../util/validate-primitives';
import { logger } from '../../logger';
import { sleep, sleepImmediate } from '../../util/sleep';
import { HashFile2Opts, hashFile2 } from '../../util/hasher';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { scanDirColors as c } from './scan-dir-colors';
import { CliColors, ColorFormatter } from '../../service/cli-colors';
import { ScanDirOpts } from '../parse-sysmon-args';

let maxConcurrentHashPromises: number;
// let maxSizePromises: number;
let maxDupePromises: number;

// const HASH_HWM = 32 * 1024;
const HASH_HWM = 64 * 1024;
// const HASH_HWM = 128 * 1024;

const RFL_HWM = 1 * 1024;
// const RFL_HWM = 2 * 1024;
// const RFL_HWM = 4 * 1024;
// const RFL_HWM = 8 * 1024;

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

// maxSizePromises = 32;
// maxSizePromises = 64;
// maxSizePromises = 256;
// maxSizePromises = 1024;

maxDupePromises = 1;

const rflMod = 500;

const ITER_INTERRUPT_MS = 1e3;

// const FMT_DUPES_INTERRUPT_MOD = 666;
const FMT_DUPES_INTERRUPT_MOD = 333;
const FMT_DUPES_INTERRUPT_MS = 250;
// const FMT_DUPES_INTERRUPT_MS = 100;

const DEBUG_LEDGER_FILE_PATH = [
  SCANDIR_OUT_DATA_DIR_PATH,
  'debug_ledger.txt'
].join(path.sep);

const timeFmt = (ms: number) => {
  return c.chartreuse(getIntuitiveTimeString(ms));
};

const _timeStr = (ms: number, doFmt = true) => {
  let timeStrFmt: ColorFormatter;
  let msFmt: ColorFormatter;
  timeStrFmt = doFmt
    ? c.peach
    : (val) => `${val}`
  ;
  msFmt = doFmt
    ? c.italic
    : (val) => `${val}`
  ;
  return `${timeStrFmt(getIntuitiveTimeString(ms))} (${msFmt(ms)} ms)`;
};

export async function findDuplicateFiles2(opts: FindDuplicateFilesOpts & {
  debug?: {
    dirPaths: string[];
    opts: ScanDirOpts;
  }
}) {
  let sizeFilePath: string;
  let getFileSizesRes: GetFileSizesRes;
  let sizeMap: Map<number, number>;
  let possibleDupesTimer: Timer;
  let possibleDupesMs: number;

  let findDupes2Timer: Timer;
  let findDupes2Ms: number;

  let ledgerWs: WriteStream | undefined;
  let nowDateStr: string;

  findDupes2Timer = Timer.start();

  ledgerWs = createWriteStream(DEBUG_LEDGER_FILE_PATH, {
    flags: 'a',
  });
  nowDateStr = getDateStr(opts.nowDate);
  ledgerWs.write(`\n${'-'.repeat(nowDateStr.length)}`);
  ledgerWs.write(`\n${nowDateStr}\n`);
  if(opts.debug !== undefined) {
    ledgerWs.write('dir paths:\n');
    ledgerWs.write(opts.debug.dirPaths.join('\n'));
    ledgerWs.write('\nopts:\n');
    ledgerWs.write(JSON.stringify(opts.debug.opts, undefined, 2));
    ledgerWs.write('\n');
  }

  _print({
    HASH_HWM,
    RFL_HWM,
    maxConcurrentHashPromises,
    FMT_DUPES_INTERRUPT_MOD,
    FMT_DUPES_INTERRUPT_MS,
  }, {
    valFmtFn: c.yellow_yellow,
  });
  ledgerWs.write(`HASH_HWM: ${HASH_HWM}\n`);
  ledgerWs.write(`RFL_HWM: ${RFL_HWM}\n`);
  ledgerWs.write(`maxConcurrentHashPromises: ${maxConcurrentHashPromises}\n`);
  ledgerWs.write(`FMT_DUPES_INTERRUPT_MOD: ${FMT_DUPES_INTERRUPT_MOD}\n`);
  ledgerWs.write(`FMT_DUPES_INTERRUPT_MS: ${FMT_DUPES_INTERRUPT_MS}\n`);
  process.stdout.write('\n');

  possibleDupesTimer = Timer.start();
  try {
    getFileSizesRes = await getFileSizes2(opts.filesDataFilePath, {
      nowDate: opts.nowDate,
    });
  } catch(e) {
    console.error(e);
    throw e;
  }
  sizeMap = getFileSizesRes.sizeMap;
  sizeFilePath = getFileSizesRes.sizeFilePath;
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
      // && (size > 0)
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
  possibleDupesMs = possibleDupesTimer.stop();
  _print({ possibleDupes: possibleDupeCount });
  ledgerWs.write(`possibleDupes: ${possibleDupeCount}\n`);
  console.log(`find possible dupes took: ${_timeStr(possibleDupesMs)}`);
  ledgerWs.write(`find possible dupes took: ${_timeStr(possibleDupesMs, false)}\n`);

  let hashFilePath: string;
  let hashMap: Map<string, number>;
  let getFileHashesRes: GetFileHashesRes;
  let getFileHashesTimer: Timer;
  let getFileHashesMs: number;

  getFileHashesTimer = Timer.start();

  try {
    getFileHashesRes = await getFileHashes(sizeFilePath, possibleDupeSizeMap, possibleDupeCount);
  } catch(e) {
    console.error(e);
    throw e;
  }

  getFileHashesMs = getFileHashesTimer.stop();
  console.log(`getFileHashes() took: ${_timeStr(getFileHashesMs)}`);
  ledgerWs.write(`getFileHashes() took: ${_timeStr(getFileHashesMs, false)}\n`);

  hashMap = getFileHashesRes.hashMap;
  hashFilePath = getFileHashesRes.hashFilePath;

  let dupeMap: Map<string, number>;
  let hashMapIter: IterableIterator<string>;
  let hashMapIterRes: IteratorResult<string>;
  let uniqueDupeFiles: number;
  let dupeCount: number;

  dupeMap = new Map();
  uniqueDupeFiles = 0;
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
      uniqueDupeFiles++;
      dupeCount += hashFileCount;
    }
    hashMap.delete(fileHash);
  }
  hashMap.clear();
  _print({
    uniqueDupeFiles,
    dupeCount,
  });
  ledgerWs.write(`uniqueDupeFiles: ${uniqueDupeFiles}\n`);
  ledgerWs.write(`dupeCount: ${dupeCount}\n`);

  let dupesFilePath: string;
  let hashSizeMap: Map<string, number>;

  let getDuplicateFileHashesRes: GetDuplicateFileHashesRes;
  try {
    getDuplicateFileHashesRes = await getDuplicateFileHashes(hashFilePath, dupeMap);
  } catch(e) {
    console.error(e);
    throw e;
  }
  hashSizeMap = getDuplicateFileHashesRes.hashSizeMap;
  dupesFilePath = getDuplicateFileHashesRes.dupesFilePath;

  let hashSizeMapIter: IterableIterator<string>;
  let hashSizeMapIterRes: IteratorResult<string>;
  let maxFileSize: number;
  let maxFileSizeHash: string | undefined;
  hashSizeMapIter = hashSizeMap.keys();
  maxFileSize = -Infinity;
  while(!(hashSizeMapIterRes = hashSizeMapIter.next()).done) {
    let currHash: string;
    let currHashCount: number | undefined;
    currHash = hashSizeMapIterRes.value;
    currHashCount = hashSizeMap.get(currHash);
    assert(currHashCount !== undefined);
    if(currHashCount > maxFileSize) {
      maxFileSize = currHashCount;
      maxFileSizeHash = currHash;
    }
  }
  assert(maxFileSizeHash !== undefined);
  console.log(`\nmaxFileSize: ${getIntuitiveByteString(maxFileSize)} (${maxFileSize} bytes)\nhash: ${maxFileSizeHash}\n`);

  process.stdout.write('\n');

  await _closeWs(ledgerWs);
  ledgerWs = undefined;

  let formatDupesTimer: Timer;
  let formatDupesMs: number;
  let formatDupes2Res: FormatDupes2Res;
  formatDupesTimer = Timer.start();
  try {
    formatDupes2Res = await formatDupes2(dupesFilePath, hashSizeMap, dupeMap);
  } catch(e) {
    console.error(e);
    throw e;
  }
  formatDupesMs = formatDupesTimer.stop();
  findDupes2Ms = findDupes2Timer.stop();

  ledgerWs = createWriteStream(DEBUG_LEDGER_FILE_PATH, {
    flags: 'a',
  });
  process.stdout.write(`ilc: ${c.cyan(formatDupes2Res.innerLoopCount.toLocaleString())}\n`);
  process.stdout.write(`findDuplicateFiles2() took: ${_timeStr(findDupes2Ms)}\n`);

  ledgerWs.write(`ilc: ${formatDupes2Res.innerLoopCount}\n`);
  ledgerWs.write(`findDuplicateFiles2() took: ${_timeStr(findDupes2Ms, false)}\n`);
  ledgerWs.write(`formatDupes() took: ${getIntuitiveTimeString(formatDupesMs)} (${formatDupesMs} ms)\n`);
  ledgerWs.write(`findDuplicateFiles2() took: ${getIntuitiveTimeString(findDupes2Ms)} (${findDupes2Ms} ms)\n`);
  ledgerWs.write(`End: ${getDateStr(new Date)}\n`);
  await _closeWs(ledgerWs);

  return new Map<string, string[]>();
}

type FormatDupes2Res = {
  innerLoopCount: number;
};

async function formatDupes2(dupesFilePath: string, hashSizeMap: Map<string, number>, dupeCountMap: Map<string, number>): Promise<FormatDupes2Res> {
  let formatDupes2Res: FormatDupes2Res;
  let fileHandlePromise: Promise<FileHandle> | undefined;
  let fileHandle: FileHandle | undefined;
  let fmtFileName: string;
  let fmtFilePath: string;
  let fmtWs: WriteStream;
  let hashSizeTuples: [ string, number ][];
  let rfbTimer: Timer;
  let rfbMs: number;
  let buf: Buffer;
  let totalDupeCount: number;
  let foundDupes: number;

  let debugFilePath: string;
  let debugWs: WriteStream | undefined;

  let debug2FilePath: string;
  let debug2Ws: WriteStream | undefined;

  debugFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    'debug.txt',
  ].join(path.sep);
  debug2FilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    'debug2.txt',
  ].join(path.sep);

  buf = Buffer.alloc(32 * 1024);

  fmtFileName = '0_dupes_fmt.txt';
  fmtFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    fmtFileName,
  ].join(path.sep);
  fmtWs = createWriteStream(fmtFilePath);

  rfbTimer = Timer.start();
  hashSizeTuples = [ ...hashSizeMap.entries() ];
  /*
    sort by size desc
  */
  hashSizeTuples.sort((a, b) => {
    if(a[1] > b[1]) {
      return -1;
    } else if(a[1] < b[1]) {
      return 1;
    } else {
      return a[0].localeCompare(b[0]);
    }
  });
  if(config.DEBUG_EZD) {
    debugWs = createWriteStream(debugFilePath);
    for(let i = 0; i < hashSizeTuples.length; ++i) {
      let [ hash, size ] = hashSizeTuples[i];
      debugWs.write(`${hash} ${size} ${dupeCountMap.get(hash)}\n`);
    }
    debugWs.write('\n');
    await _closeWs(debugWs);
    debugWs = undefined;
  }

  foundDupes = 0;
  totalDupeCount = 0;
  for(let i = 0; i < hashSizeTuples.length; ++i) {
    let currHashTuple: [string, number];
    let currDupeCount: number | undefined;
    currHashTuple = hashSizeTuples[i];
    if((currDupeCount = dupeCountMap.get(currHashTuple[0])) === undefined) {
      throw new Error(`unexpected undefined dupeCount for hash ${currHashTuple[0]}`);
    }
    totalDupeCount += currDupeCount;
  }

  _print({ totalDupeCount });

  let hsIter: IterableIterator<[string, number]>;
  let iterRes: IteratorResult<[string, number]>;
  let hsIdx: number;
  let innerLoopCount: number;
  let iterTimer: Timer;
  iterTimer = Timer.start();
  hsIter = hashSizeTuples[Symbol.iterator]();
  hsIdx = 0;
  innerLoopCount = 0;

  let resetFmtWsTimer: Timer;
  const resetFmtWsMs = 10 * 1e3;
  resetFmtWsTimer = Timer.start();

  let resetFhTimer: Timer;
  let resetFhMs: number;

  resetFhTimer = Timer.start();

  const resetFmtFn = CliColors.comb([ c.tomato, c.bold ]);

  await new Promise<void>((resolve) => {
    (async function doIter() {

      while(
        !(iterRes = hsIter.next()).done
        && (process.exitCode === undefined)
      ) {
        let targetHash: string;
        let dupeCount: number | undefined;
        let seekForHashRes: SeekForHashRes;

        if(config.DEBUG_EZD) {
          if(debug2Ws !== undefined) {
            await _closeWs(debug2Ws);
            debug2Ws = undefined;
          }
          if(debugWs !== undefined) {
            await _closeWs(debugWs);
            debugWs = undefined;
          }
          debugWs = createWriteStream(debugFilePath, {
            flags: 'a',
          });
          debug2Ws = createWriteStream(debug2FilePath);
        }
        if(resetFmtWsTimer.currentMs() > resetFmtWsMs) {
          resetFmtWsTimer.reset();
          await _closeWs(fmtWs);
          fmtWs = createWriteStream(fmtFilePath, {
            flags: 'a',
          });
        }

        hsIdx++;
        targetHash = iterRes.value[0];
        dupeCount = dupeCountMap.get(targetHash);
        debugWs?.write('\n');
        debugWs?.write(`hsIdx: ${hsIdx}\n`);
        debugWs?.write(`dupeCount: ${dupeCount}\n`);
        debugWs?.write(`targetHash: ${targetHash.substring(0, 7)}\n`);
        debugWs?.write(`resetFhTimer: ${_timeStr(resetFhTimer.currentMs(), false)}\n`);
        debugWs?.write(`last resetFhMs: ${_timeStr(resetFhMs, false)}\n`);
        assert(dupeCount !== undefined);
        if(resetFhTimer.currentMs() >= 1.5e5) {
          resetFhMs = resetFhTimer.currentMs();
          process.stdout.write(`${resetFmtFn('✗')}`);

          await fileHandle?.close();
          fileHandle = undefined;
          await sleep(FMT_DUPES_INTERRUPT_MS);
          resetFhTimer.reset();
        }
        if(fileHandle === undefined) {
          fileHandlePromise = fs.open(dupesFilePath);
          fileHandle = await fileHandlePromise;
        }
        debug2Ws?.write(`\nseek: ${targetHash.substring(0, 7)}\n`);
        seekForHashRes = await seekForHash({
          targetHash,
          fileHandle,
          buf,
          dupeCount,
          fmtWs,
          debug2Ws,
        });
        innerLoopCount += seekForHashRes.innerLoopCount;
        debugWs?.write(`ilc: ${innerLoopCount}\n`);
        debugWs?.write(`ilcAvg: ${(Math.round((innerLoopCount / hsIdx) * 100) / 100)}\n`);

        foundDupes += dupeCount;

        if((hsIdx % 250) === 0) {
          process.stdout.write(((foundDupes / totalDupeCount) * 100).toFixed(3));
        }
        if((hsIdx % 25) === 0) {
          process.stdout.write('.');
        }

        if(iterTimer.currentMs() > ITER_INTERRUPT_MS) {
          /*
            force the loop to execute async so that it is interruptable
              by signals like SIGINT, SIGTERM
          */
          iterTimer.reset();
          setImmediate(doIter);
          return;
        }
      }
      resolve();
    })();
  });
  /* reset filehandle */
  await fileHandle?.close();
  fileHandlePromise?.finally(() => {
    fileHandle?.close();
  });
  fileHandle = undefined;

  fmtWs.close();
  debugWs?.close();
  debug2Ws?.close();
  rfbMs = rfbTimer.stop();
  process.stdout.write('\n\n');
  process.stdout.write(`formatDupes2() took ${timeFmt(rfbMs)} (${rfbMs} ms)\n`);
  formatDupes2Res = {
    innerLoopCount,
  };
  return formatDupes2Res;
}

function _closeWs(ws?: WriteStream): Promise<void> {
  let closePromise: Promise<void>;
  if(ws === undefined) {
    return Promise.resolve();
  }
  closePromise = new Promise((resolve) => {
    ws.once('close', () => {
      resolve();
    });
  });
  ws.close();
  return closePromise;
}

type SeekForHashOpts = {
  fileHandle: FileHandle;
  buf: Buffer;
  targetHash: string;
  dupeCount: number;
  fmtWs: WriteStream;
  debug2Ws?: WriteStream | undefined;
};

type SeekForHashRes = {
  innerLoopCount: number;
};

async function seekForHash(opts: SeekForHashOpts): Promise<SeekForHashRes> {
  let fileHandle: FileHandle;
  let buf: Buffer;
  let targetHash: string;
  let dupeCount: number;
  let readRes: FileReadResult<Buffer>;
  let fmtWs: WriteStream;

  let drainDeferred: Deferred | undefined;
  let innerLoopCount: number;
  let line: string;
  let pos: number;
  let skip: boolean;

  let debug2Ws: WriteStream | undefined;

  fileHandle = opts.fileHandle;
  buf = opts.buf;
  targetHash = opts.targetHash;
  dupeCount = opts.dupeCount;
  fmtWs = opts.fmtWs;

  innerLoopCount = 0;
  line = '';
  pos = 0;
  skip = false;

  debug2Ws = opts.debug2Ws;

  debug2Ws?.write(`${targetHash.substring(0, 7)}\n`);

  for(;;) {
    let bufStr: string;
    let nlRx: RegExp;
    let lastNlPos: number;
    buf.fill(0);
    readRes = await fileHandle.read(buf, 0, buf.length, pos);
    bufStr = buf.subarray(0, readRes.bytesRead).toString();
    nlRx = /\n/g;
    lastNlPos = -1;

    while(nlRx.exec(bufStr) !== null) {
      let nlSub: string;
      let nlIdx: number;
      let lineRx: RegExp;
      let lineRxRes: RegExpExecArray | null;
      let fileHash: string | undefined;

      innerLoopCount++;

      nlIdx = nlRx.lastIndex;
      /* terminal */
      nlSub = bufStr.substring(lastNlPos, nlIdx - 1);

      line += nlSub;
      lastNlPos = nlIdx;

      lineRx = /^(?<fileHash>[a-f0-9]+) [0-9]+ .*$/;
      lineRxRes = lineRx.exec(line);
      fileHash = lineRxRes?.groups?.fileHash;
      if(fileHash === undefined) {
        console.log(line.split('\n'));
        throw new Error(`invalid filehash on line: ${line}`);
      }
      if(fileHash === targetHash) {
        let wsRes: boolean;
        if(drainDeferred !== undefined) {
          process.stdout.write('|');
          await drainDeferred.promise;
        }
        wsRes = fmtWs.write(`${line}\n`);

        // opts.debugWs?.write(`${pos} ${nlIdx}\n`);
        debug2Ws?.write(`dupe count: ${dupeCount}\n`);
        debug2Ws?.write(`ilc: ${innerLoopCount}\n`);

        dupeCount--;
        if(!wsRes) {
          process.stdout.write('•');
          if(drainDeferred === undefined) {
            drainDeferred = Deferred.init();
            drainDeferred.promise.finally(() => {
              drainDeferred = undefined;
            });
            fmtWs.once('drain', () => {
              setImmediate(() => {
                if(drainDeferred === undefined) {
                  throw new Error('Enexpected undefined drainDeferred');
                }
                drainDeferred.resolve();
              });
            });
          }
        }
      }
      line = '';
      if(dupeCount < 1) {
        skip = true;
        break;
      }
    }
    if(skip) {
      break;
    }
    pos += readRes.bytesRead;
    if(readRes.bytesRead === 0) {
      console.log('readRes.bytesRead === 0');
      break;
    }
    line += bufStr.substring(lastNlPos);
  }
  opts.debug2Ws?.write('\n');
  return {
    innerLoopCount,
  };
}

type GetFileHashesRes = {
  hashMap: Map<string, number>;
  hashFilePath: string;
};

async function getFileHashes(sizeFilePath: string, possibleDupeSizeMap: Map<number, number>, possibleDupeCount: number): Promise<GetFileHashesRes> {
  let hashFileName: string;
  let hashFilePath: string;
  let hashWs: WriteStream;
  let runningHashPromises: number;
  let hashMap: Map<string, number>;
  let drainDeferred: Deferred | undefined;
  let rflTimer: Timer;

  let getFileHashesRes: GetFileHashesRes;

  let finishedHashCount: number;
  let percentTimer: Timer;

  finishedHashCount = 0;

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
  percentTimer = Timer.start();

  const fileSizesFileLineCb: ReadFileByLineOpts['lineCb'] = (line, resumeCb) => {
    let filePath: string;
    let fileSize: number;
    let lineRx: RegExp;
    let rxExecRes: RegExpExecArray | null;
    let hashPromise: Promise<void>;
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
    hashPromise = (async () => {
      let fileHash: string | undefined;
      let hashFileLine: string;
      let wsRes: boolean;
      let hashCount: number | undefined;
      while(runningHashPromises >= maxConcurrentHashPromises) {
        await sleepImmediate();
      }
      runningHashPromises++;
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
      if(drainDeferred !== undefined) {
        await drainDeferred.promise;
      }
      wsRes = hashWs.write(`${hashFileLine}\n`);
      if(!wsRes) {
        if(drainDeferred === undefined) {
          process.stdout.write('|');
          drainDeferred = Deferred.init();
          hashWs.once('drain', () => {
            setImmediate(() => {
              process.stdout.write('•');
              if(drainDeferred === undefined) {
                throw new Error('Enexpected undefined drainDeferred');
              }
              drainDeferred.resolve();
            });
          });
          drainDeferred.promise.finally(() => {
            drainDeferred = undefined;
          });
        }
      }
    })();
    hashPromise.finally(() => {
      runningHashPromises--;
      finishedHashCount++;
      if(runningHashPromises < maxConcurrentHashPromises) {
        resumeCb();
      }
      if(rflTimer.currentMs() > rflMod) {
        process.stdout.write('.');
        rflTimer.reset();
      }
      if(percentTimer.currentMs() > (rflMod * 5)) {
        process.stdout.write(((finishedHashCount / possibleDupeCount) * 100).toFixed(2));
        percentTimer.reset();
      }
    });
    if(runningHashPromises >= maxConcurrentHashPromises) {
      return 'pause';
    }
    if(process.exitCode !== undefined) {
      return 'finish';
    }
  };
  await readFileByLine(sizeFilePath, {
    lineCb: fileSizesFileLineCb,
    highWaterMark: RFL_HWM,
  });
  console.log('rfl done');
  while(runningHashPromises > 0) {
    await sleep(10);
  }
  hashWs.close();
  process.stdout.write('\n');
  getFileHashesRes = {
    hashFilePath,
    hashMap,
  };
  return getFileHashesRes;
}

type GetDuplicateFileHashesRes = {
  dupesFilePath: string;
  hashSizeMap: Map<string, number>;
};

async function getDuplicateFileHashes(hashFilePath: string, dupeMap: Map<string, number>): Promise<GetDuplicateFileHashesRes> {
  let getDuplicateFileHashesRes: GetDuplicateFileHashesRes;
  let runningDupePromises: number;
  let hashSizeMap: Map<string, number>;
  let dupesFileName: string;
  let dupesFilePath: string;
  let dupesWs: WriteStream;
  let drainDeferred: Deferred | undefined;
  let rflTimer: Timer;

  runningDupePromises = 0;
  hashSizeMap = new Map();

  dupesFileName = '0_dupes.txt';
  dupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);
  dupesWs = createWriteStream(dupesFilePath);

  rflTimer = Timer.start();

  const fileHashesFileLineCb: ReadFileByLineOpts['lineCb'] = (line, resumeCb) => {
    let fileHash: string;
    let fileSize: number;
    let dupePromise: Promise<void>;
    let lineRx: RegExp;
    let rxExecRes: RegExpExecArray | null;
    lineRx = /^(?<fileHash>[a-f0-9]+) (?<sizeStr>[0-9]+) .*$/i;
    rxExecRes = lineRx.exec(line);
    assert((
      (rxExecRes !== null)
      && (rxExecRes.groups?.fileHash !== undefined)
      && (rxExecRes.groups?.sizeStr !== undefined)
    ), line);
    fileHash = rxExecRes.groups.fileHash;
    // [ fileHash, sizeStr, ] = line.split(' ');
    if(!dupeMap.has(fileHash)) {
      return;
    }
    fileSize = +rxExecRes.groups.sizeStr;
    assert(!isNaN(fileSize));
    runningDupePromises++;
    dupePromise = (async () => {
      let wsRes: boolean;
      wsRes = true;
      if(!hashSizeMap.has(fileHash)) {
        hashSizeMap.set(fileHash, fileSize);
      }
      if(drainDeferred !== undefined) {
        // process.stdout.write('*');
        await drainDeferred.promise;
      }
      wsRes = dupesWs.write(`${line}\n`);
      if(!wsRes) {
        // process.stdout.write('•');
        if(drainDeferred === undefined) {
          drainDeferred = Deferred.init();
          dupesWs.once('drain', () => {
            setImmediate(() => {
              if(drainDeferred === undefined) {
                throw Error('Enexpected undefined drainDeferred');
              }
              drainDeferred.resolve();
            });
          });
          drainDeferred.promise.finally(() => {
            drainDeferred = undefined;
          });
        }
        // process.stdout.write('*');
        // await drainDeferred.promise;
      }
    })();
    dupePromise.finally(() => {
      runningDupePromises--;
      if(runningDupePromises < maxDupePromises) {
        resumeCb();
      }
      if(rflTimer.currentMs() > rflMod) {
        process.stdout.write('.');
        rflTimer.reset();
      }
    });
    if(runningDupePromises >= maxDupePromises) {
      return 'pause';
    }
  };
  await readFileByLine(hashFilePath, {
    lineCb: fileHashesFileLineCb,
  });
  console.log('rfl done');
  while(runningDupePromises > 0) {
    await sleep(10);
  }
  dupesWs.close();
  getDuplicateFileHashesRes = {
    dupesFilePath,
    hashSizeMap,
  };
  return getDuplicateFileHashesRes;
}

type GetFileSizesRes = {
  sizeFilePath: string;
  sizeMap: Map<number, number>;
};

async function getFileSizes2(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetFileSizesRes> {
  let sizeMap: Map<number, number>;
  let rflTimer: Timer;
  let sizeFileName: string;
  let sizeFilePath: string;
  let sizeWs: WriteStream;
  let lineCount: number;

  let getFileSizeRes: GetFileSizesRes;

  sizeMap = new Map();
  rflTimer = Timer.start();
  lineCount = 0;

  // sizeFileName = `${getDateFileStr(opts.nowDate)}_sizes.txt`;
  sizeFileName = '0_sizes.txt';
  // sizeFileName = 'sizes.txt';
  sizeFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    sizeFileName,
  ].join(path.sep);
  sizeWs = createWriteStream(sizeFilePath);

  const fileDataFileLineCb: ReadFileByLineOpts['lineCb'] = (line: string, resumeCb: () => void) => {

    lineCount++;

    let fileStats: Stats | undefined;
    let fileSize: number;
    let fileSizeCount: number | undefined;
    let sizeFileLine: string;
    try {
      fileStats = statSync(line);
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
        return;
      }
      console.error(e);
      throw e;
    }
    fileSize = fileStats.size;
    if((fileSizeCount = sizeMap.get(fileSize)) === undefined) {
      fileSizeCount = 0;
    }
    sizeMap.set(fileSize, fileSizeCount + 1);
    sizeFileLine = `${fileSize} ${line}`;
    sizeWs.write(`${sizeFileLine}\n`);
    if(rflTimer.currentMs() > rflMod) {
      process.stdout.write('.');
      rflTimer.reset();
    }
  };

  await readFileByLine(filesDataFilePath, {
    lineCb: fileDataFileLineCb,
  });
  sizeWs.close();
  // rflMs = rflTimer.stop();
  // console.log('rfl done');
  // console.log(`getFileSizes2() took: ${getIntuitiveTimeString(rflMs)} (${rflMs} ms)`);

  console.log(`${c.italic('lineCount')}: ${c.yellow_light(lineCount)}`);

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

function _print(val: unknown, opts: {
  valFmtFn?: ColorFormatter
} = {}) {
  let valFmtFn: ColorFormatter;

  valFmtFn = opts.valFmtFn ?? _fmtFn;

  if(isFlatObject(val)) {
    let keys: string[];
    keys = Object.keys(val);
    for(let i = 0; i < keys.length; ++i) {
      console.log(`${keys[i]}: ${valFmtFn(val[keys[i]])}`);
    }
  } else {
    valFmtFn(val);
  }

  function _fmtFn(val: unknown): string {
    switch(typeof val) {
      case 'boolean':
        return c.pink(val);
      case 'number':
        return c.yellow_light(val);
      case 'string':
        return CliColors.rgb(100, 255, 100)(`'${val}'`);
      case 'object':
        throw new Error('no objects :/');
      default:
        return c.yellow_light(val);
    }
  }
}

function isFlatObject(val: unknown): val is Record<string, unknown> {
  let vals: unknown[];
  if(!isObject(val)) {
    return false;
  }
  vals = Object.values(val);
  for(let i = 0; i < vals.length; ++i) {
    if(
      isObject(vals[i])
      || Array.isArray(vals[i])
    ) {
      return false;
    }
  }
  return true;
}
