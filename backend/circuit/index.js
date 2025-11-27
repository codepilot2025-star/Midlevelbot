// circuit/index.js
// Provides a circuit-breaker store abstraction. Uses Redis when REDIS_URL is set,
// otherwise falls back to an in-memory implementation.

const logger = require('../logger');

let backend = null;
let redisClient = null;
const DEFAULT_PREFIX = 'midlevel:openai_cb';

// In-memory fallback using global.__openai_cb so tests can manipulate the global state
const inMemory = {
  _ensure() {
    if (!global.__openai_cb) global.__openai_cb = { failures: [], openUntil: 0, openedCount: 0 };
    return global.__openai_cb;
  },
  async isOpen() {
    const s = this._ensure();
    return Date.now() < (s.openUntil || 0);
  },
  async recordFailure(now, windowMs, threshold, cooldownMs) {
    const s = this._ensure();
    s.failures.push(now);
    s.failures = s.failures.filter((t) => now - t <= windowMs);
    if (s.failures.length >= threshold) {
      s.openUntil = Date.now() + cooldownMs;
      s.openedCount = (s.openedCount || 0) + 1;
      logger.warn('Redisless OpenAI circuit opened (in-memory)', { openedCount: s.openedCount });
    }
    return s;
  },
  async prune(windowMs) {
    const now = Date.now();
    const s = this._ensure();
    s.failures = s.failures.filter((t) => now - t <= windowMs);
    return s.failures.length;
  },
  async getState() {
    const s = this._ensure();
    return s;
  },
};

// Redis-backed implementation using sorted sets for failures and simple keys for metadata
const createRedisBackend = (client, prefix = DEFAULT_PREFIX) => ({
  async isOpen() {
    const openUntil = await client.get(`${prefix}:openUntil`);
    return Date.now() < (parseInt(openUntil || '0', 10) || 0);
  },
  async recordFailure(now, windowMs, threshold, cooldownMs) {
    const score = now;
    await client.zadd(`${prefix}:failures`, score, String(now));
    // prune
    await client.zremrangebyscore(`${prefix}:failures`, 0, now - windowMs);
    const count = await client.zcard(`${prefix}:failures`);
    if (count >= threshold) {
      const openUntil = Date.now() + cooldownMs;
      await client.set(`${prefix}:openUntil`, String(openUntil));
      await client.incr(`${prefix}:openedCount`);
      logger.warn('OpenAI circuit opened (redis)', {
        openedCount: await client.get(`${prefix}:openedCount`),
      });
    }
    return { failures: count };
  },
  async prune(windowMs) {
    const now = Date.now();
    await client.zremrangebyscore(`${prefix}:failures`, 0, now - windowMs);
    const count = await client.zcard(`${prefix}:failures`);
    return count;
  },
  async getState() {
    const now = Date.now();
    await client.zremrangebyscore(`${prefix}:failures`, 0, now - 1000 * 60 * 60 * 24); // keep recent
    const failures = await client.zcard(`${prefix}:failures`);
    const openUntil = parseInt((await client.get(`${prefix}:openUntil`)) || '0', 10) || 0;
    const openedCount = parseInt((await client.get(`${prefix}:openedCount`)) || '0', 10) || 0;
    return { failures: Array(failures).fill(0), openUntil, openedCount };
  },
});

function init() {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const IORedis = require('ioredis');
      redisClient = new IORedis(url);
      backend = createRedisBackend(redisClient, process.env.REDIS_CB_PREFIX || DEFAULT_PREFIX);
      logger.info('Using Redis-backed circuit store');
    } catch (e) {
      logger.warn('Failed to initialize Redis client, falling back to in-memory circuit', {
        err: e.message,
      });
      backend = inMemory;
    }
  } else {
    backend = inMemory;
  }
}

init();

module.exports = {
  isOpen: async (opts = {}) => backend.isOpen(opts),
  recordFailure: async (now, windowMs, threshold, cooldownMs) =>
    backend.recordFailure(now, windowMs, threshold, cooldownMs),
  prune: async (windowMs) => backend.prune(windowMs),
  getState: async () => backend.getState(),
  _redisClient: () => redisClient,
};
