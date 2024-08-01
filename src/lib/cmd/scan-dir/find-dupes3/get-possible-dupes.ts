
import assert from 'assert';
import path from 'path';
import { Stats, WriteStream, createWriteStream } from 'fs';
import { lstat } from 'fs/promises';

import { LineReader2, getLineReader2 } from '../../../util/files';
import { Deferred } from '../../../../test/deferred';
import { Timer } from '../../../util/timer';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../../constants';
import { isObject, isString } from '../../../util/validate-primitives';
import { logger } from '../../../logger';
import { _closeWs } from './close-ws';

export type GetPossibleDupesRes = {
  possibleDupeSizeMap: Map<number, number>;
  sizeFilePath: string;
};

type GetFileSizeRes = {
  sizeFilePath: string;
  sizeMap: Map<number, number>;
};

const RFL_MOD = 500;

export async function getPossibleDupes(filesDataFilePath: string, opts: {
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

async function getFileSizes(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetFileSizeRes> {
  let sizeMap: Map<number, number>;
  let sizeFileName: string;
  let sizeFilePath: string;
  let sizeWs: WriteStream;
  let lineReader: LineReader2;
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
  lineReader = await getLineReader2(filesDataFilePath);

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
    if(
      !wsRes
      && (drainDeferred === undefined)
    ) {
      drainDeferred = Deferred.init();
      sizeWs.once('drain', () => {
        assert(drainDeferred !== undefined);
        drainDeferred.resolve();
      });
      drainDeferred.promise.finally(() => {
        drainDeferred = undefined;
      });
    }
    if(rflTimer.currentMs() > RFL_MOD) {
      process.stdout.write('.');
      rflTimer.reset();
    }
  }
  await _closeWs(sizeWs);
  await lineReader.close();
  process.stdout.write('\n');

  return {
    sizeFilePath,
    sizeMap,
  };
}
