
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { sysmonMain } from './lib/sysmon';
import { logger } from './lib/logger';
import { killActivePingProc } from './lib/cmd/ping/ping';
import { killRunningMonitor } from './lib/cmd/monitor/monitor-cmd';
import { getIntuitiveTimeString } from './lib/util/format-util';

const SHUTDOWN_TIMEOUT_MS = 1e3;

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
    logger.error('unhandledRejection:');
    logger.error(reason);
  });

  await sysmonMain();
}

async function shutdown(sig: string) {
  logger.info(`${sig} received.`);
  killActivePingProc();
  killRunningMonitor();
  setImmediate(() => {
    // console.clear();
    process.exitCode = 0;
    setTimeout(() => {
      console.error(`Process didn't quit after ${getIntuitiveTimeString(SHUTDOWN_TIMEOUT_MS)}. Shutting down now.`);
      process.exit();
    }, SHUTDOWN_TIMEOUT_MS);
  });
}

function setProcName() {
  process.title = 'sysmon-ezd';
}
