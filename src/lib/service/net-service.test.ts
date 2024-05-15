
import dns from 'dns';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetService } from './net-service';

const netServiceMocks = vi.hoisted(() => {
  return {
    lookup: vi.fn(),
  };
});

vi.mock('dns', () => {
  return {
    default: {
      lookup: netServiceMocks.lookup,
    },
  };
});

type DnsLookupCb = (
  err: NodeJS.ErrnoException | null,
  address: string,
  family: number
) => void;

describe('net-service tests', () => {
  let dnsLookupUrl: string | undefined;
  let dnsLookupOpts: dns.LookupOneOptions | undefined;
  let dnsLookupCb: DnsLookupCb | undefined;

  let hostnameMock: string;
  let ipAddrMock: string;

  beforeEach(() => {
    netServiceMocks.lookup.mockReset();
    netServiceMocks.lookup.mockImplementation((
      url: string,
      opts: dns.LookupOneOptions,
      cb: DnsLookupCb,
    ) => {
      dnsLookupUrl = url;
      dnsLookupOpts = opts;
      dnsLookupCb = cb;
    });

    hostnameMock = 'mock.hostname';
    ipAddrMock = '12.345.67.890';
  });

  it('tests NetService.dnsLookup returns the expected value', () => {
    let dnsLookupPromise: Promise<string>;
    dnsLookupPromise = NetService.dnsLookup(hostnameMock);
    dnsLookupCb?.(null, ipAddrMock, 4);
    expect(dnsLookupPromise).resolves.toBe(ipAddrMock);
    expect(dnsLookupUrl).toEqual(hostnameMock);
    expect(dnsLookupOpts).toEqual({
      family: 4,
    });
  });

  /*
    !!! ERRORS !!!
  */

  it('tests NetService.dnsLookup throws the underlying dns.lookup error', () => {
    let dnsLookupPromise: Promise<string>;
    let errMsgMock: string;
    let errMock: Error;
    dnsLookupPromise = NetService.dnsLookup(hostnameMock);
    errMsgMock = 'Mock Error.';
    errMock = new Error(errMsgMock);
    dnsLookupCb?.(errMock, '', -1);
    expect(dnsLookupPromise).rejects.toThrow(errMsgMock);
  });
});
