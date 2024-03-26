
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { sysmonMain } from './lib/sysmon';
import { logger } from './lib/logger';
import { killActivePingProc } from './lib/cmd/ping/ping';
import { killRunningMonitor } from './lib/cmd/monitor/monitor-cmd';

(async () => {
  try {
    await main();
  } catch(e) {
    console.error(e);
    logger.error(e);
    throw e;
  }
})();

async function main() {
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

  setProcName();

  await sysmonMain();
}

async function shutdown(sig: string) {
  logger.info(`${sig} received.`);
  killActivePingProc();
  killRunningMonitor();
  process.exit(0);
  // setTimeout(() => {
  //   console.log(`timeout reached for ${sig}, exiting`);
  //   process.exit(1);
  // }, 2000);
}

function setProcName() {
  process.title = 'sysmon-ezd';
}
