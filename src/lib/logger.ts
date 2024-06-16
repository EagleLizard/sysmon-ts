import winston, { createLogger } from 'winston';
import { config } from '../config';

const level = (config.ENVIRONMENT === 'development')
  ? 'debug'
  : 'info'
;

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.splat(),
  winston.format.errors(),
  winston.format.printf(info => {
    const log = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      ...info['0'],
    };
    return JSON.stringify(log);
  })
);

const transports: winston.transport[] = [];
// transports.push(new winston.transports.Console({
//   stderrLevels: [
//     'error',
//   ]
// }));
transports.push(
  new winston.transports.File({
    filename: 'logs/app.log',
  }),
);

export const logger = createLogger({
  levels: winston.config.npm.levels,
  level,
  format,
  transports,
});
