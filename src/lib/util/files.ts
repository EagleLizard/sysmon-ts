
import fs, { ReadStream, Stats } from 'fs';
import path from 'path';
import readline from 'readline';
import assert from 'assert';
import fsp, { FileHandle, FileReadResult } from 'fs/promises';

import { isObject } from './validate-primitives';

const DEFAULT_RFL_BUF_SIZE = 1 * 1024;
// const DEFAULT_RFL_BUF_SIZE = 4 * 1024;
// const DEFAULT_RFL_BUF_SIZE = 8 * 1024;
// const DEFAULT_RFL_BUF_SIZE = 16 * 1024;
// const DEFAULT_RFL_BUF_SIZE = 32 * 1024;

export function getPathRelativeToCwd(filePath: string) {
  let cwd: string;
  let absolutePath: string;
  cwd = process.cwd();
  absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(cwd, filePath)
  ;
  return absolutePath;
}

export function checkDir(dirPath: string): boolean {
  let stats: Stats;
  try {
    stats = fs.statSync(dirPath);
  } catch(e) {
    // if(e?.code === 'ENOENT') {
    if(isObject(e) && e.code === 'ENOENT') {
      return false;
    } else {
      throw e;
    }
  }
  return stats.isDirectory();
}

export function mkdirIfNotExist(dirPath: string) {
  let dirExists: boolean;
  dirExists = checkDir(dirPath);
  if(!dirExists) {
    fs.mkdirSync(dirPath);
  }
}

export function joinPath(pathParts: string[]): string {
  return pathParts.join(path.sep);
}

type ReadFileByLineSignal = void | 'finish' | 'pause';

export type ReadFileByLineOpts = {
  lineCb: (line: string, resumeCb: () => void) => ReadFileByLineSignal;
  highWaterMark?: number;
};

export function readFileByLine(filePath: string, opts: ReadFileByLineOpts): Promise<void> {
  let rs: ReadStream;
  let rl: readline.Interface;
  let readFilePromise: Promise<void>;
  let readFileSignal: ReadFileByLineSignal;
  let rsOpts: { highWaterMark?: number };
  rsOpts = {};
  if(opts.highWaterMark !== undefined) {
    rsOpts.highWaterMark = opts.highWaterMark;
  }
  rs = fs.createReadStream(filePath, rsOpts);
  rl = readline.createInterface({
    input: rs,
  });
  const resumeCb = () => {
    rl.resume();
  };
  readFilePromise = new Promise((resolve, reject) => {
    rs.on('error', reject);
    rs.on('close', resolve);
    rl.on('line', (line) => {
      readFileSignal = opts.lineCb(line, resumeCb);
      if(readFileSignal === 'finish') {
        /*
          see: https://stackoverflow.com/a/29806007/4677252
        */
        rs.destroy();
      }
      if(readFileSignal === 'pause') {
        rl.pause();
      }
    });
  });
  readFilePromise.finally(() => {
    rl.close();
    rs.destroy();
  });
  return readFilePromise;
}

type GetLineReaderOpts = {
  highWaterMark?: number;
};

export type LineReader = {
  read: () => Promise<string | undefined>;
}

export function getLineReader(filePath: string, opts: GetLineReaderOpts = {}): LineReader {
  let rflIter: AsyncGenerator<string>;
  let fileReader: LineReader;
  let rsOpts: { highWaterMark?: number };
  let rs: ReadStream;
  rsOpts = {};
  if(opts.highWaterMark !== undefined) {
    rsOpts.highWaterMark = opts.highWaterMark;
  }
  rs = fs.createReadStream(filePath, rsOpts);
  rflIter = getFileLineIter(rs);
  const _read = async () => {
    let rflIterRes: IteratorResult<string>;
    rflIterRes = await rflIter.next();
    if(rflIterRes.done) {
      return undefined;
    }
    return rflIterRes.value;
  };

  fileReader = {
    read: _read,
  };
  return fileReader;
}

async function *getFileLineIter(rs: ReadStream): AsyncGenerator<string, undefined, undefined> {
  let rl: readline.Interface;
  rl = readline.createInterface({
    input: rs,
  });
  for await (const line of rl) {
    yield line;
  }
}

export type LineReader2 = {
  read: () => Promise<string | undefined>
  close: () => Promise<void>;
}

export type GetLineReader2Opts = {
  bufSize?: number;
};

export async function getLineReader2(filePath: string, opts: GetLineReader2Opts = {}): Promise<LineReader2> {
  let fh: FileHandle;
  let fhPromise: Promise<FileHandle>;
  let bufSize: number;
  let lineReader: LineReader2;
  let buf: Buffer;
  let pos: number;
  let bufPos: number;
  let bytesRead: number;
  let lines: string[];
  let leftoverChars: string | undefined;
  fhPromise = fsp.open(filePath);
  fh = await fhPromise;

  bufSize = opts.bufSize ?? DEFAULT_RFL_BUF_SIZE;

  buf = Buffer.alloc(bufSize);
  pos = 0;
  bufPos = -1;
  bytesRead = -1;
  lines = [];

  /*
    read until newline or end of file
  */
  lineReader = {
    read: _read,
    close: _close,
  };

  return lineReader;

  async function _read(): Promise<string | undefined> {
    let readRes: FileReadResult<Buffer>;
    let currData: string | undefined;
    let currLines: string[];
    let retLine: string | undefined;
    /*
      Read from current buffer, or get data until next newline
     */
    
    /*
      how do we know we need to read more bytes?
      how do we know we have more room to seek in the buffer?
        bufPos < bytesRead
     */
    if(
      1
      // && (bufPos >= bytesRead)
      && (lines.length === 0)
    ) {
      /*
        read until newline or EOF
       */
      // console.log('read more from fh');
      currData = '';
      buf.fill(0);
      while((readRes = await fh.read(buf, 0, buf.length, pos)).bytesRead !== 0) {
        currData += buf.toString();
        bytesRead = readRes.bytesRead;
        pos += bytesRead;
        if(buf.indexOf(10) !== -1) {
          break;
        }
      }
      currLines = (currData.length > 0)
        ? currData.split('\n')
        : []
      ;
      // if(currData.length > 0) {
      //   currLines = currData.split('\n');
      // }

      /*
        If there are any leftover chars, prepend them to
          the beginning of the first entry
       */
      if(
        (leftoverChars !== undefined)
        && (currLines.length > 0)
      ) {
        // console.log({ leftoverChars });
        // console.log(`currLines[0]: ${JSON.stringify(currLines[0])}`);
        currLines[0] = `${leftoverChars}${currLines[0]}`;
        leftoverChars = undefined;
        // console.log(`currLines[0] after: ${JSON.stringify(currLines[0])}`);
      }
      /*
        last line could be incomplete
       */
      // console.log({ leftoverChars });
      // console.log(`trimmed: ${leftoverChars?.trim()}`);
      if(
        (currLines.length > 0)
        && (currLines[currLines.length - 1].length === 0)
      ) {
        /*
          last char was newline, remove it, and
            unset leftovers var
         */
        currLines.pop();
        leftoverChars = undefined;
      } else {
        leftoverChars = currLines.pop();
      }
      while(currLines.length > 0) {
        let currLine: string | undefined;
        currLine = currLines.pop();
        assert(currLine !== undefined);
        lines.push(currLine);
      }
      // readRes = await fh.read(buf, 0, buf.length, pos);
      // console.log(lines);
      // console.log({ leftoverChars });
      if(bytesRead === 0) {
        /*
          terminal.
            return leftover bytes,
            then undefined
         */
      }
    }
    /*
      see if there are more newlines in buf, starting from
        bufPos
      */
    // console.log('seek');
    // console.log({ lines });
    // console.log({ leftoverChars });
    retLine = lines.pop();
    return retLine;
  }
  async function _close() {
    fhPromise.finally(() => {
      fh?.close();
    });
    await fh.close();
  }
}
