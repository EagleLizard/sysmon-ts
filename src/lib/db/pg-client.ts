
import { Pool, QueryConfig, QueryResult } from 'pg';
import { config } from '../../config';

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

  static async query(query: string | QueryConfig<string[]>, values?: string[]): Promise<QueryResult> {
    let client = await PostgresClient.getClient();
    let queryRes = await client.query(query, values);
    client.release();
    return queryRes;
  }
}
