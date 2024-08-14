
import assert from 'assert';
import path from 'path';
import { WriteStream, createWriteStream } from 'fs';

import { ScanDirOpts } from '../parse-sysmon-args';
import { LineReader2, getLineReader2 } from '../../util/files';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import { Deferred } from '../../../test/deferred';
import { Timer } from '../../util/timer';
import { scanDirColors as c } from './scan-dir-colors';
import { GetFileHashesRes, HASH_HWM, MAX_RUNNING_HASHES, getFileHashes } from './find-dupes3/get-file-hashes';
import { _closeWs, _timeStr } from './find-dupes3/find-dupes-utils';
import { GetPossibleDupesRes, getPossibleDupes } from './find-dupes3/get-possible-dupes';
import { _print } from './find-dupes3/find-dupes-utils';
import { SORT_CHUNK_FILE_LINE_COUNT, sortDuplicates } from './find-dupes3/sort-duplicates';

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
  let possibleDupeCount: number;

  let getFileHashesRes: GetFileHashesRes;
  let hashFilePath: string;
  let hashCountMap: Map<string, number>;

  let getPossibleDupesMs: number;
  let getFileHashesMs: number;
  let getFileHashesTimeStr: string;
  let getFileDupesMs: number;
  let getFileDupesTimeStr: string;
  let sortDupesMs: number;
  let sortDupesTimeStr: string;

  let getFileDupesRes: GetFileDupesRes;
  let dupeFilePath: string;
  let totalDupeCount: number;

  let timer: Timer;
  let totalTimer: Timer;
  let totalMs: number;
  let totalTimeStr: string;

  _print({
    SORT_CHUNK_FILE_LINE_COUNT,
    MAX_RUNNING_HASHES,
    HASH_HWM,
  });
  totalTimer = Timer.start();
  timer = Timer.start();
  getPossibleDupesRes = await getPossibleDupes(opts.filesDataFilePath, {
    nowDate: opts.nowDate,
  });
  getPossibleDupesMs = timer.currentMs();
  console.log(`getPossibleDupes() took: ${_timeStr(getPossibleDupesMs)}`);

  possibleDupeSizeMap = getPossibleDupesRes.possibleDupeSizeMap;
  possibleDupeCount = getPossibleDupeCount(possibleDupeSizeMap);
  _print({ possibleDupeCount });

  timer.reset();
  getFileHashesRes = await getFileHashes(opts.filesDataFilePath, possibleDupeSizeMap, possibleDupeCount, opts.nowDate);
  possibleDupeSizeMap.clear();
  getFileHashesMs = timer.currentMs();
  getFileHashesTimeStr = _timeStr(getFileHashesMs, {
    // fmtTimeFn: c.aqua,
    // fmtTimeFn: c.cyan,
    fmtTimeFn: c.chartreuse_light,
  });
  console.log(`getFileHashes() took: ${getFileHashesTimeStr}`);

  hashFilePath = getFileHashesRes.hashFilePath;
  hashCountMap = getFileHashesRes.hashCountMap;
  timer.reset();
  getFileDupesRes = await getFileDupes(hashFilePath, hashCountMap, opts.nowDate);
  /*
    Clearing the map is important, otherwise a a large amount
      of memory is retained during future, long-running
      functions.
   */
  hashCountMap.clear();
  getFileDupesMs = timer.currentMs();
  getFileDupesTimeStr = _timeStr(getFileDupesMs);
  console.log(`getFileDupes() took: ${c.purple_light(getFileDupesTimeStr)}`);

  dupeFilePath = getFileDupesRes.dupesFilePath;
  totalDupeCount = getFileDupesRes.totalDupeCount;

  _print({ totalDupeCount });

  timer.reset();
  await sortDuplicates(dupeFilePath, totalDupeCount, opts.nowDate);
  sortDupesMs = timer.currentMs();
  sortDupesTimeStr = _timeStr(sortDupesMs, {
    fmtTimeFn: c.pink,
  });
  console.log(`sortDuplicates() took: ${sortDupesTimeStr}`);
  totalMs = totalTimer.currentMs();
  totalTimeStr = _timeStr(totalMs, {
    fmtTimeFn: c.chartreuse_light,
  });
  console.log(`findDupes3() took: ${totalTimeStr}`);

  return new Map<string, string[]>();
}

type GetFileDupesRes = {
  dupesFilePath: string;
  totalDupeCount: number;
};

async function getFileDupes(hashFilePath: string, hashCountMap: Map<string, number>, nowDate: Date): Promise<GetFileDupesRes> {
  let getFileDupesRes: GetFileDupesRes;
  let dupesFileName: string;
  let dupesFilePath: string;
  let dupesWs: WriteStream;
  let drainDeferred: Deferred | undefined;
  let lineReader: LineReader2;
  let line: string | undefined;
  let totalDupeCount: number;

  dupesFileName = 'z1_dupes.txt';
  dupesFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    dupesFileName,
  ].join(path.sep);

  dupesWs = createWriteStream(dupesFilePath);
  lineReader = await getLineReader2(hashFilePath);

  totalDupeCount = 0;

  while((line = await lineReader.read()) !== undefined) {
    let fileHash: string | undefined;
    let lineRx: RegExp;
    let rxExecRes: RegExpExecArray | null;
    let hashCount: number | undefined;
    lineRx = /^(?<fileHash>[a-f0-9]+) [0-9]+ .*$/i;
    rxExecRes = lineRx.exec(line);
    fileHash = rxExecRes?.groups?.fileHash;
    assert(fileHash !== undefined);
    hashCount = hashCountMap.get(fileHash);
    if(
      (hashCount !== undefined)
      && (hashCount > 1)
    ) {
      totalDupeCount += hashCount;
      await _dupesWsWrite(`${line}\n`);
    }
  }
  await _closeWs(dupesWs);
  await lineReader.close();
  process.stdout.write('\n');

  getFileDupesRes = {
    dupesFilePath,
    totalDupeCount,
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
        assert(drainDeferred !== undefined);
        drainDeferred.resolve();
      });
      drainDeferred.promise.finally(() => {
        drainDeferred = undefined;
      });
    }
  }
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
