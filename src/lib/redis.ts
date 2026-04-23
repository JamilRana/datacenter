import Redis from 'ioredis';
import { logger } from './utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const getRedisClient = () => {
  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    client.on('connect', () => {
      logger.info('Successfully connected to Redis');
    });

    client.on('error', (err: unknown) => {
      logger.error('Redis connection error:', err as Error);
    });

    return client;
  } catch (error: unknown) {
    logger.error('Failed to initialize Redis client:', error as Error);
    return null;
  }
};

const redis = getRedisClient();

export default redis;

/**
 * Cache utility for read-through strategy
 */
export async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  if (!redis) return fetchFn();

  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.info(`Cache hit for key: ${key}`);
      return JSON.parse(cached) as T;
    }
  } catch (error: unknown) {
    logger.error(`Error reading from cache for key ${key}:`, error as Error);
  }

  const data = await fetchFn();

  try {
    if (data) {
      await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
      logger.info(`Cache miss. Data stored in cache for key: ${key}`);
    }
  } catch (error: unknown) {
    logger.error(`Error writing to cache for key ${key}:`, error as Error);
  }

  return data;
}

/**
 * Cache invalidation utility
 */
export async function invalidateCache(key: string | string[]): Promise<void> {
  if (!redis) return;

  try {
    if (Array.isArray(key)) {
      if (key.length > 0) {
        await redis.del(...key);
        logger.info(`Cache invalidated for keys: ${key.join(', ')}`);
      }
    } else {
      await redis.del(key);
      logger.info(`Cache invalidated for key: ${key}`);
    }
  } catch (error: unknown) {
    logger.error(`Error invalidating cache for key(s) ${key}:`, error as Error);
  }
}

/**
 * Cache pattern for write-through strategy
 */
export async function setCachedData<T>(
    key: string,
    data: T,
    ttlSeconds = 3600
): Promise<void> {
    if (!redis) return;

    try {
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
        logger.info(`Data written to cache for key: ${key}`);
    } catch (error: unknown) {
        logger.error(`Error writing to cache for key ${key}:`, error as Error);
    }
}
