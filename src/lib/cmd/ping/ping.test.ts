
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Deferred } from '../../../test/deferred';
import { killActivePingProc, pingMain } from './ping';
import { SysmonCommand, parseSysmonArgs } from '../sysmon-args';
import { PingProcOpts, PingResult } from './ping-proc';

const pingMocks = vi.hoisted(() => {
  return {
    ipProc: vi.fn(),
    spawnPingProc: vi.fn(),
    activePingProcKill: vi.fn(),
    netServiceDnsLookup: vi.fn(),
    pingServicePostPing: vi.fn(),
  };
});

vi.mock('../net/ip-proc', () => {
  return {
    ipProc: pingMocks.ipProc,
  };
});

vi.mock('./ping-proc', () => {
  return {
    spawnPingProc: pingMocks.spawnPingProc,
  };
});

vi.mock('../../service/net-service', () => {
  return {
    NetService: {
      dnsLookup: pingMocks.netServiceDnsLookup,
    },
  };
});

vi.mock('../../service/ping-service', () => {
  return {
    PingService: {
      postPing: pingMocks.pingServicePostPing,
    },
  };
});

describe('ping command tests', () => {
  let spawnPingProcOpts: PingProcOpts | undefined;

  let addrMock: string;
  let resolvedAddrMock: string;
  let srcAddrMock: string;
  let argvMock: string[];
  let cmdMock: SysmonCommand;
  let pingResMock: PingResult;

  let deferredSpawnPing: Deferred<string | void>;

  beforeEach(() => {
    pingMocks.ipProc.mockReset();
    pingMocks.spawnPingProc.mockReset();
    pingMocks.activePingProcKill.mockReset();
    pingMocks.netServiceDnsLookup.mockReset();
    pingMocks.pingServicePostPing.mockReset();

    addrMock = '12.345.67.89';
    srcAddrMock = 'mock.addr';
    resolvedAddrMock = '123.45.6.78';
    argvMock = [ 'node', 'main.js', 'ping', addrMock ];
    pingResMock = {
      seq: 0,
      ttl: 116,
      time: 12.345,
      timeUnit: 'ms',
      addr: resolvedAddrMock,
      bytes: 64,
    };

    deferredSpawnPing = Deferred.init();

    pingMocks.ipProc.mockResolvedValueOnce(srcAddrMock);
    pingMocks.spawnPingProc.mockImplementation((opts: PingProcOpts) => {
      spawnPingProcOpts = opts;
      return [
        {
          kill: pingMocks.activePingProcKill,
        },
        deferredSpawnPing.promise,
      ];
    });
    pingMocks.netServiceDnsLookup.mockResolvedValue(resolvedAddrMock);
    pingMocks.pingServicePostPing.mockResolvedValue(undefined);
  });

  it('tests ping with no args', async () => {
    let pingPromise: Promise<void>;
    cmdMock = parseSysmonArgs(argvMock);
    pingPromise = pingMain(cmdMock);
    deferredSpawnPing.resolve();
    await vi.waitFor(() => {
      if(spawnPingProcOpts?.pingCb === undefined) {
        throw new Error('pingCb not regisered');
      }
    });
    spawnPingProcOpts?.pingCb(pingResMock);
    expect(pingPromise).resolves;
  });

  it('tests ping with args', async () => {
    let pingPromise: Promise<void>;
    let waitMock: number;
    let countMock: number;
    let ifaceMock: string;
    waitMock = 0.5;
    countMock = 20;
    ifaceMock = 'mocken0';
    argvMock = [
      ...argvMock,
      '-i', `${waitMock}`,
      '-c', `${countMock}`,
      '-I', ifaceMock,
    ];
    cmdMock = parseSysmonArgs(argvMock);
    pingPromise = pingMain(cmdMock);
    deferredSpawnPing.resolve();
    await vi.waitFor(() => {
      if(spawnPingProcOpts?.pingCb === undefined) {
        throw new Error('pingCb not regisered');
      }
    });
    spawnPingProcOpts?.pingCb(pingResMock);
    await pingPromise;
    expect(pingMocks.spawnPingProc).toBeCalledWith({
      wait: waitMock,
      count: countMock,
      I: ifaceMock,
      addr: resolvedAddrMock,
      pingCb: spawnPingProcOpts?.pingCb,
    });
  });

  it('tests killActivePingProc is called', async () => {
    let pingPromise: Promise<void>;
    cmdMock = parseSysmonArgs(argvMock);
    pingPromise = pingMain(cmdMock);
    deferredSpawnPing.resolve();
    await vi.waitFor(() => {
      if(spawnPingProcOpts?.pingCb === undefined) {
        throw new Error('pingCb not regisered');
      }
    });
    spawnPingProcOpts?.pingCb(pingResMock);
    await pingPromise;
    killActivePingProc();
    expect(pingMocks.activePingProcKill).toHaveBeenCalledWith('SIGINT');
  });
});
