
import os from 'os';
import dotenv from 'dotenv';
import { isString } from './lib/util/validate-primitives';

dotenv.config();

const config = {
  ENVIRONMENT: getEnvironment(),
  POSTGRES_PORT: getPostgresPort(),
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_DB: process.env.POSTGRES_DB,
  platform: os.platform(),
};

export {
  config,
};

function getEnvironment() {
  return process.env.ENVIRONMENT ?? 'development';
}

function getPostgresPort(): number {
  let rawPort: unknown;
  rawPort = process.env.POSTGRES_PORT;
  if(
    isString(rawPort)
    && !isNaN(+rawPort)
  ) {
    return +rawPort;
  }
  throw new Error(`Invalid postgress port: ${rawPort}`);
}
