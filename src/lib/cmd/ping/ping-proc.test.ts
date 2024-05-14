
import { describe, it, expect, vi, beforeEach} from 'vitest';
import { SpawnProcOpts } from '../proc';
import { PingProcOpts, PingResult, spawnPingProc } from './ping-proc';

const pingProcMocs = vi.hoisted(() => {
  return {
    spawnProcMock: vi.fn(),
    loggerInfo: vi.fn(),
  };
});

vi.mock('../proc', () => {
  return {
    spawnProc: pingProcMocs.spawnProcMock,
  };
});

vi.mock('../../logger', () => {
  return {
    logger: {
      info: pingProcMocs.loggerInfo,
    },
  };
});

describe('ping-proc tests', () => {
  let spawnProcCmd: string;
  let spawnProcArgs: string[] | undefined;
  let spawnProcOpts: SpawnProcOpts | undefined;

  let mockSpawnPromise: Promise<void>;

  let mockPingAddr: string;
  let mockPingBytes: number;
  let mockPingSeq: number;
  let mockPingTtl: number;
  let mockPingTime: number;
  let mockPingTimeUnit: string;
  let mockPingFirstLine: string;
  let mockPingLine: string;

  let pingCbMock: PingProcOpts['pingCb'];

  beforeEach(() => {
    mockSpawnPromise = new Promise((resolve, reject) => {

    });
    pingProcMocs.spawnProcMock.mockImplementation((
      cmd: string,
      args?: string[] | undefined,
      opts?: SpawnProcOpts
    ) => {
      spawnProcCmd = cmd;
      spawnProcArgs = args;
      spawnProcOpts = opts;
      return {
        proc: {},
        promise: mockSpawnPromise,
      };
    });
    mockPingSeq = 0;
    mockPingTtl = 117;
    mockPingTime = 29.418;
    mockPingTimeUnit = 'ms';
    mockPingAddr = '142.250.72.14';
    mockPingBytes = 64;
    mockPingFirstLine = `PING google.com (${mockPingAddr}): 56 data bytes`;
    mockPingLine = `${mockPingBytes} bytes from ${mockPingAddr}: icmp_seq=${mockPingSeq} ttl=${mockPingTtl} time=${mockPingTime} ${mockPingTimeUnit}`;

    pingCbMock = vi.fn();
  });

  it('tests spawnProc() called with \'ping\' command', () => {
    spawnPingProc({
      addr: mockPingAddr,
      pingCb: pingCbMock,
    });
    expect(spawnProcCmd).toBe('ping');
    expect(spawnProcArgs).toEqual([ mockPingAddr ]);
    expect(spawnProcOpts?.onData).toBeTypeOf('function');
    expect(pingProcMocs.loggerInfo).toHaveBeenCalledOnce();
  });

  it('tests opts.pingCb() called with correct values', () => {
    spawnPingProc({
      addr: mockPingAddr,
      pingCb: pingCbMock,
    });
    /*
    PING google.com (142.250.72.14): 56 data bytes
    64 bytes from 142.250.72.14: icmp_seq=0 ttl=117 time=29.418 ms
    */
    spawnProcOpts?.onData?.(Buffer.from(mockPingFirstLine));
    spawnProcOpts?.onData?.(Buffer.from(mockPingLine));
    expect(pingCbMock).toBeCalledWith({
      bytes: mockPingBytes,
      addr: mockPingAddr,
      seq: mockPingSeq,
      ttl: mockPingTtl,
      time: mockPingTime,
      timeUnit: mockPingTimeUnit,
    });
  });

  it('tests spawnPingProc() optional args are added to spawnProc() args correctly', () => {
    const mockCountOpt = 1;
    const mockWaitOpt = 200;
    const mockIfaceOpt = 'mock_wlan0';
    spawnPingProc({
      addr: mockPingAddr,
      count: mockCountOpt,
      wait: mockWaitOpt,
      I: mockIfaceOpt,
      pingCb: pingCbMock,
    });
    /*
    PING google.com (142.250.72.14): 56 data bytes
    64 bytes from 142.250.72.14: icmp_seq=0 ttl=117 time=29.418 ms
    */
    expect(spawnProcArgs).toEqual([
      mockPingAddr,
      '-c', `${mockCountOpt}`,
      '-i', `${mockWaitOpt}`,
      '-I', `${mockIfaceOpt}`,
    ]);
  });

  it('tests spawnPingProc() throws error when invalid bytes provided', () => {
    let invalidPingLine: string;
    let invalidBytes: string;
    invalidBytes = 'NaN';
    invalidPingLine = `${invalidBytes} bytes from ${mockPingAddr}`;
    spawnPingProc({
      addr: mockPingAddr,
      pingCb: pingCbMock,
    });
    spawnProcOpts?.onData?.(Buffer.from(invalidPingLine));
  });

});
