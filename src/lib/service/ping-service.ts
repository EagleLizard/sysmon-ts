
import { PostgresClient } from '../db/pg-client';
import { isNumber } from '../util/validate-primitives';

export type InsertPingParams = {
  srcAddrId: number;
  bytes: number;
  addrId: number;
  seq: number;
  ttl: number;
  time: number;
  timeUnit: string;
}

export class PingService {
  static async getAddrIdByVal(addr: string): Promise<number | undefined> {
    let addrQueryRes = await PostgresClient.query([
      'select * from ping_addr pa',
      `where pa.addr = '${addr}'`,
    ].join(' '));
    return addrQueryRes.rows[0]?.ping_addr_id;
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

  static insertPing(params: InsertPingParams) {
    let col_names: string[];
    let col_names_str: string;
    let col_nums_str: string;

    let queryStr: string;
    let queryParams: [ number, number, number, number, number, number, string ];
    col_names = [
      'src_addr_id',
      'bytes',
      'addr_id',
      'seq',
      'ttl',
      'time',
      'time_unit',
    ];
    col_nums_str = col_names.map((col_name, idx) => {
      return `$${idx + 1}`;
    }).join(', ');
    col_names_str = col_names.join(', ');
    queryStr = `INSERT INTO ping (${col_names_str}) VALUES(${col_nums_str})`;
    queryParams = [
      params.srcAddrId,
      params.bytes,
      params.addrId,
      params.seq,
      params.ttl,
      params.time,
      params.timeUnit,
    ];
    return PostgresClient.query(queryStr, queryParams);
  }
}
