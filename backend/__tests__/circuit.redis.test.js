const path = require('path');

// Force using a fake REDIS_URL so the circuit initializer will try to load ioredis.
// We'll mock ioredis with ioredis-mock before requiring the circuit module.
process.env.REDIS_URL = 'redis://localhost:6379/0';

// Mock ioredis to use the in-memory ioredis-mock implementation and mark it virtual
jest.mock('ioredis', () => require('ioredis-mock'), { virtual: true });

const circuit = require('../circuit');

describe('Redis-backed circuit store (integration with ioredis-mock)', () => {
  const threshold = 3;
  const windowMs = 1000 * 60; // 1 minute
  const cooldownMs = 200; // short for test

  beforeEach(async () => {
    // ensure clean state
    const client = circuit._redisClient();
    if (client && client.flushall) {
      await client.flushall();
    }
  });

  test('records failures and opens circuit when threshold reached', async () => {
    // ensure not open initially
    expect(await circuit.isOpen()).toBe(false);

    const now = Date.now();
    // record threshold failures
    for (let i = 0; i < threshold; i++) {
      await circuit.recordFailure(now + i, windowMs, threshold, cooldownMs);
    }

    const state = await circuit.getState();
    // state.failures should be a number-like array length (see implementation)
    expect(state).toHaveProperty('openUntil');
    expect(state.openedCount).toBeGreaterThanOrEqual(1);

    // circuit should be open
    expect(await circuit.isOpen()).toBe(true);
  });

  test('circuit recovers after cooldown', async () => {
    // open the circuit
    const now = Date.now();
    for (let i = 0; i < threshold; i++) {
      await circuit.recordFailure(now + i, windowMs, threshold, cooldownMs);
    }

    expect(await circuit.isOpen()).toBe(true);

    // wait for cooldown
    await new Promise((r) => setTimeout(r, cooldownMs + 50));

    // should be closed now
    expect(await circuit.isOpen()).toBe(false);
  });
});
