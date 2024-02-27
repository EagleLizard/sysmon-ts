
import { Pool } from 'pg';
import { config } from '../../config';

const pgPool = new Pool({
  port: config.POSTGRES_PORT,
  user: config.POSTGRES_USER,
  password: config.POSTGRES_PASSWORD,
  database: config.POSTGRES_DB,
});
export  class PostgresClient {
  static async getClient() {
    const client = await pgPool.connect();
    return client;
    // let pgClientConfig: ClientConfig;
    // pgClientConfig = {
    //   host: config.POSTGRES_HOST,
    //   port: config.POSTGRES_PORT,
    //   user: config.POSTGRES_USER,
    //   password: config.POSTGRES_PASSWORD,
    //   database: config.POSTGRES_DB,
    // };
    // const client = new Client(pgClientConfig);
    // await client.connect();
    // return client;
  }
}
