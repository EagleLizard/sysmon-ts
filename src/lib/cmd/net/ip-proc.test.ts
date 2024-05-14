
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpawnProcOpts } from '../proc';
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
  }
});

describe('ipProc tests', () => {
  let spawnProcCmd: string;
  let spawnProcArgs: string[] | undefined;
  let spawnProcOpts: SpawnProcOpts | undefined;

  let ifaceMock: string;
  let ipAddrMock: string;

  let deferredSpawn: Deferred<string>;
  

  beforeEach(() => {

    deferredSpawn = Deferred.init();
    
    ipProcMocks.spawnProcMock.mockImplementation((
      cmd: string,
      args?: string[] | undefined,
      opts?: SpawnProcOpts,
    ) => {
      spawnProcCmd = cmd;
      spawnProcArgs = args;
      spawnProcOpts = opts;
      return {
        proc: {},
        promise: deferredSpawn.promise,
      };
    });

    ipProcMocks.osPlatformMock.mockReturnValue('darwin');
    ifaceMock = 'mock_wlan0';
    ipAddrMock = '123.456.7.255';
  });

  it('tests ipProc (darwin)', async () => {
    let ipProcRes: string;
    deferredSpawn.resolve([
      'route to: one.one.one.one',
      `interface: ${ifaceMock}`,
    ].join('\n'));
    deferredSpawn.promise.finally(() => {
      deferredSpawn = Deferred.init();
      deferredSpawn.resolve([
        `${ifaceMock}: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500`,
        `inet ${ipAddrMock} netmask 0xfffffc00 broadcast 192.168.7.255`
      ].join('\n'));
    })
    
    ipProcRes = await ipProc();
    expect(ipProcRes).toEqual(ipAddrMock);
  });

  /*
  1.1.1.1 via 192.168.4.1 dev eth0 src 192.168.4.59 uid 1000
    cache

  2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether dc:a6:32:cc:7d:9c brd ff:ff:ff:ff:ff:ff
    inet 192.168.4.59/22 brd 192.168.7.255 scope global dynamic noprefixroute eth0
       valid_lft 7949sec preferred_lft 7949sec
  */

  it('tests ipProc (linux)', async () => {
    let ipProcRes: string;
    ipProcMocks.osPlatformMock.mockReturnValue('linux');
    deferredSpawn.resolve([
      `1.1.1.1 via 123.456.7.1 dev eth0 src 123.456.7.59 uid 1000`,
      '  cache',
    ].join('\n'));
    deferredSpawn.promise.finally(() => {
      deferredSpawn = Deferred.init();
      deferredSpawn.resolve([
        `2: ${ifaceMock}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000`,
        'link/ether dc:a6:32:cc:7d:9c brd ff:ff:ff:ff:ff:ff',
        `inet ${ipAddrMock}/22 brd 123.456.7.255 scope global dynamic noprefixroute ${ifaceMock}`,
       'valid_lft 7949sec preferred_lft 7949sec',
      ].join('\n'));
    });
    ipProcRes = await ipProc();
    expect(ipProcRes).toEqual(ipAddrMock);
  })

});
