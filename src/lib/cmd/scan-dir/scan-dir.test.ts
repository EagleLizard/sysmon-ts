
// import fs from 'fs';
import { describe, it, expect, beforeAll, Mocked, vi, beforeEach } from 'vitest';
import { fs as mfs } from 'memfs';

import { ScanDirCbParams, ScanDirOpts, scanDir } from './scan-dir';
import { GenTestDirRes, genTestDirs } from '../../../test/gen-test-dirs';

const FLAT_TEST_DIR_PATH = '/flat';
const RECURSIVE_TEST_DIR_PATH = '/recursive';

vi.mock('fs', () => {
  return mfs;
});

describe('scanDir tests', () => {
  let flatTestGenRes: GenTestDirRes;
  let recursiveTestGenRes: GenTestDirRes;

  let scanDirOutStreamMock: Mocked<ScanDirOpts['outStream']>;

  beforeAll(() => {

    /* init test dirs */
    mfs.mkdirSync(FLAT_TEST_DIR_PATH);
    flatTestGenRes = genTestDirs(mfs, {
      basePath: FLAT_TEST_DIR_PATH,
      dirDepth: 0,
      dirsPerLevel: 4,
      filesPerDir: 4,
    });

    mfs.mkdirSync(RECURSIVE_TEST_DIR_PATH);
    recursiveTestGenRes = genTestDirs(mfs, {
      basePath: RECURSIVE_TEST_DIR_PATH,
      dirDepth: 4,
      dirsPerLevel: 2,
      filesPerDir: 2,
    });
    console.log({ recursiveTestGenRes });
  });

  beforeEach(() => {
    scanDirOutStreamMock = {
      write: vi.fn<any>(),
    };
  });

  it('scans the correct number of files and dirs [flat]', async () => {
    let fileCount = 0;
    let dirCount = 0;
    const scanDirCb = (params: ScanDirCbParams) => {
      if(!params.isDir) {
        fileCount++;
      } else {
        dirCount++;
      }
    };
    await scanDir({
      dirPath: FLAT_TEST_DIR_PATH,
      scanDirCb,
      outStream: scanDirOutStreamMock,
    });
    expect(fileCount).toBe(flatTestGenRes.numFiles);
    expect(dirCount).toBe(flatTestGenRes.numDirs + 1); // +1 because scanDir includes the root dir
  });

  it('scans the correct number of files and dirs [recursive]', async () => {
    let fileCount = 0;
    let dirCount = 0;
    const scanDirCb = (params: ScanDirCbParams) => {
      if(!params.isDir) {
        fileCount++;
      } else {
        dirCount++;
      }
    };
    await scanDir({
      dirPath: RECURSIVE_TEST_DIR_PATH,
      scanDirCb,
      outStream: scanDirOutStreamMock,
    });
    expect(fileCount).toBe(recursiveTestGenRes.numFiles);
    expect(dirCount).toBe(recursiveTestGenRes.numDirs + 1); // +1 because scanDir includes the root dir
    expect(scanDirOutStreamMock?.write).toHaveBeenCalled();
  });
});
