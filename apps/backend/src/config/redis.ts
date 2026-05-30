import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));