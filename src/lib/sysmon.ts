
import { SYSMON_COMMAND_ENUM, parseSysmonArgs } from './cmd/sysmon-args';
import { isObject, isString } from './util/validate-primitives';
import { Timer } from './util/timer';
import { getIntuitiveTimeString } from './util/format-util';
import { Dirent, ReadStream, Stats, createReadStream, lstatSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { mkdirIfNotExist } from './util/files';
import { DATA_DIR_PATH } from '../constants';
import { Hasher, getHasher, hashSync } from './util/hasher';

export async function sysmonMain() {
  const cmd = parseSysmonArgs();
  console.log(cmd);
  switch(cmd.kind) {
    case SYSMON_COMMAND_ENUM.SCAN_DIR:
      if(!isString(cmd.arg)) {
        throw new Error(`Unexpected ${cmd.command} dir arg type: expected 'string', found ${typeof cmd.arg}`);
      }
      await scanDirMain(cmd.arg);
      break;
    default:
      throw new Error(`unhandled command kind: ${cmd.kind}`);
  }
}

async function scanDirMain(dirPath: string) {
  let scanDirResult: ScanDirResult;
  let timer: Timer;
  let scanMs: number;
  let findDuplicatesMs: number;
  console.log(`Scanning: ${dirPath}`);
  timer = Timer.start();
  scanDirResult = scanDir(dirPath);
  scanMs = timer.stop();
  console.log(`files: ${scanDirResult.files.length}`);
  console.log(`dirs: ${scanDirResult.dirs.length}`);
  console.log(`Scan took: ${getIntuitiveTimeString(scanMs)}`);

  timer = Timer.start();
  const duplicateFiles = await findDuplicateFiles(scanDirResult.files);
  findDuplicatesMs = timer.stop();
  console.log(`findDuplicates took: ${getIntuitiveTimeString(findDuplicatesMs)}`);

  mkdirIfNotExist(DATA_DIR_PATH);
  const dirsDataFilePath = [
    DATA_DIR_PATH,
    'dirs.txt',
  ].join(path.sep);
  const filesDataFilePath = [
    DATA_DIR_PATH,
    'files.txt',
  ].join(path.sep);
  writeFileSync(dirsDataFilePath, scanDirResult.dirs.join('\n'));
  writeFileSync(filesDataFilePath, scanDirResult.files.join('\n'));
}

async function findDuplicateFiles(filePaths: string[]) {
  let pathMap: Map<number, string[]>;
  let hashMap: Map<string, string[]>;
  /*
    First, find potential duplicates - a file can be a duplicate if it
      has the same size as another file.
  */
  pathMap = new Map;
  filePaths.forEach((filePath) => {
    let stat: Stats;
    let size: number;
    let sizePaths: string[];
    stat = lstatSync(filePath);
    size = stat.size;
    if(!pathMap.has(size)) {
      pathMap.set(size, []);
    }
    sizePaths = pathMap.get(size)!;
    sizePaths.push(filePath);
  });

  /*
    Next, pare the list of duplicates down to actual duplicates
      by calculating the file hashes of the potential duplicates
  */

  hashMap = new Map;

  let pathMapEntries: [ number, string[] ][] = [ ...pathMap.entries() ];
  let hashCount: number = 0;

  for(let i = 0; i < pathMapEntries.length; ++i) {
    const pathMapEntry = pathMapEntries[i];
    const [ , filePaths ] = pathMapEntry;
    if(filePaths.length < 2) {
      continue;
    }
    for(let k = 0; k < filePaths.length; ++k) {
      let rs: ReadStream;
      let readPromise: Promise<void>;
      let hasher: Hasher;
      let hashStr: string;
      let hashArr: string[];

      const filePath = filePaths[k];

      hasher = getHasher();

      const chunkCb = (chunk: string | Buffer) => {
        hasher.update(chunk);
      };

      readPromise = new Promise((resolve, reject) => {
        rs = createReadStream(filePath);
        rs.on('error', err => {
          if(isObject(err) && (
            (err.code === 'EISDIR')
            || (err.code === 'ENOENT')
          )) {
            console.error(`${err.code}: ${filePath}`);
          } else {
            reject(err);
          }
        });
        rs.on('close', () => {
          resolve();
        });
        rs.on('data', chunk => {
          chunkCb(chunk);
        });
      });
      await readPromise;
      hashStr = hasher.digest();
      if(!hashMap.has(hashStr)) {
        hashMap.set(hashStr, []);
      }
      hashArr = hashMap.get(hashStr)!;
      hashArr.push(filePath);
      hashCount++;
      if((hashCount % 1000) === 0) {
        process.stdout.write('.');
      }
    }
  }
  process.stdout.write('\n');

}

type ScanDirResult = {
  dirs: string[];
  files: string[];
};

function scanDir(dirPath: string): ScanDirResult {
  let allDirs: string[];
  let allFiles: string[];

  let currDirents: Dirent[];
  let dirQueue: string[];
  let currDirPath: string;

  let pathCount: number;

  dirQueue = [
    dirPath,
  ];

  allDirs = [];
  allFiles = [];

  pathCount = 0;

  while(dirQueue.length > 0) {
    let rootDirent: Stats;
    currDirPath = dirQueue.shift()!;
    rootDirent = lstatSync(currDirPath);
    if(rootDirent.isDirectory()) {
      currDirents = readdirSync(currDirPath, {
        withFileTypes: true,
      });
      allDirs.push(currDirPath);
      currDirents.forEach(currDirent => {
        // dirQueue.push([
        //   currDirent.path,
        //   currDirent.name,
        // ].join(path.sep));
        dirQueue.unshift([
          currDirent.path,
          currDirent.name,
        ].join(path.sep));
      });
      pathCount++;
    } else {
      allFiles.push(currDirPath);
      pathCount++;
    }
    if((pathCount % 1e4) === 0) {
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');

  return {
    dirs: allDirs,
    files: allFiles,
  };
}
