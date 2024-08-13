import { WriteStream, createWriteStream } from 'fs';
import path from 'path';

import { LineReader2, getLineReader2 } from '../../../util/files';
import { Deferred } from '../../../../test/deferred';
import { Timer } from '../../../util/timer';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../../constants';
import { HashFile2Opts, hashFile2 } from '../../../util/hasher';
import { isObject } from '../../../util/validate-primitives';
import { logger } from '../../../logger';
import { _closeWs, _print } from './find-dupes-utils';
import assert from 'assert';
import { sleep } from '../../../util/sleep';

const HASH_RFL_MOD = 250;
/*
  The coefficient is an approximation of the case where
    there are 700000 (7e5) possible duplicates, and we
    want to print an indicator every 250ms
  See: https://www.wolframalpha.com/input/?i=700000+*+x+%3D+250
 */
// const HASH_RFL_COEF = 3.5714e-4; // 0.00035714
const HASH_RFL_COEF = 1 / 700;
// const HASH_RFL_COEF = 1 / 1400;
// const HASH_RFL_COEF = 1 / 2800; // 0.00035714
// const HASH_RFL_COEF = 1 / (2800 * 2);
// const HASH_RFL_COEF = 1 / (2800 * 3);
// const HASH_RFL_COEF = 1 / (2800 * Math.E);
// const HASH_RFL_COEF = 1 / (Math.E * 1e3);

// export const HASH_HWM = 8 * 1024;
// export const HASH_HWM = 16 * 1024;
// export const HASH_HWM = 32 * 1024;
export const HASH_HWM = 64 * 1024;

// export const MAX_RUNNING_HASHES = 16;
// export const MAX_RUNNING_HASHES = 32;
export const MAX_RUNNING_HASHES = 64;
// export const MAX_RUNNING_HASHES = 128;
// export const MAX_RUNNING_HASHES = 256;
// export const MAX_RUNNING_HASHES = 512;
// export const MAX_RUNNING_HASHES = Infinity;

type FileSizeLineInfo = {
  size: number;
  filePath: string;
};

type FileHashLineInfo = {
  hash: string;
  size: number;
  filePath: string;
};

export type GetFileHashesRes = {
  hashCountMap: Map<string, number>;
  hashFilePath: string;
};

export async function getFileHashes(
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
  let lineReader: LineReader2;
  let line: string | undefined;
  let drainDeferred: Deferred | undefined;
  let runningHashes: number;

  let rflTimer: Timer;
  let percentTimer: Timer;
  let finishedHashCount: number;

  let gfhLrBufSize: number;
  let hashRflMod: number;

  gfhLrBufSize = 1 * 1024;
  hashRflMod = HASH_RFL_COEF * possibleDupeCount;

  // console.log({ gfhLrBufSize });
  _print({
    HASH_RFL_COEF,
    gfhLrBufSize,
    hashRflMod,
  });

  // hashFileName = `${getDateFileStr(opts.nowDate)}_hashes.txt`;
  hashFileName = '0_hashes.txt';
  hashFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    hashFileName,
  ].join(path.sep);
  hashCountMap = new Map();

  hashWs = createWriteStream(hashFilePath);
  lineReader = await getLineReader2(sizeFilePath, {
    bufSize: gfhLrBufSize,
  });

  runningHashes = 0;
  finishedHashCount = 0;
  rflTimer = Timer.start();
  percentTimer = Timer.start();

  while((line = await lineReader.read()) !== undefined) {
    let hashPromise: Promise<void>;
    let fileSizeLineInfo: FileSizeLineInfo;

    if(runningHashes >= MAX_RUNNING_HASHES) {
      await sleep(0);
    }

    fileSizeLineInfo = parseFileSizeLine(line);
    if(possibleDupeSizeMap.has(fileSizeLineInfo.size)) {
      runningHashes++;
      hashPromise = _getFileHash(
        fileSizeLineInfo.filePath,
        fileSizeLineInfo.size,
      ).then(hashRes => {
        let fileHash: string;
        let fileSize: number;
        let filePath: string;
        let hashCount: number | undefined;
        if(hashRes === undefined) {
          return;
        }
        fileHash = hashRes.hash;
        fileSize = hashRes.size;
        filePath = hashRes.filePath;
        if((hashCount = hashCountMap.get(fileHash)) === undefined) {
          hashCount = 0;
        }
        hashCountMap.set(fileHash, hashCount + 1);
        return _hashWsWrite(`${fileHash} ${fileSize} ${filePath}\n`);
      });
      hashPromise.finally(() => {
        runningHashes--;
        finishedHashCount++;

        // if(rflTimer.currentMs() > HASH_RFL_MOD) {
        if(rflTimer.currentMs() > hashRflMod) {
          process.stdout.write('⸱');
          rflTimer.reset();
        }
        // if(percentTimer.currentMs() > ((HASH_RFL_MOD) * 8)) {
        if(percentTimer.currentMs() > ((hashRflMod) * 8)) {
        // if(percentTimer.currentMs() > ((hashRflMod) * 12)) {
          process.stdout.write(`${Math.round((finishedHashCount / possibleDupeCount) * 100)}`);
          // process.stdout.write(((finishedHashCount / possibleDupeCount) * 100).toFixed(2));
          percentTimer.reset();
        }
      });
    }
  }

  while(runningHashes > 0) {
    await sleep(0);
  }

  await _closeWs(hashWs);
  await lineReader.close();
  process.stdout.write('\n');

  getFileHashRes = {
    hashCountMap,
    hashFilePath,
  };

  return getFileHashRes;

  async function _hashWsWrite(str: string) {
    let wsRes: boolean;
    if(drainDeferred !== undefined) {
      await drainDeferred.promise;
    }
    wsRes = hashWs.write(str);
    if(
      !wsRes
      && (drainDeferred === undefined)
    ) {
      drainDeferred = Deferred.init();
      hashWs.once('drain', () => {
        assert(drainDeferred !== undefined);
        drainDeferred.resolve();
      });
      drainDeferred.promise.finally(() => {
        drainDeferred = undefined;
      });
    }
  }
}

function parseFileSizeLine(line: string): FileSizeLineInfo {
  let filePath: string | undefined;
  let fileSizeStr: string | undefined;
  let fileSize: number;
  let lineRx: RegExp;
  let rxExecRes: RegExpExecArray | null;

  /*
    Some files (e.g. `Dropbox/Icon`) have a carriage return `\r` at the end
      of their filename. On mac, it lists with `ls` as `Icon?` or similar.
    Difficult to catch, because the terminal will either omit \r or combine
      with the following newline.
   */
  lineRx = /^(?<sizeStr>[0-9]+) (?<filePath>.*)\r?$/i;
  rxExecRes = lineRx.exec(line);

  filePath =  rxExecRes?.groups?.filePath;
  fileSizeStr = rxExecRes?.groups?.sizeStr;

  assert((
    (filePath !== undefined)
    && (fileSizeStr !== undefined)
  ), `${JSON.stringify(line)}`);
  fileSize = +fileSizeStr;
  assert(!isNaN(fileSize));
  return {
    size: fileSize,
    filePath,
  };
}

async function _getFileHash(filePath: string, size: number): Promise<FileHashLineInfo | undefined> {
  let fileHash: string | undefined;
  let truncHash: string;
  fileHash = await getFileHash(filePath, {
    highWaterMark: HASH_HWM,
  });
  if(fileHash === undefined) {
    return;
  }
  /*
    approx. 1 collision every 1 trillion (1e12) documents
      see: https://stackoverflow.com/a/22156338/4677252
   */
  truncHash = fileHash.substring(0, 10);
  return {
    // hash: fileHash,
    hash: truncHash,
    size,
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
