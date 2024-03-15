
import os from 'os';
import dotenv from 'dotenv';
import { isString } from './lib/util/validate-primitives';

dotenv.config();

const config = {
  ENVIRONMENT: getEnvironment(),
  platform: os.platform(),
  POSTGRES_PORT: getPostgresPort(),
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_DB: process.env.POSTGRES_DB,
  EZD_API_BASE_URL: process.env.EZD_API_BASE_URL,
  EZD_ENCRYPTION_SECRET: getEnvVarOrErr('EZD_ENCRYPTION_SECRET'),
};

export {
  config,
};

function getEnvVarOrErr(envKey: string): string {
  let rawEnvVar: string | undefined;
  rawEnvVar = process.env[envKey];
  if(!isString(rawEnvVar)) {
    throw new Error(`Invalid ${envKey}`);
  }
  return rawEnvVar;
}

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
