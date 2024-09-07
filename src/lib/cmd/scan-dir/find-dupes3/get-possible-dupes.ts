
import assert from 'assert';

import { LineReader2, getLineReader2 } from '../../../util/files';

export type GetPossibleDupesRes = {
  possibleDupeSizeMap: Map<number, number>;
};

type GetFileSizeRes = {
  sizeMap: Map<number, number>;
};

export async function getPossibleDupes(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetPossibleDupesRes> {
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

  return {
    possibleDupeSizeMap: possibleDupeMap,
  };
}

async function getFileSizes(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetFileSizeRes> {
  let sizeMap: Map<number, number>;
  let lineReader: LineReader2;
  let line: string | undefined;

  sizeMap = new Map();
  lineReader = await getLineReader2(filesDataFilePath);

  while((line = await lineReader.read()) !== undefined) {
    let sizeStr: string | undefined;
    let fileSize: number;
    let fileSizeCount: number | undefined;

    let lineRx: RegExp;
    let rxExecRes: RegExpExecArray | null;

    lineRx = /^(?<sizeStr>[0-9]+) .*\r?$/i;
    rxExecRes = lineRx.exec(line);

    sizeStr = rxExecRes?.groups?.sizeStr;
    assert(sizeStr !== undefined, line);
    fileSize = +sizeStr;
    assert(!isNaN(fileSize));

    if((fileSizeCount = sizeMap.get(fileSize)) === undefined) {
      fileSizeCount = 0;
    }
    sizeMap.set(fileSize, fileSizeCount + 1);
  }
  await lineReader.close();
  // process.stdout.write('\n');

  return {
    sizeMap,
  };
}
