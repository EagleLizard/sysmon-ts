import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fs as mfs } from 'memfs';
import { GenTestDirRes, genTestDirs } from '../../../test/gen-test-dirs';
import path from 'path';
import { findDuplicateFiles } from './find-duplicate-files';

const TEST_DIR_PATH = `${path.sep}test`;
const TEST_FILES_DATA_FILE_PATH = `${path.sep}files.txt`;

const constantsMocks = vi.hoisted(() => {
  return {
    SCANDIR_OUT_DATA_DIR_PATH: '/out_data',
  };
});

vi.mock('fs', () => {
  return {
    ...mfs,
    default: mfs,
  };
});

vi.mock('../../../constants.ts', () => {
  return {
    SCANDIR_OUT_DATA_DIR_PATH: constantsMocks.SCANDIR_OUT_DATA_DIR_PATH,
  };
});

describe('find-duplicate-files tests', () => {
  let testDirGenRes: GenTestDirRes;
  let nowDate: Date;
  let wsMock: { write: (str: string) => boolean };
  beforeEach(() => {
    mfs.mkdirSync(constantsMocks.SCANDIR_OUT_DATA_DIR_PATH);
    mfs.mkdirSync(TEST_DIR_PATH);
    testDirGenRes = genTestDirs(mfs, {
      basePath: TEST_DIR_PATH,
      dirDepth: 1,
      dirsPerLevel: 2,
      filesPerDir: 2,
    });
    mfs.writeFileSync(TEST_FILES_DATA_FILE_PATH, testDirGenRes.files.join('\n'));
    nowDate = new Date;

    wsMock = {
      write: vi.fn(),
    };
  });

  it('tests findDuplicateFiles() finds correct number of dupes', async () => {
    let dupes: Map<string, string[]>;
    let dupeKeys: string[];
    let dupeCount: number;
    dupeCount = 0;
    dupes = await findDuplicateFiles({
      filesDataFilePath: TEST_FILES_DATA_FILE_PATH,
      nowDate,
      outStream: wsMock,
    });
    dupeKeys = [ ...dupes.keys() ];
    for(let i = 0; i < dupeKeys.length; ++i) {
      dupeCount += dupes.get(dupeKeys[i])?.length ?? 0;
    }
    expect(dupeCount).toEqual(testDirGenRes.numFileDupes);
  });
});
