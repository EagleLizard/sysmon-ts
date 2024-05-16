
import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { SysmonCommand, parseSysmonArgs } from '../sysmon-args';
import { GLOBAL_PING_STATS_OUTFILE_NAME, LOCAL_PING_STATS_OUTFILE_NAME, pingStatsMain } from './ping-stats';
import { WriteStream } from 'fs';
import { PingStatDto } from '../../models/ping-stat-dto';

const pingStatsMocks = vi.hoisted(() => {
  return {
    createWriteStream: vi.fn(),
  };
});

const pingStatsServiceMocks = vi.hoisted(() => {
  return {
    getPingStats: vi.fn(),
  };
});

vi.mock('fs', (importOriginal) => {
  return {
    default: {
      ...importOriginal<typeof import('fs')>,
      createWriteStream: pingStatsMocks.createWriteStream,
    },
  };
});

vi.mock('./ping-stats-service', async (importOriginal) => {
  let original = await importOriginal<typeof import('./ping-stats-service')>();
  let mocked = {
    ...original,
  };
  mocked.PingStatsService.getPingStats = pingStatsServiceMocks.getPingStats;
  return mocked;
});

type MockWs = {
  write: WriteStream['write'];
}

describe('ping-stats tests', () => {

  let time_bucket_mock: number;
  let count_mock: number;
  let avg_mock: number;
  let max_mock: number;
  let median_mock: number;
  let pingStatsMock: PingStatDto[];

  let argvMock: string[];
  let cmdMock: SysmonCommand;

  let mockWs: Mocked<MockWs>;

  beforeEach(() => {
    pingStatsMocks.createWriteStream.mockReset();
    pingStatsServiceMocks.getPingStats.mockReset();

    argvMock = [ 'node', 'main.js', 'ping-stat' ];

    time_bucket_mock = new Date('9/11/2001 5:37:00 am').valueOf();
    count_mock = 420;
    avg_mock = 12.345;
    max_mock = 123;
    median_mock = 5.678;
    pingStatsMock = [
      PingStatDto.deserialize({
        time_bucket: time_bucket_mock,
        count: count_mock,
        avg: avg_mock,
        max: max_mock,
        median: median_mock,
      }),
    ];

    mockWs = {
      write: vi.fn<any>(),
    };

    pingStatsMocks.createWriteStream.mockReturnValueOnce(mockWs);
    pingStatsServiceMocks.getPingStats.mockResolvedValueOnce(pingStatsMock);
  });

  it('tests pingStatsMain', () => {
    let pingStatsPromise: Promise<void>;
    cmdMock = parseSysmonArgs(argvMock);

    pingStatsPromise = pingStatsMain(cmdMock);

    expect(pingStatsPromise).resolves;
    expect(mockWs.write).toBeCalled();
  });

  it('tests the \'local\' network flag', async () => {
    let pingStatsPromise: Promise<void>;
    argvMock = argvMock.concat([
      '-net', 'local',
    ]);
    cmdMock = parseSysmonArgs(argvMock);
    pingStatsPromise = pingStatsMain(cmdMock);
    await pingStatsPromise;
    expect(pingStatsMocks.createWriteStream.mock.lastCall[0])
      .toContain(LOCAL_PING_STATS_OUTFILE_NAME);
  });

  it('tests the \'global\' network flag', async () => {
    let pingStatsPromise: Promise<void>;
    argvMock = argvMock.concat([
      '-net', 'global',
    ]);
    cmdMock = parseSysmonArgs(argvMock);
    pingStatsPromise = pingStatsMain(cmdMock);
    await pingStatsPromise;
    expect(pingStatsMocks.createWriteStream.mock.lastCall[0])
      .toContain(GLOBAL_PING_STATS_OUTFILE_NAME);
  });

});
