import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';

const server = app.listen(env.PORT, () => {
  logger.info(`ELMS API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

// Graceful Shutdown implementation
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Prisma ORM disconnected.');
    redis.quit();
    logger.info('Redis connection closed.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful process gets stuck
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));