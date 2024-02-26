
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { sysmonMain } from './lib/sysmon';
import { logger } from './lib/logger';

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
