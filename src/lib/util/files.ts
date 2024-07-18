
import fs, { ReadStream, Stats } from 'fs';
import path from 'path';
import { isObject } from './validate-primitives';
import readline from 'readline';
import { Deferred } from '../../test/deferred';

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
