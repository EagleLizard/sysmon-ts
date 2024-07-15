
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

const RFL_MOD = 500;

export async function findDupes(opts: {
  filesDataFilePath: string;
  nowDate: Date;
  debug?: {
    dirPaths: string[];
    opts: ScanDirOpts;
  }
}): Promise<Map<string, string[]>> {
  
  // await sleep(45 * 1e3);
  const possibleDupes = await getPossibleDupes(opts.filesDataFilePath, {
    nowDate: opts.nowDate,
  });

  return new Map<string, string[]>();
}

async function getPossibleDupes(filesDataFilePath: string, opts: {
  nowDate: Date,
}) {
  let possibleDupeMap: Map<number, number>;
  let getFileSizeRes: GetFileSizeRes;
  let sizeMap: GetFileSizeRes['sizeMap'];
  let sizeMapIter: IterableIterator<number>;
  let sizeMapIterRes: IteratorResult<number>;

  getFileSizeRes = await getFileSizes(filesDataFilePath, {
    nowDate: opts.nowDate,
  });
  sizeMap = getFileSizeRes.sizeMap;

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
  _print({ possibleDupeCount });

  return possibleDupeMap;
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
    wsRes = sizeWs.write(`${line}\n`);
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
