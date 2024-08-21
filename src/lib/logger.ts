
// import winston, { createLogger } from 'winston';
// import { config } from '../config';

// const level = (config.ENVIRONMENT === 'development')
//   ? 'debug'
//   : 'info'
// ;

// const format = winston.format.combine(
//   winston.format.timestamp(),
//   winston.format.splat(),
//   winston.format.errors(),
//   winston.format.printf(info => {
//     const log = {
//       timestamp: info.timestamp,
//       level: info.level,
//       message: info.message,
//       ...info['0'],
//     };
//     return JSON.stringify(log);
//   })
// );

// const transports: winston.transport[] = [];
// // transports.push(new winston.transports.Console({
// //   stderrLevels: [
// //     'error',
// //   ]
// // }));
// transports.push(
//   new winston.transports.File({
//     filename: 'logs/app.log',
//   }),
// );

// export const logger = createLogger({
//   levels: winston.config.npm.levels,
//   level,
//   format,
//   transports,
// });


import path from 'path';

import pino, { Logger, LoggerOptions } from 'pino';

import { config } from '../config';
import { LOG_DIR_PATH } from '../constants';

const APP_LOG_FILE_NAME = 'app.log';
const APP_LOG_FILE_PATH = [
  LOG_DIR_PATH,
  APP_LOG_FILE_NAME,
].join(path.sep);

const APP_ERROR_LOG_FILE_NAME = 'app.error.log';
const APP_ERROR_LOG_FILE_PATH = [
  LOG_DIR_PATH,
  APP_ERROR_LOG_FILE_NAME,
].join(path.sep);

const level = (config.ENVIRONMENT === 'development')
  ? 'debug'
  : 'info'
;

export const logger = initLogger();

/*
  see: https://github.com/fastify/fastify/blob/ac462b2b4d859e88d029019869a9cb4b8626e6fd/lib/logger.js
*/
function initLogger() {
  let opts: LoggerOptions;
  // let stream = pino.destination('./logs/app2.log');
  let streams = [
    {
      stream: pino.destination(APP_LOG_FILE_PATH),
    },
    {
      stream: pino.destination(APP_ERROR_LOG_FILE_PATH),
      level: 'error',
    },
    // {
    //   stream: process.stdout,
    //   level: 'debug',
    // },
    // {
    //   stream: process.stderr,
    //   level: 'error',
    // },
  ];
  let stream = pino.multistream(streams);
  opts = {
    level,
  };
  let logger2: Logger = pino(opts, stream);
  return logger2;
}
