import { logger } from './utils/logger';

export interface RateLimitResponse {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_MAP_SIZE = 10000;

/**
 * Sliding window rate limiter in memory (Edge-compatible)
 * @param identifier Unique identifier for the client (IP, User ID, etc.)
 * @param limit Maximum number of requests in the window
 * @param windowMs Window size in milliseconds
 */
export async function rateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60000
): Promise<RateLimitResponse> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Lazy global prune if map gets too large to prevent memory leaks
  if (rateLimitMap.size > MAX_MAP_SIZE) {
    rateLimitMap.forEach((value, key) => {
      const valid = value.timestamps.filter((t) => t > windowStart);
      if (valid.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, { timestamps: valid });
      }
    });
  }

  try {
    const entry = rateLimitMap.get(identifier) || { timestamps: [] };
    
    // Filter out timestamps older than the window
    const currentTimestamps = entry.timestamps.filter((t) => t > windowStart);
    const count = currentTimestamps.length;
    
    const success = count < limit;
    if (success) {
      currentTimestamps.push(now);
      rateLimitMap.set(identifier, { timestamps: currentTimestamps });
    }

    const remaining = Math.max(0, limit - (count + (success ? 0 : 0)));
    const reset = now + windowMs;

    return {
      success,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    logger.error(`Rate limit error for ${identifier}:`, error as Error);
    // Fail open to avoid blocking users
    return { success: true, limit, remaining: limit, reset: now + windowMs };
  }
}

/**
 * Rate limiting for sensitive actions (login, password reset, etc.)
 */
export async function rateLimitSensitive(identifier: string) {
  return rateLimit(`sensitive:${identifier}`, 5, 60000); // 5 requests per minute
}

/**
 * Rate limiting for general API routes
 */
export async function rateLimitApi(identifier: string) {
  return rateLimit(`api:${identifier}`, 100, 60000); // 100 requests per minute
}
