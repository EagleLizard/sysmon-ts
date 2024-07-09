
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { sysmonMain } from './lib/sysmon';
import { logger } from './lib/logger';
import { killActivePingProc } from './lib/cmd/ping/ping';
import { stopRunningMonitor } from './lib/cmd/monitor/monitor-cmd';

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
  setProcName();

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection');
    console.error(typeof reason);
    console.error(reason);
    logger.error('unhandledRejection:');
    logger.error(reason);
  });

  process.on('uncaughtException', (err, origin) => {
    console.error('uncaughtException');
    console.error(err);
    console.error(origin);
  });

  await sysmonMain();
}

async function shutdown(sig: string) {
  let shutdownMsg: string;
  shutdownMsg = `${sig} received`;
  logger.info(shutdownMsg);
  killActivePingProc();
  stopRunningMonitor();
  console.log(`${shutdownMsg} - shutting down`);
  process.exitCode = 0;
}

function setProcName() {
  process.title = 'ezd-sysmon';
}
