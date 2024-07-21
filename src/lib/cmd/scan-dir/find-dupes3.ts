
import assert from 'assert';
import path from 'path';
import { Dirent, Stats, WriteStream, createWriteStream } from 'fs';
import { cp, lstat, readdir, rm } from 'fs/promises';

import { ScanDirOpts } from '../parse-sysmon-args';
import { logger } from '../../logger';
import { isObject, isString } from '../../util/validate-primitives';
import { LineReader, LineReader2, checkDir, getLineReader, mkdirIfNotExist, getLineReader2 } from '../../util/files';
import { SCANDIR_FIND_DUPES_TMP_DIR, SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { Deferred } from '../../../test/deferred';
import { Timer } from '../../util/timer';
import { scanDirColors as c } from './scan-dir-colors';
import { CliColors, ColorFormatter } from '../../service/cli-colors';
import { HashFile2Opts, hashFile2 } from '../../util/hasher';
import { getIntuitiveTimeString } from '../../util/format-util';
import { sleep, sleepImmediate } from '../../util/sleep';

const RFL_MOD = 500;

const HASH_RFL_MOD = 250;

// const HASH_PROMISE_CHUNK_SIZE = 16;
// const HASH_PROMISE_CHUNK_SIZE = 32;
const HASH_PROMISE_CHUNK_SIZE = 64;
// const HASH_PROMISE_CHUNK_SIZE = 128;
// const HASH_PROMISE_CHUNK_SIZE = 256;

// const HASH_HWM = 16 * 1024;
// const HASH_HWM = 32 * 1024;
const HASH_HWM = 64 * 1024;

// const SORT_CHUNK_FILE_LINE_COUNT = 100;
const SORT_CHUNK_FILE_LINE_COUNT = 1e3;
// const SORT_CHUNK_FILE_LINE_COUNT = 1e4;
// const NUM_SORT_DUPE_CHUNKS = 100;
const NUM_SORT_DUPE_CHUNKS = 50;

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
  let hashFilePath: string;
  let hashCountMap: Map<string, number>;

  let getPossibleDupesMs: number;
  let getFileHashesMs: number;
  let getFileHashesTimeStr: string;

  let getFileDupesRes: GetFileDupesRes;
  let dupeFilePath: string;
  let dupeCountMap: Map<string, number>;
  let totalDupeCount: number;

  let fdTimer: Timer;

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

  hashFilePath = getFileHashesRes.hashFilePath;
  hashCountMap = getFileHashesRes.hashCountMap;
  getFileDupesRes = await getFileDupes(hashFilePath, hashCountMap, opts.nowDate);
  dupeFilePath = getFileDupesRes.dupesFilePath;
  dupeCountMap = getFileDupesRes.dupeCountMap;

  totalDupeCount = getTotalDupeCount(dupeCountMap);
  _print({ totalDupeCount });

  await sortDuplicates(dupeFilePath, totalDupeCount, opts.nowDate);

  return new Map<string, string[]>();
}

async function sortDuplicates(dupeFilePath: string, totalDupeCount: number, nowDate: Date) {
  let tmpDirExists: boolean;
  let tmpDir: string;
  tmpDir = SCANDIR_FIND_DUPES_TMP_DIR;
  tmpDirExists = await checkDir(tmpDir);
  if(tmpDirExists) {
    await rm(tmpDir, {
      recursive: true,
    });
  }
  mkdirIfNotExist(tmpDir);
  await writeTmpDupeSortChnks(dupeFilePath, tmpDir, totalDupeCount);

  // await sortTmpDupeChunks(tmpDir, totalDupeCount, nowDate);
  await sortTmpDupeChunks2(tmpDir, totalDupeCount, nowDate);
}

type DupeLineInfo = {
  key: string;
  line: string | undefined;
  fileHashInfo: FileHashInfo | undefined;
};

async function sortTmpDupeChunks2(tmpDir: string, totalDupeCount: number, nowDate: Date) {
  let dupesFmtFileName: string;
  let dupesFmtFilePath: string;

  let dupeChunkDirents: Dirent[];

  let sortCount: number;

  sortCount = 0;

  dupesFmtFileName = 'z1_dupes_fmt.txt';
  dupesFmtFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFmtFileName,
  ].join(path.sep);

  dupeChunkDirents = await readdir(tmpDir, {
    withFileTypes: true,
  });

  /*
    Store files in a queue.
    1. Remove the first 2 files from the front of the queue
    2. sort the 2 files into a new file, push new file
      onto the end of the queue
    3. repeat until queue.length == 0, final file is the
      sorted result
   */
  let tmpFileQueue: string[];
  let sortFileCounter: number;
  sortFileCounter = 0;
  tmpFileQueue = [];

  for(let i = 0; i < dupeChunkDirents.length; ++i) {
    let currDirent: Dirent;
    let currFileName: string;
    let currFilePath: string;
    let fileNameRx: RegExp;
    currDirent = dupeChunkDirents[i];
    currFileName = currDirent.name;
    fileNameRx = /^[0-9]+.txt$/i;
    if(!fileNameRx.test(currFileName)) {
      throw new Error(`Invalid file name in tmpDir: ${currFileName}`);
    }
    currFilePath = [
      currDirent.parentPath,
      currFileName,
    ].join(path.sep);
    tmpFileQueue.push(currFilePath);
  }

  while(tmpFileQueue.length > 1) {
    let tmpFileA: string | undefined;
    let tmpFileB: string | undefined;
    let lineReaderA: LineReader2;
    let lineReaderB: LineReader2;
    let lineA: string | undefined;
    let lineB: string | undefined;
    let sortFileName: string;
    let sortFilePath: string;
    let sortFileWs: WriteStream;

    let drainDeferred: Deferred | undefined;

    tmpFileA = tmpFileQueue.shift();
    tmpFileB = tmpFileQueue.shift();
    assert((
      1
      && (tmpFileA !== undefined)
      && (tmpFileB !== undefined)
    ));
    lineReaderA = await getLineReader2(tmpFileA);
    lineReaderB = await getLineReader2(tmpFileB);
    lineA = await lineReaderA.read();
    lineB = await lineReaderB.read();
    sortFileName = `a_${sortFileCounter++}.txt`;
    sortFilePath = [
      SCANDIR_FIND_DUPES_TMP_DIR,
      sortFileName,
    ].join(path.sep);
    sortFileWs = createWriteStream(sortFilePath);
    const writeSortFileWs = async (str: string) => {
      let wsRes:boolean;
      if(drainDeferred !== undefined) {
        await drainDeferred.promise;
      }
      wsRes = sortFileWs.write(str);
      if(
        !wsRes
        && (drainDeferred === undefined)
      ) {
        drainDeferred = Deferred.init();
        sortFileWs.once('drain', () => {
          assert(drainDeferred !== undefined);
          drainDeferred.resolve();
        });
        drainDeferred.promise.finally(() => {
          drainDeferred = undefined;
        });
      }
    };
    while(
      (lineA !== undefined)
      || (lineB !== undefined)
    ) {
      let sizeA: number;
      let sizeB: number;
      let writeA: boolean;
      let writeB: boolean;
      sizeA = -1;
      sizeB = -1;
      writeA = false;
      writeB = false;

      if(lineA !== undefined) {
        let fileHashInfoA: FileHashInfo | undefined;
        fileHashInfoA = getHashInfo(lineA);
        sizeA = fileHashInfoA.size;
      }
      if(lineB !== undefined) {
        let fileHashInfoB: FileHashInfo | undefined;
        fileHashInfoB = getHashInfo(lineB);
        sizeB = fileHashInfoB.size;
      }

      if(sizeA > sizeB) {
        writeA = true;
      } else if(sizeA < sizeB) {
        writeB = true;
      } else {
        writeA = true;
        writeB = true;
      }
      if(writeA) {
        await writeSortFileWs(`${lineA}\n`);
        lineA = await lineReaderA.read();
      }
      if(writeB) {
        await writeSortFileWs(`${lineB}\n`);
        lineB = await lineReaderB.read();
      }
      sortCount++;
      // if((sortCount % 1e4) === 0) {
      //   process.stdout.write('.');
      // }
      await sleepImmediate();
    }
    await lineReaderA.close();
    await lineReaderB.close();

    await _closeWs(sortFileWs);
    tmpFileQueue.push(sortFilePath);

    await rm(tmpFileA);
    await rm(tmpFileB);

    // await sleep(0);
  }
  process.stdout.write('\n');
  console.log({ sortCount });
  assert(tmpFileQueue.length === 1);
  let finalSortFilePath: string | undefined;
  finalSortFilePath = tmpFileQueue.pop();
  assert(finalSortFilePath !== undefined);
  await cp(finalSortFilePath, dupesFmtFilePath);

}

async function sortTmpDupeChunks(tmpDir: string, totalDupeCount: number, nowDate: Date) {
  let dupesFmtFileName: string;
  let dupesFmtFilePath: string;
  let dupesFmtWs: WriteStream;
  let drainDeferred: Deferred | undefined;

  let dupeChunkDirents: Dirent[];

  let lineReaderMap: Map<string, LineReader2>;

  dupesFmtFileName = 'z1_dupes_fmt.txt';
  dupesFmtFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFmtFileName,
  ].join(path.sep);
  dupesFmtWs = createWriteStream(dupesFmtFilePath);

  dupeChunkDirents = await readdir(tmpDir, {
    withFileTypes: true,
  });
  lineReaderMap = new Map();
  for(let i = 0; i < dupeChunkDirents.length; ++i) {
    let currDirent: Dirent;
    let currFileName: string;
    let currFilePath: string;
    let fileNameRx: RegExp;
    let lineReader: LineReader2;
    currDirent = dupeChunkDirents[i];
    currFileName = currDirent.name;
    fileNameRx = /^[0-9]+.txt$/i;
    if(!fileNameRx.test(currFileName)) {
      throw new Error(`Invalid file name in tmpDir: ${currFileName}`);
    }
    currFilePath = [
      currDirent.parentPath,
      currFileName,
    ].join(path.sep);
    lineReader = await getLineReader2(currFilePath);
    lineReaderMap.set(currFilePath, lineReader);
  }
  let iterCount: number;
  let dupeLineInfos: DupeLineInfo[];
  iterCount = 0;
  dupeLineInfos = [];
  let lrIter: IterableIterator<string>;
  let lrIterRes: IteratorResult<string>;
  lrIter = lineReaderMap.keys();
  while(!(lrIterRes = lrIter.next()).done) {
    let currKey: string;
    let currLineReader: LineReader | undefined;
    let line: string | undefined;
    let fileHashInfo: FileHashInfo;
    currKey = lrIterRes.value;
    currLineReader = lineReaderMap.get(currKey);
    assert(currLineReader !== undefined);
    line = await currLineReader.read();
    /* line shouldn't be undefined (tmp files should not be empty at start) */
    assert(line !== undefined);
    fileHashInfo = getHashInfo(line);
    dupeLineInfos.push({
      key: currKey,
      line,
      fileHashInfo,
    });
  }
  while(lineReaderMap.size > 0) {
    iterCount++;
    /* find largest size */
    let maxIdx: number;
    let maxDupeInfo: DupeLineInfo | undefined;
    let maxLineReader: LineReader2 | undefined;
    let nextLineRes: string | undefined;
    let nextHashInfo: FileHashInfo | undefined;
    let nextDupeInfo: DupeLineInfo | undefined;
    let wsRes: boolean;
    maxIdx = -1;
    for(let i = 0; i < dupeLineInfos.length; ++i) {
      let currSize: number;
      let currDupeInfo: DupeLineInfo;
      let currFileHashInfo: FileHashInfo | undefined;
      currDupeInfo = dupeLineInfos[i];
      currFileHashInfo = currDupeInfo.fileHashInfo;
      if(currFileHashInfo === undefined) {
        throw new Error(`unexpected undefined fileHashInfo: ${currDupeInfo.key}`);
      } else {
        currSize = currFileHashInfo.size;
        if(
          (maxDupeInfo === undefined)
          || (maxDupeInfo.fileHashInfo === undefined)
          || (currSize > maxDupeInfo.fileHashInfo.size)
        ) {
          maxDupeInfo = currDupeInfo;
          maxIdx = i;
        }
      }
    }
    assert(
      (maxIdx !== -1)
      && (maxDupeInfo !== undefined)
    );
    maxLineReader = lineReaderMap.get(maxDupeInfo.key);
    assert(maxLineReader !== undefined);
    nextLineRes = await maxLineReader.read();
    if(nextLineRes === undefined) {
      /*
        remove from map,
        remove from lineInfos
       */
      lineReaderMap.delete(maxDupeInfo.key);
      dupeLineInfos.splice(maxIdx, 1);
      await maxLineReader.close();
    } else {
      nextHashInfo = getHashInfo(nextLineRes);
      nextDupeInfo = {
        key: maxDupeInfo.key,
        line: nextLineRes,
        fileHashInfo: nextHashInfo,
      };
      dupeLineInfos[maxIdx] = nextDupeInfo;
    }

    /*
      write line to file
      replace line and hash info with next entry
     */
    if(drainDeferred !== undefined) {
      await drainDeferred.promise;
    }
    let writeDeferred: Deferred;
    writeDeferred = Deferred.init();
    wsRes = dupesFmtWs.write(`${maxDupeInfo.line}\n`, (err) => {
      if(err) {
        return writeDeferred.reject(err);
      }
      writeDeferred.resolve();
    });
    await writeDeferred.promise;

    if(
      !wsRes
      && (drainDeferred === undefined)
    ) {
      process.stdout.write('|');
      drainDeferred = Deferred.init();
      dupesFmtWs.once('drain', () => {
        setImmediate(() => {
          assert(drainDeferred !== undefined);
          drainDeferred.resolve();
        });
      });
      drainDeferred.promise.finally(() => {
        drainDeferred = undefined;
      });
    }
    // await sleep(0);
    // await sleepImmediate();
  }
  _print({ iterCount });
}

type FileHashInfo = {
  hash: string;
  size: number;
  filePath: string;
};

function getHashInfo(line: string): FileHashInfo {
  let lineRx: RegExp;
  let rxExecRes: RegExpExecArray | null;
  let hash: string | undefined;
  let sizeStr: string | undefined;
  let filePath: string | undefined;
  let size: number;
  lineRx = /^(?<hash>[a-f0-9]+) (?<size>[0-9]+) (?<filePath>.*)$/i;
  rxExecRes = lineRx.exec(line);
  hash = rxExecRes?.groups?.hash;
  sizeStr = rxExecRes?.groups?.size;
  filePath = rxExecRes?.groups?.filePath;
  assert((
    1
    && (hash !== undefined)
    && (sizeStr !== undefined)
    && (filePath !== undefined)
  ), `line: ${JSON.stringify(line)}`);
  size = +sizeStr;
  assert(!isNaN(size));
  return {
    hash,
    size,
    filePath,
  };
}

async function writeTmpDupeSortChnks(dupeFilePath: string, tmpDir: string, totalDupeCount: number) {
  let currDupeLines: string[];
  let lineReader: LineReader;
  let line: string | undefined;
  let tmpFileCounter: number;

  let lineCount: number;

  let rflTimer: Timer;
  let percentTimer: Timer;

  let chunkSize: number;

  // sort into chunks of certain sizes

  chunkSize = SORT_CHUNK_FILE_LINE_COUNT;
  // chunkSize = Math.ceil(totalDupeCount / NUM_SORT_DUPE_CHUNKS);
  console.log(`chunkSize: ${c.yellow_light(chunkSize)}`);

  currDupeLines = [];
  tmpFileCounter = 0;
  lineCount = 0;
  rflTimer = Timer.start();
  percentTimer = Timer.start();

  lineReader = getLineReader(dupeFilePath);
  while((line = await lineReader.read()) !== undefined) {
    currDupeLines.push(line);
    if(currDupeLines.length >= chunkSize) {
      await _writeTmpFile();
    }
    lineCount++;
    if(rflTimer.currentMs() > RFL_MOD) {
      process.stdout.write('⸱');
      rflTimer.reset();
    }
    if(percentTimer.currentMs() > ((RFL_MOD + 1) * 5)) {
      process.stdout.write(`${((lineCount / totalDupeCount) * 100).toFixed(2)}`);
      percentTimer.reset();
    }
  }
  if(currDupeLines.length > 0) {
    await _writeTmpFile();
  }
  process.stdout.write('\n');

  async function _writeTmpFile(): Promise<void> {
    let tmpFileName: string;
    let tmpFilePath: string;
    let tmpFileWs: WriteStream;
    let drainDeferred: Deferred | undefined;

    let lineSizeTuples: [ number, string ][];

    tmpFileName = `${tmpFileCounter++}.txt`;
    tmpFilePath = [
      tmpDir,
      tmpFileName,
    ].join(path.sep);

    lineSizeTuples = [];
    for(let i = 0; i < currDupeLines.length; ++i) {
      let currLine: string;
      let lineRx: RegExp;
      let rxExecRes: RegExpExecArray | null;
      let sizeStr: string | undefined;
      let size: number;
      currLine = currDupeLines[i];
      lineRx = /^[a-f0-9]+ (?<fileSize>[0-9]+) .*$/i;
      rxExecRes = lineRx.exec(currLine);
      sizeStr = rxExecRes?.groups?.fileSize;
      assert(sizeStr !== undefined);
      size = +sizeStr;
      assert(!isNaN(size));
      lineSizeTuples.push([ size, currLine ]);
    }

    lineSizeTuples.sort((a, b) => {
      if(a[0] > b[0]) {
        return -1;
      } else if(a[0] < b[0]) {
        return 1;
      } else {
        return 0;
      }
    });

    currDupeLines = [];
    tmpFileWs = createWriteStream(tmpFilePath);

    for(let i = 0; i < lineSizeTuples.length; ++i) {
      let currLine: string;
      currLine = lineSizeTuples[i][1];
      await _writeTmpWs(`${currLine}\n`);
    }
    let closePromise: Promise<void>;
    closePromise = new Promise((resolve, reject) => {
      tmpFileWs.close((err) => {
        if(err) {
          return reject(err);
        }
        resolve();
      });
    });
    await closePromise;

    async function _writeTmpWs(str: string) {
      let wsRes: boolean;
      if(drainDeferred !== undefined) {
        await drainDeferred.promise;
      }
      wsRes = tmpFileWs.write(str);
      if(
        !wsRes
        && (drainDeferred === undefined)
      ) {
        drainDeferred = Deferred.init();
        tmpFileWs.once('drain', () => {
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

type GetFileDupesRes = {
  dupesFilePath: string;
  dupeCountMap: Map<string, number>;
};

async function getFileDupes(hashFilePath: string, hashCountMap: Map<string, number>, nowDate: Date): Promise<GetFileDupesRes> {
  let getFileDupesRes: GetFileDupesRes;
  let dupesFileName: string;
  let dupesFilePath: string;
  let dupesWs: WriteStream;
  let drainDeferred: Deferred | undefined;
  let lineReader: LineReader;
  let line: string | undefined;
  let dupeCountMap: Map<string, number>;

  dupesFileName = 'z1_dupes.txt';
  dupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);

  dupesWs = createWriteStream(dupesFilePath);
  lineReader = getLineReader(hashFilePath);

  dupeCountMap = new Map();

  while((line = await lineReader.read()) !== undefined) {
    let fileHash: string | undefined;
    let lineRx: RegExp;
    let rxExecRes: RegExpExecArray | null;
    let hashCount: number | undefined;
    lineRx = /^(?<fileHash>[a-f0-9]+) [0-9]+ .*$/i;
    rxExecRes = lineRx.exec(line);
    // assert(rxExecRes?.groups?.fileHash !== undefined);
    fileHash = rxExecRes?.groups?.fileHash;
    assert(fileHash !== undefined);
    hashCount = hashCountMap.get(fileHash);
    if(
      (hashCount !== undefined)
      && (hashCount > 1)
    ) {
      dupeCountMap.set(fileHash, hashCount);
      await _dupesWsWrite(`${line}\n`);
    }
  }
  await _closeWs(dupesWs);
  process.stdout.write('\n');

  getFileDupesRes = {
    dupesFilePath,
    dupeCountMap,
  };
  return getFileDupesRes;

  async function _dupesWsWrite(str: string) {
    let wsRes: boolean;
    if(drainDeferred !== undefined) {
      await drainDeferred.promise;
    }
    wsRes = dupesWs.write(str);
    if(
      !wsRes
      && (drainDeferred === undefined)
    ) {
      drainDeferred = Deferred.init();
      dupesWs.once('drain', () => {
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

type GetFileHashesRes = {
  hashCountMap: Map<string, number>;
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
  let hashCountMap: Map<string, number>;
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
  hashCountMap = new Map();

  hashWs = createWriteStream(hashFilePath);
  lineReader = getLineReader(sizeFilePath);

  hashPromises = [];
  finishedHashCount = 0;
  rflTimer = Timer.start();
  percentTimer = Timer.start();

  while((line = await lineReader.read()) !== undefined) {
    let currHashPromise: Promise<FileHashLineInfo | undefined>;
    let fileSizeLineInfo: FileSizeLineInfo;
    fileSizeLineInfo = parseFileSizeLine(line);
    if(possibleDupeSizeMap.has(fileSizeLineInfo.size)) {
      currHashPromise = _getFileHash(fileSizeLineInfo.filePath, fileSizeLineInfo.size);
      currHashPromise.finally(() => {
        finishedHashCount++;
        if(rflTimer.currentMs() > HASH_RFL_MOD) {
          process.stdout.write('⸱');
          rflTimer.reset();
        }
        if(percentTimer.currentMs() > ((HASH_RFL_MOD) * 8)) {
          process.stdout.write(((finishedHashCount / possibleDupeCount) * 100).toFixed(3));
          percentTimer.reset();
        }
      });
      hashPromises.push(currHashPromise);
      if(hashPromises.length >= HASH_PROMISE_CHUNK_SIZE) {
        await getChunkFileHashes();
      }
    }
  }

  if(hashPromises.length > 0) {
    await getChunkFileHashes();
  }
  await _closeWs(hashWs);
  process.stdout.write('\n');

  getFileHashRes = {
    hashCountMap,
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
        if((hashCount = hashCountMap.get(fileHash)) === undefined) {
          hashCount = 0;
        }
        hashCountMap.set(fileHash, hashCount + 1);
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

  type FileSizeLineInfo = {
    size: number;
    filePath: string;
  };

  function parseFileSizeLine(line: string): FileSizeLineInfo {
    let filePath: string | undefined;
    let fileSizeStr: string | undefined;
    let fileSize: number;
    let lineRx: RegExp;
    let rxExecRes: RegExpExecArray | null;

    lineRx = /^(?<sizeStr>[0-9]+) (?<filePath>.*)$/i;
    rxExecRes = lineRx.exec(line);

    filePath =  rxExecRes?.groups?.filePath;
    fileSizeStr = rxExecRes?.groups?.sizeStr;

    assert((
      (filePath !== undefined)
      && (fileSizeStr !== undefined)
    ), line);
    fileSize = +fileSizeStr;
    assert(!isNaN(fileSize));
    return {
      size: fileSize,
      filePath,
    };
  }

  type FileHashLineInfo = {
    hash: string;
    size: number;
    filePath: string;
  };

  async function _getFileHash(filePath: string, size: number): Promise<FileHashLineInfo | undefined> {
    let fileHash: string | undefined;
    fileHash = await getFileHash(filePath, {
      highWaterMark: HASH_HWM,
    });
    if(fileHash === undefined) {
      return;
    }
    return {
      hash: fileHash,
      size,
      filePath,
    };
  }

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
        // console.log({ fileStats });
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
  await _closeWs(sizeWs);
  process.stdout.write('\n');

  return {
    sizeFilePath,
    sizeMap,
  };
}

function getTotalDupeCount(dupeMap: Map<string, number>): number {
  let dupeIter: IterableIterator<string>;
  let dupeIterRes: IteratorResult<string>;
  let totalDupeCount: number;
  totalDupeCount = 0;

  dupeIter = dupeMap.keys();
  while(!(dupeIterRes = dupeIter.next()).done) {
    let fileHash: string;
    let currCount: number | undefined;
    fileHash = dupeIterRes.value;
    currCount = dupeMap.get(fileHash);
    assert(currCount !== undefined);
    totalDupeCount += currCount;
  }

  return totalDupeCount;
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

function _closeWs(ws: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.close(err => {
      if(err) {
        return reject(err);
      }
      resolve();
    });
  });
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
