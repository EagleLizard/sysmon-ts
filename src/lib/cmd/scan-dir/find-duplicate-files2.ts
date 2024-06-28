
import path from 'path';
import { Stats, WriteStream, createWriteStream } from 'fs';
import fs, { FileHandle, FileReadResult, lstat } from 'fs/promises';
import assert from 'assert';

import { FindDuplicateFilesOpts } from './find-duplicate-files';
import { Deferred } from '../../../test/deferred';
import { Timer } from '../../util/timer';
import { getDateFileStr } from '../../util/datetime-util';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { ReadFileByLineOpts, readFileByLine } from '../../util/files';
import { isObject, isString } from '../../util/validate-primitives';
import { logger } from '../../logger';
import { sleep } from '../../util/sleep';
import { HashFile2Opts, hashFile2 } from '../../util/hasher';
import { getIntuitiveByteString, getIntuitiveTimeString } from '../../util/format-util';
import { scanDirColors as c } from './scan-dir-colors';
import { CliColors, ColorFormatter } from '../../service/cli-colors';

let maxConcurrentHashPromises: number;
let maxSizePromises: number;
let maxDupePromises: number;

const HASH_HWM = 32 * 1024;
// const HASH_HWM = 64 * 1024;

const RFL_HWM = 2 * 1024;
// const RFL_HWM = 4 * 1024;

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
// const rflMod = 125;

export async function findDuplicateFiles2(opts: FindDuplicateFilesOpts) {
  let sizeFilePath: string;
  let getFileSizesRes: GetFileSizesRes;
  let sizeMap: Map<number, number>;
  let possibleDupesTimer: Timer;
  let possibleDupesMs: number;

  _print({
    HASH_HWM,
    RFL_HWM,
    maxConcurrentHashPromises,
  }, {
    valFmtFn: c.yellow_yellow,
  });
  process.stdout.write('\n');

  possibleDupesTimer = Timer.start();
  getFileSizesRes = await getFileSizes(opts.filesDataFilePath, {
    nowDate: opts.nowDate,
  });
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
  console.log(`find possible dupes took: ${getIntuitiveTimeString(possibleDupesMs)}`);

  let hashFilePath: string;
  let hashMap: Map<string, number>;
  let getFileHashesRes: GetFileHashesRes;

  getFileHashesRes = await getFileHashes(sizeFilePath, possibleDupeSizeMap);
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

  let dupesFilePath: string;
  let hashSizeMap: Map<string, number>;

  let getDuplicateFileHashesRes: GetDuplicateFileHashesRes;
  getDuplicateFileHashesRes = await getDuplicateFileHashes(hashFilePath, dupeMap);
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
  await readFileByLine(dupesFilePath, {
    lineCb: hashFileLineCb,
  });
  hashFileReadMs = hashFileReadTimer.stop();
  console.log(`totalBytes: ${totalBytes} - ${getIntuitiveByteString(totalBytes)}`);
  console.log(`hashFileRead took: ${hashFileReadMs} - ${getIntuitiveTimeString(hashFileReadMs)}`);
  process.stdout.write('\n');

  await formatDupes(dupesFilePath, hashSizeMap);

  return new Map<string, string[]>();
}

/*
  nlStart = false
  hPos = 0
  hParse = false
  szParse = false

  foundHash = undefined
  foundSize = undefined
  foundFilePath = undefined
  if currChar === newline
    if hParse or szParse
      throw error, invalid format
    if fParse
      << terminal >>
      foundFilePath = chars[].join
    else
      hParse = true
    reset
  else
    if hParse
      if currChar === space
        <<terminal char>>
        set foundHash = chars[].join
        assert foundHash === hash
        set chars[].length = 0
        set hParse = false
        set szParse = true
      else
        if currChar === hash[hPos]
          chars.push(currChar)
        else
          reset
    else if szParse
      if currChar === space
        <<terminal char>>
        set foundSize = +(chars[].join)
        assert foundSize is number
        set chars[].length = 0
        set szParse = false
        set fParse = true
      else
        assert currChar is digit
        chars[].push(currChar)
    else if fParse
      chars[].push(currChar)
 */
async function formatDupes(dupesFilePath: string, hashSizeMap: Map<string, number>) {
  let fileHandlePromise: Promise<FileHandle>;
  let fileHandle: FileHandle;
  let fmtFileName: string;
  let fmtFilePath: string;
  let fmtWs: WriteStream;
  let totalBytesRead: number;
  let rfbTimer: Timer;
  let rfbMs: number;

  let findHashDupesRes: FindHashDupesRes;

  totalBytesRead = 0;

  fileHandlePromise = fs.open(dupesFilePath);
  fileHandlePromise.finally(() => {
    fileHandle.close();
  });
  fileHandle = await fileHandlePromise;

  fmtFileName = '0_dupes_fmt.txt';
  fmtFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    fmtFileName,
  ].join(path.sep);
  fmtWs = createWriteStream(fmtFilePath);

  rfbTimer = Timer.start();
  // [ targetHash, targetHashDupeCount ] = [ ...hashSizeMap.entries() ][0];
  let hashSizeTuples: [ string, number ][];
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
      return 0;
    }
  });
  // console.log(hashSizeTuples[0]);
  // [ targetHash, targetHashDupeCount ] = hashSizeTuples[0];
  for(let i = 0; i < hashSizeTuples.length; ++i) {
    let targetHash: string;
    let targetHashDupeCount: number;
    let writeHeading: boolean;
    writeHeading = true;

    const dupeCb: FindHashDupesOpts['dupeCb'] = (filePath, size, hash, range) => {
      if(writeHeading) {
        writeHeading = false;
        fmtWs.write(`${hash} ${size}\n`);
      }
      fmtWs.write(`  [ ${range.join(', ')} ]\n`);
      fmtWs.write(`  ${filePath}\n`);
    };
    let buf: Buffer;
    buf = Buffer.alloc(16 * 1023);

    [ targetHash, targetHashDupeCount ] = hashSizeTuples[i];
    findHashDupesRes = await findHashDupes({
      fileHandle,
      targetHash,
      dupeCount: targetHashDupeCount,
      buf,
      dupeCb,
    });
    totalBytesRead += findHashDupesRes.bytesRead;
    if((i % 1e3) === 0) {
      process.stdout.write(((i / hashSizeTuples.length)).toFixed(2));
    }
    if((i % 1e2) === 0) {
      process.stdout.write('.');
    }
  }

  rfbMs = rfbTimer.stop();

  console.log(`totalBytesRead: ${totalBytesRead}b (${getIntuitiveByteString(totalBytesRead)})`);
  // console.log(`read file buffer took: ${rfbMs} ms (${getIntuitiveTimeString(rfbMs)})`);
  console.log(`read file buffer took: ${getIntuitiveTimeString(rfbMs)} (${rfbMs} ms)\n`);
}

type FindHashDupesOpts = {
  fileHandle: FileHandle;
  targetHash: string;
  dupeCount: number;
  buf: Buffer,
  dupeCb: (filePath: string, size: number, hash: string, range: [ number, number ]) => void;
};

type FindHashDupesRes = {
  bytesRead: number;
}

async function findHashDupes(opts: FindHashDupesOpts): Promise<FindHashDupesRes> {
  let fileHandle: FileHandle;
  let targetHash: string;
  let dupeCount: number;

  let buf: Buffer;
  let pos: number;
  let readRes: FileReadResult<Buffer>;
  let bytesRead: number;

  let firstChar: boolean;
  let hParse: boolean;
  let szParse: boolean;
  let fParse: boolean;
  let hPos: number;
  let chars: string[];
  let foundHash: string | undefined;
  let foundSizeStr: string | undefined;
  let foundSize: number | undefined;
  let foundFilePath: string | undefined;

  let findHashDupesRes: FindHashDupesRes;

  let currChar: string;
  let currByte: number;

  let line: number;
  let col: number;

  let dupeStartPos: number | undefined;
  let dupeEndPos: number | undefined;

  fileHandle = opts.fileHandle;
  targetHash = opts.targetHash;
  dupeCount = opts.dupeCount;

  buf = opts.buf;
  pos = 0;
  bytesRead = 0;

  /* Init parsing vars  */
  hParse = false;
  szParse = false;
  fParse = false;
  hPos = 0;
  chars = [];

  firstChar = true;

  line = 1;
  col = 0;

  while((readRes = await fileHandle.read(buf, 0, buf.length, pos)).bytesRead !== 0) {
    for(let i = 0; i < buf.length; ++i) {
      // let subBuf: Buffer;

      // subBuf = buf.subarray(i, i + 1);
      currByte = buf[i];
      if(firstChar) {
        /*
          necessary because the first line doesn't start with a newline
         */
        hParse = true;
        firstChar = false;
        dupeStartPos = pos + i;
      }
      /* 10 -> '\n' */
      if(currByte === 10) {
        line++;
        col = 0;
        if(hParse || szParse) {
          throw new Error(`Invalid format, buf dump: ${buf.toString()}`);
        } else if(fParse) {
          /* terminal */
          foundFilePath = chars.join('');

          chars.length = 0;
          fParse = false;

          assert(foundFilePath.length > 0);
          assert(foundSize !== undefined);
          assert(foundHash !== undefined);
          dupeEndPos = pos + i;
          assert(dupeStartPos !== undefined);
          opts.dupeCb(foundFilePath, foundSize, foundHash, [ dupeStartPos, dupeEndPos ]);
          dupeCount--;

          foundHash = undefined;
          foundSize = undefined;
          foundFilePath = undefined;
        }
        /* reset */
        hParse = true;
        dupeStartPos = pos + i;
      } else {
        col++;
        if(hParse) {
          /* 32 -> ' ' */
          if(currByte === 32) {
            /* terminal */
            foundHash = chars.join('');
            // assert(foundHash === targetHash);
            /* start size parse */
            szParse = true;
            /* reset */
            hParse = false;
            hPos = 0;
            chars.length = 0;
          } else if(currByte === targetHash.charCodeAt(hPos)) {
            chars.push(String.fromCharCode(currByte));
            hPos++;
          } else {
            /* reset */
            hParse = false;
            szParse = false;
            chars.length = 0;
            hPos = 0;
          }
        } else if(szParse) {
          /* 32 -> ' ' */
          if(currByte === 32) {
            /* terminal */
            foundSizeStr = chars.join('');
            foundSize = +foundSizeStr;
            if(isNaN(foundSize)) {
              // console.log('readRes.bytesRead');
              // console.log(readRes.bytesRead);
              // console.log('bytes.length');
              // console.log(bytes.length);
              throw new Error(`invalid size string: ${foundSizeStr} at ${line}:${col}`);
            }
            /* reset */
            chars.length = 0;
            szParse = false;
            fParse = true;
          } else {
            chars.push(String.fromCharCode(currByte));
          }
        } else if(fParse) {
          chars.push(String.fromCharCode(currByte));
        }
      }
    }

    bytesRead += readRes.bytesRead;
    pos += readRes.bytesRead;
    if(dupeCount < 1) {
      break;
    }
  }

  findHashDupesRes = {
    bytesRead,
  };
  return findHashDupesRes;
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
      if(rflTimer.currentMs() > rflMod) {
        process.stdout.write('.');
        rflTimer.reset();
      }
    });
    if(runningHashPromises >= maxConcurrentHashPromises) {
      return 'pause';
    }
  };
  await readFileByLine(sizeFilePath, {
    lineCb: fileSizesFileLineCb,
    highWaterMark: RFL_HWM,
  });
  console.log('rfl done');
  while(runningHashPromises > 0) {
    await sleep(0);
  }
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
      if(!hashSizeMap.has(fileHash)) {
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
    await sleep(0);
  }
  getDuplicateFileHashesRes = {
    dupesFilePath,
    hashSizeMap,
  };
  return getDuplicateFileHashesRes;
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

  // sizeFileName = `${getDateFileStr(opts.nowDate)}_sizes.txt`;
  sizeFileName = '0_sizes.txt';
  // sizeFileName = 'sizes.txt';
  sizeFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    sizeFileName,
  ].join(path.sep);
  sizeWs = createWriteStream(sizeFilePath);

  const fileDataFileLineCb: ReadFileByLineOpts['lineCb'] = (line: string, resumeCb: () => void) => {
    let sizePromise: Promise<void>;

    lineCount++;

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
      if(fileStats === undefined) {
        return;
      }
      fileSize = fileStats.size;
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
  // console.log('rfl done');
  // _print({ lineCount });
  console.log(`${c.italic('lineCount')}: ${c.yellow_light(lineCount)}`);
  // console.log({ lineCount });
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
