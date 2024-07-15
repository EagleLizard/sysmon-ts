
import { Stats, WriteStream, createWriteStream, lstatSync } from 'fs';
import { ScanDirOpts } from '../parse-sysmon-args';
import { lstat, readFile, stat } from 'fs/promises';
import { sleep } from '../../util/sleep';
import { logger } from '../../logger';
import { isObject, isString } from '../../util/validate-primitives';
import assert from 'assert';
import { ReadFileByLineOpts, readFileByLine } from '../../util/files';
import { SCANDIR_OUT_DATA_DIR_PATH } from '../../../constants';
import path from 'path';

type FindDupesWs = {
  write: WriteStream['write'];
  close: WriteStream['close'];
  once: WriteStream['once'];
}

export async function findDupes(opts: {
  filesDataFilePath: string;
  nowDate: Date;
  debug?: {
    dirPaths: string[];
    opts: ScanDirOpts;
  }
}): Promise<Map<string, string[]>> {
  
  // await sleep(45 * 1e3);
  const maybeDupes = await getMaybeDupes(opts.filesDataFilePath, {
    nowDate: opts.nowDate,
  });

  return new Map<string, string[]>();
}

async function getMaybeDupes(filesDataFilePath: string, opts: {
  nowDate: Date,
}) {
  let countMap: Map<number, number>;
  let getFileSizeRes: GetFileSizeRes;
  let sizeMap: GetFileSizeRes['sizeMap'];
  getFileSizeRes = await getFileSizes(filesDataFilePath, {
    nowDate: opts.nowDate,
  });
  sizeMap = getFileSizeRes.sizeMap;
  console.log(sizeMap.size);
  // for(let i = 0; i < fileSizeEntries.length; ++i) {
  //   let currCount: number | undefined;
  //   currCount = countMap.get(fileSizeEntries[i][1]);
  //   assert(currCount !== undefined);
  //   if(currCount < 2) {
  //     fileSizeMap.delete(fileSizeEntries[i][0]);
  //   }
  // }

  return countMap;
}

type GetFileSizeRes = {
  sizeFilePath: string;
  sizeMap: Map<number, number>;
};

async function getFileSizes(filesDataFilePath: string, opts: {
  nowDate: Date,
}): Promise<GetFileSizeRes> {
  let sizeMap: Map<number, number>;
  let sizeCountMap: Map<number, number>;
  let sizeFileName: string;
  let sizeFilePath: string;

  let sizeWs: WriteStream;

  // sizeFileName = `${getDateFileStr(opts.nowDate)}_sizes.txt`;
  sizeFileName = '0_sizes.txt';
  sizeFilePath = [
    SCANDIR_OUT_DATA_DIR_PATH,
    sizeFileName,
  ].join(path.sep);

  sizeMap = new Map();
  sizeCountMap = new Map();

  sizeWs = createWriteStream(sizeFilePath);

  const rflCb: ReadFileByLineOpts['lineCb'] = (line) => {
    let fileStat: Stats | undefined;
    let fileSizeCount: number | undefined;
    let fileSize: number;
    try {
      fileStat = lstatSync(line);
    } catch(e) {
      if(
        isObject(e)
        && isString(e.code)
        && (
          (e.code === 'ENOENT')
          || (e.code === 'EACCES')
        )
      ) {
        console.log({ fileStat });
        logger.error(`findDuplicates lineCb: ${e.code} ${line}`);
        return;
      }
      console.error(e);
      throw e;
    }
    fileSize = fileStat.size;
    if((fileSizeCount = sizeMap.get(fileSize)) === undefined) {
      fileSizeCount = 0;
    }
    sizeMap.set(fileSize, fileSizeCount + 1);
    sizeWs.write(`${fileSize} ${line}`);
  };

  await readFileByLine(filesDataFilePath, {
    lineCb: rflCb,
  });

  return {
    sizeFilePath,
    sizeMap: sizeCountMap
  };
}
