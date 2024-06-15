
import path from 'path';
import { describe, it, expect, beforeEach, vi, beforeAll   } from 'vitest';
import { fs as mfs } from 'memfs';
import { ParsedArgv2, parseArgv2 } from '../parse-argv';
import { scanDirCmdMain } from './scan-dir-cmd';
import { ScanDirCbParams, ScanDirOpts } from './scan-dir';
import { Deferred } from '../../../test/deferred';
import { isString } from '../../util/validate-primitives';
// import { mkdirIfNotExist } from '../../util/files';

const filesMocks = vi.hoisted(() => {
  return {
    joinPath: vi.fn(),
    mkdirIfNotExist: vi.fn(),
  };
});

const scanDirMocks = vi.hoisted(() => {
  return {
    scanDir: vi.fn(),
  };
});

const configMocksPromise = vi.hoisted(async () => {
  const _path = (await import('path')).default;
  return {
    OUT_DATA_DIR_PATH: `${_path.sep}out_data`,
    SCANDIR_OUT_DATA_DIR_PATH: `${_path.sep}mock_out_dir`,
  };
});

vi.mock('fs', async () => {
  /*
    had to do this or the memfs mock doesn't reset
  */
  return await vi.importActual('memfs');
});

vi.mock('../../util/files.ts', () => {
  return {
    joinPath: filesMocks.joinPath,
    mkdirIfNotExist: filesMocks.mkdirIfNotExist,
  };
});

vi.mock('./scan-dir.ts', () => {
  return {
    scanDir: scanDirMocks.scanDir,
  };
});

vi.mock('../../../constants.ts', async () => {
  const configMocks = await configMocksPromise;
  return {
    OUT_DATA_DIR_PATH: configMocks.OUT_DATA_DIR_PATH,
    SCANDIR_OUT_DATA_DIR_PATH: configMocks.SCANDIR_OUT_DATA_DIR_PATH,
  };
});

describe('scan-dir-cmd tests', () => {
  let configMocks: Awaited<typeof configMocksPromise>;

  let argvMock: string[];
  let dirMock: string;
  let subDirMock: string;
  let subDirPathMock: string;

  let dupeFileAName: string;
  let dupeFileBName: string;
  let uniqueFileName: string;
  let testFiles: [fileName: string, fileData: string][];
  let dupeFileDataMock: string;
  let fileDataMock: string;

  beforeAll(async () => {
    configMocks = await configMocksPromise;
  });

  beforeEach(() => {
    filesMocks.joinPath.mockReset();
    filesMocks.mkdirIfNotExist.mockReset();
    scanDirMocks.scanDir.mockReset();
    /*
      ¯\_(ツ)_/¯
      hate to do it, but mfs.reset() doesn't work as documented.
        So this works. For now.
    */
    (mfs as any).__vol.reset();

    dirMock = `${path.sep}mock_scanned_dir`;
    subDirMock = 'subdir_mock';
    dupeFileDataMock = 'duplicate_data\n'.repeat(256);
    fileDataMock = 'unique_file_data\n'.repeat(256);
    dupeFileAName = 'fileDupeA.txt';
    dupeFileBName = 'fileDupeB.txt';
    uniqueFileName = 'fileA.txt';
    testFiles = [
      [ dupeFileAName, dupeFileDataMock ],
      [ dupeFileBName, dupeFileDataMock ],
      [ uniqueFileName, fileDataMock ],
    ];
    subDirPathMock = `${dirMock}${path.sep}${subDirMock}`;
    mfs.mkdirSync(subDirPathMock, {
      recursive: true,
    });
    for(let i = 0; i < testFiles.length; ++i) {
      mfs.writeFileSync(`${subDirPathMock}${path.sep}${testFiles[i][0]}`, testFiles[i][1]);
    }
    argvMock = [
      'node', 'dist/main.js', 'scan-dir', dirMock,
    ];
    filesMocks.mkdirIfNotExist.mockImplementation((dirPath: string) => {
      return mfs.mkdirSync(dirPath);
    });
    filesMocks.joinPath.mockImplementation((paths: string[]) => {
      return paths.join(path.sep);
    });
  });

  it('tests scanDirCmdMain()', async () => {
    let parsedArgv: ParsedArgv2;
    let scanDirDirPaths: string[];
    let scanDirCb: ((params: ScanDirCbParams) => void) | undefined;
    let scanDirPromise: Promise<void>;
    let deferred: Deferred<void>;
    let outFiles: ReturnType<typeof mfs.readdirSync>;
    let outFileData: string;
    parsedArgv = parseArgv2(argvMock);
    deferred = Deferred.init();
    scanDirMocks.scanDir.mockImplementationOnce((opts: ScanDirOpts) => {
      scanDirDirPaths = opts.dirPaths;
      scanDirCb = opts.scanDirCb;
      return deferred.promise;
    });
    scanDirPromise = scanDirCmdMain(parsedArgv);
    if(scanDirCb === undefined) {
      throw new Error('scanDirCb is undefined');
    }
    scanDirCb({
      isDir: true,
      fullPath: dirMock,
    });
    deferred.resolve();
    await scanDirPromise;
    outFiles = mfs.readdirSync(configMocks.SCANDIR_OUT_DATA_DIR_PATH);
    if(!isString(outFiles[0])) {
      throw new Error(`unexpected outfile from mfs: ${JSON.stringify(outFiles[0])}`);
    }
    outFileData = mfs.readFileSync(`${configMocks.SCANDIR_OUT_DATA_DIR_PATH}${path.sep}${outFiles[0]}`).toString();
    expect(outFileData).toContain(dirMock);
  });

  it('tests scanDirCmdMain() with the -d flag', async () => {
    let parsedArgv: ParsedArgv2;
    let scanDirDirPaths: string[];
    let scanDirCb: ((params: ScanDirCbParams) => void) | undefined;
    let scanDirPromise: Promise<void>;
    let deferred: Deferred<void>;
    let outFiles: ReturnType<typeof mfs.readdirSync>;
    let outFileData: string;
    argvMock.push('-d');
    parsedArgv = parseArgv2(argvMock);
    deferred = Deferred.init();
    scanDirMocks.scanDir.mockImplementationOnce((opts: ScanDirOpts) => {
      scanDirDirPaths = opts.dirPaths;
      scanDirCb = opts.scanDirCb;
      return deferred.promise;
    });
    scanDirPromise = scanDirCmdMain(parsedArgv);
    if(scanDirCb === undefined) {
      throw new Error('scanDirCb is undefined');
    }
    scanDirCb({
      isDir: true,
      fullPath: dirMock,
    });
    let testFileFullPaths: string[];
    testFileFullPaths = [];
    for(let i = 0; i < testFiles.length; ++i) {
      let testFileFullPath = `${subDirPathMock}${path.sep}${testFiles[i][0]}`;
      scanDirCb({
        isDir: false,
        fullPath: testFileFullPath,
      });
      testFileFullPaths.push(testFileFullPath);
    }
    deferred.resolve();
    await scanDirPromise;
    outFiles = mfs.readdirSync(configMocks.SCANDIR_OUT_DATA_DIR_PATH);
    let foundDupeOutFile = outFiles.find(outFile => {
      if(!isString(outFile)) {
        throw new Error(`unexpected outfile: ${JSON.stringify(outFile)}`);
      }
      return outFile.includes('dupes');
    });
    if(!isString(foundDupeOutFile)) {
      throw new Error(`unexpected dupes out file: ${JSON.stringify(foundDupeOutFile)}`);
    }
    outFileData = mfs.readFileSync(`${configMocks.SCANDIR_OUT_DATA_DIR_PATH}${path.sep}${foundDupeOutFile}`).toString();
    expect(outFileData).toContain(dupeFileAName);
    expect(outFileData).toContain(dupeFileBName);
    expect(outFileData).not.toContain(uniqueFileName);
  });
});
