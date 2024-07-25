import { WriteStream, createWriteStream } from 'fs';
import { ReadFileByLineOpts, readFileByLine } from '../../../util/files';
import path from 'path';
import assert from 'assert';

// export const SORT_CHUNK_FILE_LINE_COUNT = 250;
// export const SORT_CHUNK_FILE_LINE_COUNT = 500;
export const SORT_CHUNK_FILE_LINE_COUNT = 1e3;
// export const SORT_CHUNK_FILE_LINE_COUNT = 1e4;

export async function writeTmpDupeSortChunks2(dupeFilePath: string, tmpDir: string, totalDupeCount: number) {
  let tmpFileCounter: number;
  let lineCounter: number;
  let currLines: string[];

  tmpFileCounter = 0;
  currLines = [];

  const lineCb: ReadFileByLineOpts['lineCb'] = (line, resumeCb) => {
    if(lineCounter >= SORT_CHUNK_FILE_LINE_COUNT) {
      _writeTmpFile(currLines);
      currLines = [];
    }
    currLines.push(line);
  };

  await readFileByLine(dupeFilePath, {
    lineCb,
    highWaterMark: 1 * 1024,
  });

  async function _writeTmpFile(lines: string[]): Promise<void> {
    let tmpFileWs: WriteStream;
    let lineSizeTuples: [ number, string ][];

    lineSizeTuples = [];

    for(let i = 0; i < lines.length; ++i) {
      let currLine: string;
      let lineRx: RegExp;
      let rxExecRes: RegExpExecArray | null;
      let sizeStr: string | undefined;
      let size: number;
      currLine = lines[i];
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

    tmpFileWs = incTmpWs();
    for(let i = 0; i < lineSizeTuples.length; ++i) {
      let currLine: string;
      currLine = lineSizeTuples[i][1];
      tmpFileWs.write(`${currLine}\n`);
    }
    tmpFileWs.close();
  }

  function incTmpWs(): WriteStream {
    let tmpFileName: string;
    let tmpFilePath: string;
    let ws: WriteStream;

    tmpFileName = `${tmpFileCounter++}.txt`;
    tmpFilePath = [
      tmpDir,
      tmpFileName,
    ].join(path.sep);

    ws = createWriteStream(tmpFilePath, {
      highWaterMark: 1 * 1024,
    });
    return ws;
  }
}
