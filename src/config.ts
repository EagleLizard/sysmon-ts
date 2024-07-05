
import dotenv from 'dotenv';
import { isString } from './lib/util/validate-primitives';

dotenv.config();

const config = {
  DEBUG_EZD: getBoolEnvVar('DEBUG_EZD'),
  ENVIRONMENT: getEnvironment(),
  POSTGRES_PORT: getPostgresPort(),
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_DB: process.env.POSTGRES_DB,
  EZD_API_BASE_URL: process.env.EZD_API_BASE_URL,
  EZD_API_USER: getEnvVarOrErr('EZD_API_USER'),
  EZD_API_PASSWORD: getEnvVarOrErr('EZD_API_PASSWORD'),
  EZD_ENCRYPTION_SECRET: getEnvVarOrErr('EZD_ENCRYPTION_SECRET'),
} as const;

export {
  config,
};

function getBoolEnvVar(envKey: string): boolean {
  let rawEnvVar: string | undefined;
  rawEnvVar = getEnvVar(envKey);
  if(
    (rawEnvVar === 'true')
    || (rawEnvVar === '1')
  ) {
    return true;
  }
  return false;
}

function getEnvVar(envKey: string): string | undefined {
  let rawEnvVar: string | undefined;
  rawEnvVar = process.env[envKey];
  if(!isString(rawEnvVar)) {
    return undefined;
  }
  return rawEnvVar;
}

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
