
import { PostgresClient } from '../db/pg-client';
import { isNumber } from '../util/validate-primitives';

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
}
