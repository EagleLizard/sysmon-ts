
import { describe, it, expect, beforeEach, Mock, vi } from 'vitest';
import { PingStatDto } from '../models/ping-stat-dto';
import { InsertPingParams, PingGetStatsOpts, PingService } from './ping-service';
import { ADDR_TYPE_ENUM } from '../models/ping-args';
import { Deferred } from '../../test/deferred';

const pingServiceMocks = vi.hoisted(() => {
  return {
    loggerError: vi.fn(),
  };
});

vi.mock('../logger', () => {
  return {
    logger: {
      error: pingServiceMocks.loggerError,
    },
  };
});

describe('ping-service tests', () => {
  let addrMock: string;
  let addrIdMock: number;
  let pingStatMock: PingStatDto;
  let postPingParamsMock: InsertPingParams;

  let fetchMock: Mock<any>;
  let jsonMock: Mock<any>;

  beforeEach(() => {
    pingServiceMocks.loggerError.mockReset();

    addrIdMock = 123;
    addrMock = 'addr.mock';
    postPingParamsMock = {
      srcAddr: '123.45.67.89',
      addr: addrMock,
      bytes: 64,
      seq: 0,
      ttl: 111,
      time: 12.345,
      timeUnit: 'ms',
    };

    pingStatMock = PingStatDto.deserialize({
      time_bucket: new Date('9/11/2001 5:37:00 am'),
      count: 11,
      avg: 12.345,
      max: 34.567,
      median: 14,
    });

    fetchMock = vi.fn();
    jsonMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('tests getStatsByAddr()', async () => {
    let getStatsByAddrPromise: Promise<{result: PingStatDto[]}>;
    let pingStats: PingStatDto[] | undefined;
    getStatsByAddrPromise = Promise.resolve({
      result: [
        pingStatMock,
      ],
    });
    jsonMock.mockReturnValueOnce(getStatsByAddrPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    pingStats = await PingService.getStatsByAddr(addrIdMock);
    expect(pingStats?.[0]).toEqual(pingStatMock);
  });

  it('tests getStatsByAddr() is undefined w/ wrong resp type', async () => {
    let getStatsByAddrPromise: Promise<{result: PingStatDto[] | undefined}>;
    let pingStats: PingStatDto[] | undefined;
    getStatsByAddrPromise = Promise.resolve({
      result: undefined,
    });
    jsonMock.mockReturnValueOnce(getStatsByAddrPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    pingStats = await PingService.getStatsByAddr(addrIdMock);
    expect(pingStats).toBeUndefined();
  });

  it('tests getStats()', async () => {
    let opts: PingGetStatsOpts;
    let getStatsPromise: Promise<{result: PingStatDto[]}>;
    let pingStats: PingStatDto[] | undefined;
    opts = {
      addrType: ADDR_TYPE_ENUM.GLOBAL,
      bucketVal: 5,
      bucketUnit: 'min',
      start: '7d',
    };
    getStatsPromise = Promise.resolve({
      result: [
        pingStatMock,
      ]
    });
    jsonMock.mockReturnValueOnce(getStatsPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    pingStats = await PingService.getStats(opts);
    expect(pingStats?.[0]).toEqual(pingStatMock);
  });

  it('tests getStatsByAddr() with partial opts', async () => {
    let opts: PingGetStatsOpts;
    let getStatsPromise: Promise<{result: PingStatDto[] | undefined}>;
    let pingStats: PingStatDto[] | undefined;
    opts = {
      bucketVal: 5,
    };
    getStatsPromise = Promise.resolve({
      result: [
        pingStatMock,
      ]
    });
    jsonMock.mockReturnValueOnce(getStatsPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    pingStats = await PingService.getStats(opts);
    const lastCall = fetchMock.mock.lastCall;
    const lastCallUrl = new URL(lastCall?.[0]);
    expect(pingStats?.[0]).toEqual(pingStatMock);
    expect(lastCallUrl.searchParams.get('bucket_val')).toBe('5');
    expect(lastCallUrl.searchParams.has('bucket_unit')).toBe(false);
  });

  it('tests getStatsByAddr() with empty opts', async () => {
    let getStatsPromise: Promise<{result: PingStatDto[] | undefined}>;
    let pingStats: PingStatDto[] | undefined;
    getStatsPromise = Promise.resolve({
      result: [
        pingStatMock,
      ]
    });
    jsonMock.mockReturnValueOnce(getStatsPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    pingStats = await PingService.getStats();
    expect(pingStats?.[0]).toEqual(pingStatMock);
  });

  it('tests getStatsByAddr() is undefined w/ wrong resp type', async () => {
    let getStatsPromise: Promise<{result: PingStatDto[] | undefined}>;
    let pingStats: PingStatDto[] | undefined;
    getStatsPromise = Promise.resolve({
      result: undefined,
    });
    jsonMock.mockReturnValueOnce(getStatsPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    pingStats = await PingService.getStats();
    expect(pingStats).toBeUndefined();
  });

  it('tests getAddrIdByVal()', async () => {
    let addrId: number | undefined;
    let getAddrIdByValPromise: Promise<{ result: { ping_addr_id: number | undefined } }>;
    getAddrIdByValPromise = Promise.resolve({
      result: {
        ping_addr_id: addrIdMock,
      },
    });
    jsonMock.mockReturnValueOnce(getAddrIdByValPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    addrId = await PingService.getAddrIdByVal(addrMock);
    expect(addrId).toEqual(addrIdMock);
  });

  it('tests getAddrIdByVal() is undefined w/ wrong resp type', async () => {
    let addrId: number | undefined;
    let getAddrIdByValPromise: Promise<{ result: { ping_addr_id: number | undefined } }>;
    getAddrIdByValPromise = Promise.resolve({
      result: {
        ping_addr_id: undefined,
      },
    });
    jsonMock.mockReturnValueOnce(getAddrIdByValPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    addrId = await PingService.getAddrIdByVal(addrMock);
    expect(addrId).toBeUndefined();
  });

  it('tests postPing()', async () => {
    let resp: Response;
    let statusMock: number;
    statusMock = 418;
    fetchMock.mockResolvedValueOnce({
      status: statusMock,
    });

    resp = await PingService.postPing(postPingParamsMock);
    expect(resp.status).toBe(statusMock);

    const lastCallBody = JSON.parse(fetchMock.mock.lastCall?.[1]?.body);
    expect(lastCallBody?.addr).toEqual(postPingParamsMock.addr);
  });

  // #region !!! ERROR PATHS !!!

  it('tests getAddrIdByVal() throws error', async () => {
    let deferred: Deferred<void>;
    let errMsg: string;
    errMsg = 'Mock Err';
    deferred = Deferred.init();
    jsonMock.mockReturnValueOnce(deferred.promise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    deferred.reject(new Error(errMsg));
    await expect(() => {
      return PingService.getAddrIdByVal(addrMock);
    }).rejects.toThrow(errMsg);
    expect(pingServiceMocks.loggerError).toHaveBeenCalled();
  });

  it('tests postPing() throws error', async () => {
    let deferred: Deferred<void>;
    let errMsg: string;
    errMsg = 'Mock postPing() Err';
    deferred = Deferred.init();
    fetchMock.mockReturnValueOnce(deferred.promise);
    deferred.reject(new Error(errMsg));
    await expect(() => {
      return PingService.postPing(postPingParamsMock);
    }).rejects.toThrow(errMsg);
    expect(pingServiceMocks.loggerError).toHaveBeenCalled();
  });

  // #endregion

});
