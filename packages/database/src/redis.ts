import Redis from "ioredis";

/**
 * Redis client singleton for AgriMarket. Used by the OTP service (and later
 * by BullMQ jobs / sessions). REDIS_URL must be set in the consuming app's env.
 *
 * Per the redis-core skill: colon-separated keys, e.g. `otp:{phone}`.
 */
function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set in the environment.");
  }
  return new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
  });
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis: Redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
