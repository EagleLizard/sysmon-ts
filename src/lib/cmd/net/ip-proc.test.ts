
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ipProc } from './ip-proc';
import { Deferred } from '../../../test/deferred';

const ipProcMocks = vi.hoisted(() => {
  return {
    spawnProcMock: vi.fn(),
    osPlatformMock: vi.fn(),
  };
});

vi.mock('../proc', () => {
  return {
    spawnProc: ipProcMocks.spawnProcMock,
  };
});

vi.mock('os', (importOriginal) => {
  return {
    default: {
      ...importOriginal<typeof import('os')>,
      platform: ipProcMocks.osPlatformMock,
    },
  };
});

describe('ipProc tests', () => {

  let ifaceMock: string;
  let ipAddrMock: string;
  let invalidIfaceMock: string;
  let invalidIpMock: string;

  let deferredSpawn: Deferred<string>;

  beforeEach(() => {
    ipProcMocks.spawnProcMock.mockReset();
    ipProcMocks.osPlatformMock.mockReset();

    deferredSpawn = Deferred.init();

    ipProcMocks.spawnProcMock.mockImplementation(() => {
      return {
        proc: {},
        promise: deferredSpawn.promise,
      };
    });

    ipProcMocks.osPlatformMock.mockReturnValue('darwin');
    ifaceMock = 'mockwlan0';
    ipAddrMock = '123.456.7.255';
    invalidIfaceMock = '$$$';
    invalidIpMock = 'invalid_ip_mock';
  });

  it('tests ipProc - (darwin)', async () => {
    let ipProcRes: string;
    deferredSpawn.resolve(getRouteCmdResultStr(ifaceMock));
    deferredSpawn.promise.finally(() => {
      deferredSpawn = Deferred.init();
      deferredSpawn.resolve(getIfconfigCmdResultStr(ifaceMock, ipAddrMock));
    });
    ipProcRes = await ipProc();
    expect(ipProcRes).toEqual(ipAddrMock);
    expect(ipProcMocks.spawnProcMock).toHaveBeenCalledWith('ifconfig', [ ifaceMock ]);
  });

  it('tests ipProc - (linux)', async () => {
    let ipProcRes: string;
    ipProcMocks.osPlatformMock.mockReturnValue('linux');
    deferredSpawn.resolve(getIpRouteCmdResultStr(ifaceMock));
    deferredSpawn.promise.finally(() => {
      deferredSpawn = Deferred.init();
      deferredSpawn.resolve(getIpAddrShowCmdResultStr(ifaceMock, ipAddrMock));
    });
    ipProcRes = await ipProc();
    expect(ipProcRes).toEqual(ipAddrMock);
    expect(ipProcMocks.spawnProcMock).toHaveBeenCalledWith('ip', [ 'a', 'show', ifaceMock ]);
  });

  /*
    !!! ERRORS !!!
  */

  it('tests that ipProc() throws an error when on an unsupported platform', async () => {
    let platformMock: string;
    platformMock = 'unsupported_platform_mock';
    ipProcMocks.osPlatformMock.mockReturnValue(platformMock);
    await expect(() => ipProc()).rejects.toThrowError(platformMock);
  });

  it('tests that ipProc() throws an error when the iface is invalid - (darwin)', async () => {
    deferredSpawn.resolve(getRouteCmdResultStr(invalidIfaceMock));
    await expect(() => ipProc()).rejects.toThrowError(invalidIfaceMock);
  });

  it('tests that ipProc() throws an error when the ip is invalid - (darwin)', async () => {
    deferredSpawn.resolve(getRouteCmdResultStr(ifaceMock));
    deferredSpawn.promise.finally(() => {
      deferredSpawn = Deferred.init();
      deferredSpawn.resolve(getIfconfigCmdResultStr(ifaceMock, invalidIpMock));
    });
    await expect(() => ipProc()).rejects.toThrowError(invalidIpMock);
  });

  it('tests that error is thrown when the iface is invalid - (linux)', async () => {
    ipProcMocks.osPlatformMock.mockReturnValue('linux');
    deferredSpawn.resolve(getIpRouteCmdResultStr(invalidIfaceMock));
    await expect(() => ipProc()).rejects.toThrowError(invalidIfaceMock);
  });

  it('tests that error is thrown when the ip is invalid - (linux)', async () => {
    ipProcMocks.osPlatformMock.mockReturnValue('linux');
    deferredSpawn.resolve(getIpRouteCmdResultStr(ifaceMock));
    deferredSpawn.promise.finally(() => {
      deferredSpawn = Deferred.init();
      deferredSpawn.resolve(getIpAddrShowCmdResultStr(ifaceMock, invalidIpMock));
    });
    await expect(() => ipProc()).rejects.toThrowError(invalidIpMock);
  });

});

function getRouteCmdResultStr(iface: string): string {
  let cmdResStr: string;
  cmdResStr = [
    'route to: one.one.one.one',
    `interface: ${iface}`,
  ].join('\n');
  return cmdResStr;
}

function getIfconfigCmdResultStr(iface: string, ipAddr: string): string {
  let cmdResStr: string;
  cmdResStr = [
    `${iface}: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500`,
    `inet ${ipAddr} netmask 0xfffffc00 broadcast 192.168.7.255`
  ].join('\n');
  return cmdResStr;
}

function getIpRouteCmdResultStr(iface: string): string {
  let cmdResStr: string;
  cmdResStr = [
    'ignore',
    `1.1.1.1 via 123.456.7.1 dev ${iface} src 123.456.7.59 uid 1000`,
    '  cache',
  ].join('\n');
  return cmdResStr;
}

function getIpAddrShowCmdResultStr(iface: string, ipAddr: string): string {
  let cmdResStr: string;
  cmdResStr = [
    `2: ${iface}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000`,
    'link/ether dc:a6:32:cc:7d:9c brd ff:ff:ff:ff:ff:ff',
    `inet ${ipAddr}/22 brd 123.456.7.255 scope global dynamic noprefixroute ${iface}`,
    'valid_lft 7949sec preferred_lft 7949sec',
  ].join('\n');
  return cmdResStr;
}
