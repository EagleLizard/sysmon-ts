
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { sysmonMain } from './lib/sysmon';
import { logger } from './lib/logger';
import { PostgresClient } from './lib/db/pg-client';
import { killActivePingProc } from './lib/cmd/ping/ping';

(async () => {
  try {
    await main();
  } catch(e) {
    logger.error(e);
    throw e;
  }
})();

async function main() {
  await sysmonMain();
}

async function shutdown(sig: string) {
  logger.info(`${sig} received.`);
  killActivePingProc();
  await PostgresClient.end();
  process.exit(0);
  // setTimeout(() => {
  //   console.log(`timeout reached for ${sig}, exiting`);
  //   process.exit(1);
  // }, 2000);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection:');
  logger.error(reason);
});

