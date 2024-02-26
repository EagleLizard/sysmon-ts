
import { Client } from 'pg';
import { config } from '../../config';

export type PG_DEFAULT = 'DEFAULT';
export const PG_DEFAULT_VAL: PG_DEFAULT = 'DEFAULT';

export  class PostgresClient {
  static async getClient() {
    const client = new Client({
      port: config.POSTGRES_PORT,
      user: config.POSTGRES_USER,
      password: config.POSTGRES_PASSWORD,
      database: config.POSTGRES_DB,
    });
    await client.connect();
    return client;
  }
}
