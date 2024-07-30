import { WriteStream, createWriteStream } from 'fs';
import path from 'path';

import { LineReader2, getLineReader2 } from '../../../util/files';
import { Deferred } from '../../../../test/deferred';
import { Timer } from '../../../util/timer';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../../constants';
import { HashFile2Opts, hashFile2 } from '../../../util/hasher';
import { isObject } from '../../../util/validate-primitives';
import { logger } from '../../../logger';
import { _closeWs } from './close-ws';
import assert from 'assert';

const HASH_RFL_MOD = 250;

// export const HASH_HWM = 16 * 1024;
// export const HASH_HWM = 32 * 1024;
export const HASH_HWM = 64 * 1024;

// export const HASH_PROMISE_CHUNK_SIZE = 1;
// export const HASH_PROMISE_CHUNK_SIZE = 2;
// export const HASH_PROMISE_CHUNK_SIZE = 8;
export const HASH_PROMISE_CHUNK_SIZE = 12;
// export const HASH_PROMISE_CHUNK_SIZE = 16;
// export const HASH_PROMISE_CHUNK_SIZE = 32;
// export const HASH_PROMISE_CHUNK_SIZE = 64;
// export const HASH_PROMISE_CHUNK_SIZE = 128;
// export const HASH_PROMISE_CHUNK_SIZE = 256;

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
  lineReader = await getLineReader2(sizeFilePath, {
    // bufSize: 32 * 1024,
    // bufSize: 16 * 1024,
    bufSize: 2 * 1024,
    // bufSize: 256,
  });

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
          process.stdout.write(((finishedHashCount / possibleDupeCount) * 100).toFixed(2));
          // process.stdout.write(((finishedHashCount / possibleDupeCount) * 100).toFixed(3));
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
  await lineReader.close();
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

  type FileHashLineInfo = {
    hash: string;
    size: number;
    filePath: string;
  };

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
