
import fs from 'fs';
import { describe, it, expect, beforeAll, Mocked, vi, beforeEach } from 'vitest';
import { joinPath, mkdirIfNotExist } from '../../util/files';
import { EZD_TEST_DIR_PATH, SCAN_DIR_TEST_DIR_PATH } from '../../../test/test-constants';
import { ScanDirCbParams, ScanDirOpts, scanDir } from './scan-dir';
import { GenTestDirRes, genTestDirs } from '../../../test/gen-test-dirs';
import { FindDuplicateFilesOpts, findDuplicateFiles } from './find-duplicate-files';

const FLAT_TEST_DIR_PATH = joinPath([
  SCAN_DIR_TEST_DIR_PATH,
  'flat',
]);
const RECURSIVE_TEST_DIR_PATH = joinPath([
  SCAN_DIR_TEST_DIR_PATH,
  'recursive',
]);

describe('scanDir tests', () => {
  let flatTestGenRes: GenTestDirRes;
  let recursiveTestGenRes: GenTestDirRes;
  
  let findDupesOutStreamMock: Mocked<FindDuplicateFilesOpts['outStream']>;
  let scanDirOutStreamMock: Mocked<ScanDirOpts['outStream']>;
  
  let possibleDupesWsMock: Mocked<FindDuplicateFilesOpts['possibleDupesWs']>;
  let dupesWsMock: Mocked<FindDuplicateFilesOpts['dupesWs']>;

  beforeAll(() => {
    /* delete test dirs if they exist */
    fs.rmSync(SCAN_DIR_TEST_DIR_PATH, {
      recursive: true,
    });

    /* init test dirs */
    mkdirIfNotExist(EZD_TEST_DIR_PATH);
    mkdirIfNotExist(SCAN_DIR_TEST_DIR_PATH);

    mkdirIfNotExist(FLAT_TEST_DIR_PATH);
    flatTestGenRes = genTestDirs({
      basePath: FLAT_TEST_DIR_PATH,
      dirDepth: 0,
      dirsPerLevel: 4,
      filesPerDir: 4,
    });

    mkdirIfNotExist(RECURSIVE_TEST_DIR_PATH);
    recursiveTestGenRes = genTestDirs({
      basePath: RECURSIVE_TEST_DIR_PATH,
      dirDepth: 3,
      dirsPerLevel: 4,
      filesPerDir: 4,
    });
    console.log({ recursiveTestGenRes });
  });

  beforeEach(() => {
    findDupesOutStreamMock = {
      write: vi.fn<any>(),
    };
    scanDirOutStreamMock = {
      write: vi.fn<any>(),
    };
    possibleDupesWsMock = {
      write: vi.fn<any>(),
      close: vi.fn(),
    };
    dupesWsMock = {
      write: vi.fn<any>(),
      close: vi.fn(),
    };
  });
  
  it('scans the correct number of files and dirs [flat]', () => {
    let fileCount = 0;
    let dirCount = 0;
    const scanDirCb = (params: ScanDirCbParams) => {
      if(!params.isDir) {
        fileCount++;
      } else {
        dirCount++;
      }
    };
    scanDir({
      dirPaths: [ FLAT_TEST_DIR_PATH ],
      scanDirCb,
      outStream: scanDirOutStreamMock,
    });
    expect(fileCount).toBe(flatTestGenRes.numFiles);
    expect(dirCount).toBe(flatTestGenRes.numDirs + 1); // +1 because scanDir includes the root dir
  });

  it('scans the correct number of files and dirs [recursive]', () => {
    let fileCount = 0;
    let dirCount = 0;
    const scanDirCb = (params: ScanDirCbParams) => {
      if(!params.isDir) {
        fileCount++;
      } else {
        dirCount++;
      }
    };
    scanDir({
      dirPaths: [ RECURSIVE_TEST_DIR_PATH ],
      scanDirCb,
      outStream: scanDirOutStreamMock,
    });
    expect(fileCount).toBe(recursiveTestGenRes.numFiles);
    expect(dirCount).toBe(recursiveTestGenRes.numDirs + 1); // +1 because scanDir includes the root dir
    expect(scanDirOutStreamMock?.write).toHaveBeenCalled();
  });

  it('Finds the correct number of duplicate files', async () => {
    let files: string[];
    let dupeMap: Map<string, string[]>;
    let nowDate: Date;
    let dupeMapKeys: string[];
    let dupeCount: number;
    files = [];
    const scanDirCb = (params: ScanDirCbParams) => {
      if(!params.isDir) {
        files.push(params.fullPath);
      }
    };
    scanDir({
      dirPaths: [ RECURSIVE_TEST_DIR_PATH ],
      scanDirCb,
      outStream: scanDirOutStreamMock,
    });
    nowDate = new Date;
    dupeMap = await findDuplicateFiles({
      filePaths: files,
      nowDate,
      outStream: findDupesOutStreamMock,
      possibleDupesWs: possibleDupesWsMock,
      dupesWs: dupesWsMock,
    });
    dupeCount = 0;
    dupeMapKeys = [ ...dupeMap.keys() ];
    for(let i = 0; i < dupeMapKeys.length; ++i) {
      let currDupes = dupeMap.get(dupeMapKeys[i]);
      if(Array.isArray(currDupes)) {
        dupeCount += currDupes.length;
      }
    }
    expect(dupeCount).toBe(recursiveTestGenRes.numFileDupes);
    expect(findDupesOutStreamMock?.write).toHaveBeenCalled();

    expect(possibleDupesWsMock?.write).toHaveBeenCalled()
    expect(possibleDupesWsMock?.close).toHaveBeenCalledOnce()
    expect(dupesWsMock?.write).toHaveBeenCalled()
    expect(dupesWsMock?.close).toHaveBeenCalledOnce()
  });
  
});
