
import { config } from '../../config';
import { PostgresClient } from '../db/pg-client';
import { logger } from '../logger';
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

export class PingService {

  static async getStats(): Promise<PingStatDto[] | undefined> {
    let pingStatsResults: PingStatDto[] | undefined;
    let url: string;
    url = `${config.EZD_API_BASE_URL}/v1/ping/stats`;
    let pingStatsRawResp = await fetch(url);
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
        body: JSON.stringify(body),
      });
      let respBody = await resp.json();
      if(!isNumber(respBody.ping_addr_id)) {
        return;
      }
      return respBody.ping_addr_id;
    } catch(e) {
      logger.error(e);
    }
  }

  static async insertAddr(addr: string): Promise<number> {
    let rawAddrId: number | undefined;
    let insertQueryRes = await PostgresClient.query([
      'insert into ping_addr (addr) values($1)  returning *'
    ].join(' '), [
      addr,
    ]);
    rawAddrId = insertQueryRes.rows[0]?.ping_addr_id;
    if(!isNumber(rawAddrId)) {
      throw new Error(`could not insert addr: ${addr}`);
    }
    return rawAddrId;
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
      logger.error(e);
    }
  }
}
