
import { Pool, QueryConfig, QueryResult } from 'pg';
import { config } from '../../config';
import { logger } from '../logger';

const pgPool = new Pool({
  port: config.POSTGRES_PORT,
  user: config.POSTGRES_USER,
  password: config.POSTGRES_PASSWORD,
  database: config.POSTGRES_DB,
});
export  class PostgresClient {
  private static async getClient() {
    const client = await pgPool.connect();
    return client;
  }

  static async query<T extends any[], V extends any[]>(query: string | QueryConfig<T[]>, values?: V): Promise<QueryResult> {
    let client = await PostgresClient.getClient();
    let queryRes = await client.query(query, values);
    client.release();
    return queryRes;
  }

  static end() {
    logger.info('ending postgres pool');
    return pgPool.end();
  }
}
