
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SpawnProcResult, spawnProc } from './proc';

const procMocks = vi.hoisted(() => {
  return {
    spawn: vi.fn(),
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

describe('proc tests', () => {
  let spawnOnMock: Mock;
  let stderrOnMock: Mock;
  let stdoutOnMock: Mock;

  let closeFn: () => void;
  let stdoutOnDataFn: (data?: any) => void;

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
      if(evt === 'close') {
        closeFn = cb;
      }
    });
    stdoutOnMock.mockImplementation((evt: string, cb: (data?: any) => void) => {
      if (evt === 'data') {
        stdoutOnDataFn = cb;
      }
    });
    procMocks.spawn.mockReturnValue(spawnReturnValueMock);
  });

  it('tests a spawned proc resolves on close', () => {
    let spawnProcRes: SpawnProcResult;
    spawnProcRes = spawnProc('testcmd', ['--test-arg']);
    closeFn();
    expect(spawnProcRes.promise).resolves;
  });

  it('tests a spawned proc resolves with correct data', async () => {
    let spawnProcRes: SpawnProcResult;
    let procResult: string;

    const mockStdoutData = 'mock_stdout_data';

    spawnProcRes = spawnProc('testcmd', ['--test-arg']);
    stdoutOnDataFn(mockStdoutData);
    closeFn();
    procResult = await spawnProcRes.promise;
    expect(procResult).toBe(mockStdoutData);
  });

});
