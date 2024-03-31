
import { config } from '../../config';
import { logger } from '../logger';
import { ADDR_TYPE_ENUM, TimeBucketUnit } from '../models/ping-args';
import { PingStatDto } from '../models/ping-stat-dto';
import { isNumber } from '../util/validate-primitives';

export type InsertPingParams = {
  srcAddr: string;
  bytes: number;
  addr: string;
  seq: number;
  ttl: number;
  time: number;
  timeUnit: string;
}

export type PingGetStatsOpts = {
  addrType?: ADDR_TYPE_ENUM;
  bucketVal?: number;
  bucketUnit?: TimeBucketUnit;
  start?: string;
};

export class PingService {

  static async getStatsByAddr(addrId: number): Promise<PingStatDto[] | undefined> {
    let pingStatResults: PingStatDto[] | undefined;
    let url: string;
    let pingStatsRawRespone: Response;
    url = `${config.EZD_API_BASE_URL}/v1/addr/${addrId}/ping/stats`;
    pingStatsRawRespone = await fetch(url);
    let pingStatsResp = await pingStatsRawRespone.json();
    if(Array.isArray(pingStatsResp.result)) {
      pingStatResults = pingStatsResp.result.map((rawStat: unknown) => {
        return PingStatDto.deserialize(rawStat);
      });
    }
    return pingStatResults;
  }

  static async getStats(opts: PingGetStatsOpts = {}): Promise<PingStatDto[] | undefined> {
    let pingStatsResults: PingStatDto[] | undefined;
    let url: string;
    let pingStatsRawResp: Response;
    let queryParams: URLSearchParams;

    queryParams = new URLSearchParams;

    if(opts.addrType !== undefined) {
      queryParams.append('addr_type', opts.addrType);
    }
    if(opts.bucketVal !== undefined) {
      queryParams.append('bucket_val', `${opts.bucketVal}`);
      if(opts.bucketUnit !== undefined) {
        queryParams.append('bucket_unit', opts.bucketUnit);
      }
    }
    if(opts.start !== undefined) {
      queryParams.append('start', opts.start);
    }

    url = `${config.EZD_API_BASE_URL}/v1/ping/stats`;
    if(queryParams.size > 0) {
      url = `${url}?${queryParams.toString()}`;
    }

    pingStatsRawResp = await fetch(url);
    let pingStatsResp = await pingStatsRawResp.json();

    if(Array.isArray(pingStatsResp.result)) {
      pingStatsResults = pingStatsResp.result.map((rawStat: unknown) => {
        return PingStatDto.deserialize(rawStat);
      });
    }
    return pingStatsResults;
  }

  static async getAddrIdByVal(addr: string): Promise<number | undefined> {
    let url: string;
    url = `${config.EZD_API_BASE_URL}/v1/addr`;
    const body = {
      addr,
    };
    try {
      let resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      let respBody = await resp.json();
      // console.log(respBody);
      if(!isNumber(respBody.result?.ping_addr_id)) {
        return;
      }
      return respBody.result.ping_addr_id;
    } catch(e) {
      console.error(e);
      logger.error(e);
      throw e;
    }
  }

  static async postPing(params: InsertPingParams) {
    let url: string;
    url = `${config.EZD_API_BASE_URL}/v1/ping`;
    const body = {
      src_addr: params.srcAddr,
      addr: params.addr,
      bytes: params.bytes,
      seq: params.seq,
      ttl: params.ttl,
      time: params.time,
      time_unit: params.timeUnit,
    };
    try {
      let resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      return resp;
    } catch(e) {
      console.error(e);
      logger.error(e);
      throw e;
    }
  }
}
