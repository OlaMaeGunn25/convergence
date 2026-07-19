/**
 * Structured application logger
 * =============================
 * Single Winston instance shared by the gateway, the routers, the background
 * schedulers, and the lib/ modules. JSON in production (for cloud log drains),
 * colorized single-line output in development.
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production'
    ? winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json())
    : winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.printf(({ timestamp, level, message, stack }) => `${timestamp} ${level} ${message}${stack ? '\n' + stack : ''}`)),
  transports: [new winston.transports.Console()]
});

module.exports = logger;
