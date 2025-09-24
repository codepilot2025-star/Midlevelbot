const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

let logger;
if (isDev) {
  // try to use pino-pretty if available for readable logs in development
  try {
    const pretty = require('pino-pretty');
    logger = pino({ level: process.env.LOG_LEVEL || 'debug' }, pretty());
  } catch (err) {
    logger = pino({ level: process.env.LOG_LEVEL || 'debug' });
  }
} else {
  logger = pino({ level: process.env.LOG_LEVEL || 'info' });
}

module.exports = logger;
