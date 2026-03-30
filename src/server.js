const http = require('http');
const { createApp } = require('./app');
const { env } = require('./config/env');
const logger = require('./common/logger');

const app = createApp();
const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error({
      module: 'server',
      action: 'listen',
      result: 'failure',
      error: {
        message: `Port ${env.port} is already in use`,
        code: 'EADDRINUSE',
        status: 500,
      },
    });
    process.exit(1);
  }
  throw err;
});

server.listen(env.port, () => {
  logger.info({
    module: 'server',
    action: 'listen',
    result: 'success',
    port: env.port,
    environment: env.nodeEnv,
  });
});

function shutdown(signal) {
  logger.warn({
    module: 'server',
    action: 'shutdown',
    result: 'success',
    signal,
  });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
