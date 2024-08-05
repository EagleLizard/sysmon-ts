
import { Timer } from '../../../util/timer';
import { _closeWs, _print, _timeStr } from './find-dupes-utils';
import { scanDirColors as c } from '../scan-dir-colors';
import { SCANDIR_FIND_DUPES_TMP_DIR, SCANDIR_OUT_DATA_DIR_PATH } from '../../../../constants';
import { LineReader2, checkDir, getLineReader2, mkdirIfNotExist } from '../../../util/files';
import { readdir, rm } from 'fs/promises';
import path from 'path';
import { Dirent, WriteStream, createWriteStream } from 'fs';
import { Deferred } from '../../../../test/deferred';
import assert from 'assert';

export const SORT_CHUNK_FILE_LINE_COUNT = 100;
// export const SORT_CHUNK_FILE_LINE_COUNT = 250;
// export const SORT_CHUNK_FILE_LINE_COUNT = 500;
// export const SORT_CHUNK_FILE_LINE_COUNT = 1e3;
// export const SORT_CHUNK_FILE_LINE_COUNT = 1e4;

const RFL_MOD = 500;

type FileHashInfo = {
  hash: string;
  size: number;
  filePath: string;
};

export async function sortDuplicates(dupeFilePath: string, totalDupeCount: number, nowDate: Date) {
  let tmpDirExists: boolean;
  let tmpDir: string;

  let tmpChunksTimer: Timer;
  let sortChunksTimer: Timer;
  let tmpChunksMs: number;
  let sortChunksMs: number;

  const sortTimeStr = (ms: number) => {
    return _timeStr(ms, {
      fmtTimeFn: c.cyan,
    });
  };

  tmpDir = SCANDIR_FIND_DUPES_TMP_DIR;
  tmpDirExists = checkDir(tmpDir);
  if(tmpDirExists) {
    await rm(tmpDir, {
      recursive: true,
    });
  }
  mkdirIfNotExist(tmpDir);

  tmpChunksTimer = Timer.start();
  await writeTmpDupeSortChnks(dupeFilePath, tmpDir, totalDupeCount);
  tmpChunksMs = tmpChunksTimer.stop();
  console.log(`writeTmpDupeSortChunks() took: ${sortTimeStr(tmpChunksMs)}`);

  sortChunksTimer = Timer.start();
  await sortTmpDupeChunks2(tmpDir, totalDupeCount, nowDate);
  sortChunksMs = sortChunksTimer.stop();
  console.log(`sortTmpDupeChunks() took: ${sortTimeStr(sortChunksMs)}`);
}

async function sortTmpDupeChunks2(tmpDir: string, totalDupeCount: number, nowDate: Date) {
  let dupesFmtFileName: string;
  let dupesFmtFilePath: string;

  let dupeChunkDirents: Dirent[];

  let sortCount: number;
  let lrBufSize: number;

  // lrBufSize = 256 * 1024;
  lrBufSize = 64 * 1024;
  // lrBufSize = 32 * 1024;
  // lrBufSize = 16 * 1024;
  // lrBufSize = 8 * 1024;
  // lrBufSize = 4 * 1024;
  // lrBufSize = 2 * 1024;
  // lrBufSize = 1 * 1024;

  _print({ lrBufSize });

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
    let isLastSort: boolean;
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
    isLastSort = tmpFileQueue.length === 0;
    lineReaderA = await getLineReader2(tmpFileA, {
      bufSize: lrBufSize,
    });
    lineReaderB = await getLineReader2(tmpFileB, {
      bufSize: lrBufSize,
    });
    lineA = await lineReaderA.read();
    lineB = await lineReaderB.read();
    if(isLastSort) {
      sortFilePath = dupesFmtFilePath;
    } else {
      let sortFileName: string;
      sortFileName = `a_${sortFileCounter++}.txt`;
      sortFilePath = [
        SCANDIR_FIND_DUPES_TMP_DIR,
        sortFileName,
      ].join(path.sep);
    }
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
      let hashA: string | undefined;
      let hashB: string | undefined;
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
        hashA = fileHashInfoA.hash;
      }
      if(lineB !== undefined) {
        let fileHashInfoB: FileHashInfo | undefined;
        fileHashInfoB = getHashInfo(lineB);
        sizeB = fileHashInfoB.size;
        hashB = fileHashInfoB.hash;
      }

      if(sizeA > sizeB) {
        writeA = true;
      } else if(sizeA < sizeB) {
        writeB = true;
      } else {
        if(
          (sizeA !== -1)
          && (sizeB !== -1)
        ) {
          assert(
            (hashA !== undefined)
            && (hashB !== undefined)
            && (lineA !== undefined)
            && (lineB !== undefined)
          );
          if(hashA.localeCompare(hashB) < 0) {
            writeA = true;
          } else if(hashA.localeCompare(hashB) > 0) {
            writeB = true;
          } else {
            writeA = true;
            writeB = true;
          }
        } else if(sizeA !== -1) {
          writeA = true;
        } else if(sizeB !== -1) {
          writeB = true;
        }
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
    }
    await lineReaderA.close();
    await lineReaderB.close();

    await _closeWs(sortFileWs);
    tmpFileQueue.push(sortFilePath);

    await rm(tmpFileA);
    await rm(tmpFileB);
  }
  process.stdout.write('\n');
  _print({ sortCount });
  assert(tmpFileQueue.length === 1);
  let finalSortFilePath: string | undefined;
  finalSortFilePath = tmpFileQueue.pop();
  assert(finalSortFilePath !== undefined);
}

async function writeTmpDupeSortChnks(dupeFilePath: string, tmpDir: string, totalDupeCount: number) {
  let currDupeLines: string[];
  let lineReader: LineReader2;
  let line: string | undefined;
  let tmpFileCounter: number;

  let lineCount: number;

  let rflTimer: Timer;
  let percentTimer: Timer;

  let chunkSize: number;

  // sort into chunks of certain sizes

  chunkSize = SORT_CHUNK_FILE_LINE_COUNT;
  // chunkSize = Math.max(1, Math.round(SORT_CHUNK_FILE_LINE_COUNT * Math.random()));

  console.log(`chunkSize: ${c.yellow_light(chunkSize)}`);

  currDupeLines = [];
  tmpFileCounter = 0;
  lineCount = 0;
  rflTimer = Timer.start();
  percentTimer = Timer.start();

  lineReader = await getLineReader2(dupeFilePath);
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
  await lineReader.close();
  process.stdout.write('\n');

  async function _writeTmpFile(): Promise<void> {
    let tmpFileName: string;
    let tmpFilePath: string;
    let tmpFileWs: WriteStream;
    let drainDeferred: Deferred | undefined;

    let lineSizeTuples: [ hash: string, size: number, line: string ][];

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
      let hashStr: string | undefined;
      let sizeStr: string | undefined;
      let size: number;
      currLine = currDupeLines[i];
      lineRx = /^(?<hashStr>[a-f0-9]+) (?<fileSize>[0-9]+) .*$/i;
      rxExecRes = lineRx.exec(currLine);
      hashStr = rxExecRes?.groups?.hashStr;
      sizeStr = rxExecRes?.groups?.fileSize;
      assert(
        (hashStr !== undefined)
        && (sizeStr !== undefined)
      );
      size = +sizeStr;
      assert(!isNaN(size));
      lineSizeTuples.push([ hashStr, size, currLine ]);
    }

    lineSizeTuples.sort((a, b) => {
      if(a[1] > b[1]) {
        return -1;
      } else if(a[1] < b[1]) {
        return 1;
      } else {
        return a[0].localeCompare(b[0]);
      }
    });

    currDupeLines = [];
    tmpFileWs = createWriteStream(tmpFilePath);

    for(let i = 0; i < lineSizeTuples.length; ++i) {
      let currLine: string;
      currLine = lineSizeTuples[i][2];
      await _writeTmpWs(`${currLine}\n`);
    }
    await _closeWs(tmpFileWs);

    async function _writeTmpWs(str: string) {
      let wsRes: boolean;
      let writeDeferred: Deferred;
      if(drainDeferred !== undefined) {
        await drainDeferred.promise;
      }
      writeDeferred = Deferred.init();
      wsRes = tmpFileWs.write(str, (err) => {
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
        drainDeferred = Deferred.init();
        tmpFileWs.once('drain', () => {
          assert(drainDeferred !== undefined);
          drainDeferred.resolve();
        });
        drainDeferred.promise.finally(() => {
          drainDeferred = undefined;
        });
      }
    }
  }
}

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
