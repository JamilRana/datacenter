import Redis from 'ioredis';
import { logger } from './utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const enableRedis = process.env.ENABLE_REDIS !== 'false';

let isRedisConnected = false;

const getRedisClient = () => {
  if (!enableRedis) {
    logger.info('Redis is explicitly disabled via ENABLE_REDIS environment variable');
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1, // fail fast
      enableOfflineQueue: false, // do not queue when offline
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis reconnection attempts exceeded. Cache is in fallback mode.');
          return null; // stop retrying
        }
        return Math.min(times * 1000, 3000);
      },
    });

    client.on('connect', () => {
      isRedisConnected = true;
      logger.info('Successfully connected to Redis');
    });

    client.on('close', () => {
      isRedisConnected = false;
    });

    client.on('error', (err: any) => {
      isRedisConnected = false;
      // Log connection warnings concisely to prevent stack trace spam
      logger.warn(`Redis client offline: ${err.message || err}`);
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
  if (!redis || !isRedisConnected) return fetchFn();

  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.info(`Cache hit for key: ${key}`);
      return JSON.parse(cached) as T;
    }
  } catch (error: any) {
    logger.warn(`Redis cache read failed for key ${key}: ${error.message || error}`);
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
  if (!redis || !isRedisConnected) return;

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
  } catch (error: any) {
    logger.warn(`Redis cache invalidate failed for key(s) ${key}: ${error.message || error}`);
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
    if (!redis || !isRedisConnected) return;

    try {
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
        logger.info(`Data written to cache for key: ${key}`);
    } catch (error: any) {
        logger.warn(`Redis cache write failed for key ${key}: ${error.message || error}`);
    }
}
