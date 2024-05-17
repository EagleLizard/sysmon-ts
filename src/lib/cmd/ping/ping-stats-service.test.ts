
import { WriteStream } from 'fs';

import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';
import { PingStatDto } from '../../models/ping-stat-dto';
import { AggregatePingStats, PingStatsService } from './ping-stats-service';

const MINUTE_MS = 1000 * 60;

type MockWs = {
  write: WriteStream['write'];
};

const pingServiceMocks = vi.hoisted(() => {
  return {
    getAddrIdByVal: vi.fn(),
    getStats: vi.fn(),
    getStatsByAddr: vi.fn(),
  };
});

vi.mock('../../service/ping-service', async (importOriginal) => {
  let original = await importOriginal<typeof import('../../service/ping-service')>();
  let mocked = {
    ...original,
  };
  mocked.PingService.getAddrIdByVal = pingServiceMocks.getAddrIdByVal;
  mocked.PingService.getStats = pingServiceMocks.getStats;
  mocked.PingService.getStatsByAddr = pingServiceMocks.getStatsByAddr;
  return mocked;
});

describe('PingStatsService tests', () => {
  let baseTimeBucketMs: number;
  let pingStatsMock: PingStatDto[];
  let addrIdMock: number;

  let wsMock: Mocked<MockWs>;

  beforeEach(() => {
    pingServiceMocks.getAddrIdByVal.mockReset();
    pingServiceMocks.getStats.mockReset();
    pingServiceMocks.getStatsByAddr.mockReset();

    baseTimeBucketMs = (new Date('9/11/2001 5:37:00 am')).valueOf();
    pingStatsMock = [
      {
        time_bucket: baseTimeBucketMs + MINUTE_MS,
        count: 2,
        avg: 20,
        max: 25,
        min: 15,
        median: 19,
      },
      {
        time_bucket: baseTimeBucketMs,
        count: 2,
        avg: 10,
        max: 15,
        min: 5,
        median: 9,
      },
      {
        time_bucket: baseTimeBucketMs + (MINUTE_MS * 2),
        count: 2,
        avg: 30,
        max: 35,
        min: 25,
        median: 29,
      },
    ].map(PingStatDto.deserialize);
    addrIdMock = 1;

    wsMock = {
      write: vi.fn<any>(),
    };

    pingServiceMocks.getAddrIdByVal.mockResolvedValueOnce(addrIdMock);
    pingServiceMocks.getStats.mockResolvedValueOnce(pingStatsMock);
    pingServiceMocks.getStatsByAddr.mockResolvedValueOnce(pingStatsMock);
  });

  it('tests getAggregateStats()', () => {
    let aggStat: AggregatePingStats;
    aggStat = PingStatsService.getAggregateStats(pingStatsMock);
    expect(aggStat.minAvg).toBe(10);
    expect(aggStat.maxAvg).toBe(30);
    expect(aggStat.avgSum).toBe(60);
    expect(aggStat.stdDev).toBe(10);
  });

  it('tests printStats()', () => {
    let aggStat: AggregatePingStats;
    aggStat = PingStatsService.getAggregateStats(pingStatsMock);
    PingStatsService.printStats(
      pingStatsMock,
      aggStat,
      (wsMock as unknown) as WriteStream
    );
    expect(wsMock.write).toHaveBeenCalled();
  });

  it('tests getPingStats()', async () => {
    let pingStats: PingStatDto[];
    pingStats = await PingStatsService.getPingStats({
      numStdDevs: 1,
    });
    expect(pingStats).toEqual(pingStatsMock);
  });

  it('tests getPingStats() with opts.addr', async () => {
    let pingStats: PingStatDto[];
    let addrMock: string;
    addrMock = 'mock.addr';
    pingStats = await PingStatsService.getPingStats({
      numStdDevs: 1,
      addr: addrMock,
    });
    expect(pingStats).toEqual(pingStatsMock);
    expect(pingServiceMocks.getStatsByAddr).toHaveBeenCalledWith(addrIdMock);
  });

});
