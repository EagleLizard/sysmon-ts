
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SpawnProcResult, spawnProc } from './proc';

const procMocks = vi.hoisted(() => {
  return {
    spawn: vi.fn(),
    loggerError: vi.fn(),
  };
});

vi.mock('child_process', (importOriginal) => {
  return {
    default: {
      ...importOriginal<typeof import('child_process')>,
      spawn: procMocks.spawn,
    },
  };
});

vi.mock('../logger', () => {
  return {
    logger: {
      error: procMocks.loggerError,
    },
  };
});

describe('proc tests', () => {
  let spawnOnMock: Mock;
  let stderrOnMock: Mock;
  let stdoutOnMock: Mock;

  let closeFn: () => void;
  let errorFn: (err: Error) => void;
  let stdoutOnDataFn: (data?: any) => void;
  let stderrOnDataFn: (data?: any) => void;

  let spawnReturnValueMock: {
    on: Mock;
    stderr: {
      on: Mock;
    },
    stdout: {
      on: Mock;
    }
  };

  beforeEach(() => {
    spawnOnMock = vi.fn();
    stderrOnMock = vi.fn();
    stdoutOnMock = vi.fn();
    spawnReturnValueMock = {
      on: spawnOnMock,
      stderr: {
        on: stderrOnMock,
      },
      stdout: {
        on: stdoutOnMock,
      },
    };
    spawnOnMock.mockImplementation((evt: string, cb: (data?: any) => void) => {
      switch(evt) {
        case 'close':
          closeFn = cb;
          break;
        case 'error':
          errorFn = cb;
          break;
      }
    });
    stdoutOnMock.mockImplementation((evt: string, cb: (data?: any) => void) => {
      if(evt === 'data') {
        stdoutOnDataFn = cb;
      }
    });
    stderrOnMock.mockImplementation((evt: string, cb: (data?: any) => void) => {
      if(evt === 'data') {
        stderrOnDataFn = cb;
      }
    });
    procMocks.spawn.mockReturnValue(spawnReturnValueMock);
  });

  it('tests a spawned proc resolves on close', () => {
    let spawnProcRes: SpawnProcResult;
    spawnProcRes = spawnProc('testcmd');
    closeFn();
    expect(spawnProcRes.promise).resolves;
  });

  it('tests a spawned proc resolves with correct data', async () => {
    let spawnProcRes: SpawnProcResult;
    let procResult: string;

    const mockStdoutData = 'mock_stdout_data';

    spawnProcRes = spawnProc('testcmd');
    stdoutOnDataFn(mockStdoutData);
    closeFn();
    procResult = await spawnProcRes.promise;
    expect(procResult).toBe(mockStdoutData);
  });

  it('tests that an error from the spawned process is rejected correctly', () => {
    let spawnProcRes: SpawnProcResult;
    let testErr: Error;
    let testErrMsg: string;
    testErrMsg = 'Test error.';
    testErr = new Error(testErrMsg);
    spawnProcRes = spawnProc('testcmd');
    /*
      Have to catch with a noop for vitest
    */
    spawnProcRes.promise.catch((e) => e);
    errorFn(testErr);
    expect(() => spawnProcRes.promise).rejects.toThrowError(testErrMsg);
  });

  it('tests that the opts.onData() function is called with data', () => {
    let onDataMock: Mock;

    const mockData = 'mock_data';
    onDataMock = vi.fn();

    spawnProc('testcmd', undefined, {
      onData: onDataMock,
    });
    stdoutOnDataFn(mockData);
    closeFn();
    expect(onDataMock).toBeCalledWith(mockData);
  });

  it('tests that the opts.onErrorData() function is called with data', () => {
    let onErrMock: Mock;

    const mockData = 'mock_error_data';
    onErrMock = vi.fn();

    spawnProc('testcmd', undefined, {
      onErrorData: onErrMock,
    });
    stderrOnDataFn(mockData);
    closeFn();
    expect(onErrMock).toBeCalledWith(mockData);
  });

  it('tests that logger.error() function is called with error data when opts.onErrorData() is not defined', () => {
    const mockData = 'mock_error_data';

    spawnProc('testcmd', undefined);
    stderrOnDataFn(mockData);
    closeFn();
    expect(procMocks.loggerError).toBeCalledWith(mockData);
  });

});
