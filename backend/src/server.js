const config = require('./config/env');
const logger = require('./utils/logger');
const { connectDatabase, disconnectDatabase } = require('./config/db');
const createApp = require('./app');

async function start() {
  config.validateConfig();
  await connectDatabase(config.mongoUri);

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`API listening on http://localhost:${config.port}/api (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received - shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
