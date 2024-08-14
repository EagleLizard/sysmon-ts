
import assert from 'assert';

export type FileHashInfo = {
  hash: string;
  size: number;
  filePath: string;
};

export type FileSizeInfo = {
  size: number;
  filePath: string;
};

export function parseHashInfo(line: string): FileHashInfo {
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

export function parseSizeInfo(line: string): FileSizeInfo {
  let lineRx: RegExp;
  let rxExecRes: RegExpExecArray | null;
  let sizeStr: string | undefined;
  let filePath: string | undefined;
  let size: number;
  lineRx = /^(?<size>[0-9]+) (?<filePath>.*)\r?$/i;
  rxExecRes = lineRx.exec(line);
  sizeStr = rxExecRes?.groups?.size;
  filePath = rxExecRes?.groups?.filePath;
  assert((
    1
    && (sizeStr !== undefined)
    && (filePath !== undefined)
  ), `line: ${JSON.stringify(line)}`);
  size = +sizeStr;
  assert(!isNaN(size));
  return {
    size,
    filePath,
  };
}
