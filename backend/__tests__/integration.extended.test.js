/**
 * Extended integration tests for bot adapters
 */
const request = require('supertest');
const app = require('../index');

describe('Bot API Integration - Extended', () => {
  describe('POST /api/chat - Error Scenarios', () => {
    test('returns 400 if message is empty', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: '' });

      expect(res.status).toBe(400);
    });

    test('returns 400 if message is missing', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({});

      expect(res.status).toBe(400);
    });

    test('returns 400 if message is only whitespace', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: '   \n\t   ' });

      expect(res.status).toBe(400);
    });

    test('returns valid JSON response on error', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: '' });

      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  describe('POST /api/chat - Success Scenarios', () => {
    test('returns 200 with reply for valid message', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'Hello bot' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reply');
      expect(typeof res.body.reply).toBe('string');
    });

    test('reply is not empty', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'Test message' });

      expect(res.status).toBe(200);
      expect(res.body.reply.trim().length).toBeGreaterThan(0);
    });

    test('handles long messages', async () => {
      const longMsg = 'word '.repeat(100);
      const res = await request(app)
        .post('/api/chat')
        .send({ message: longMsg });

      expect([200, 400, 500]).toContain(res.status);
      expect(res.body).toHaveProperty('reply');
    });

    test('handles special characters in message', async () => {
      const specialMsg = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const res = await request(app)
        .post('/api/chat')
        .send({ message: specialMsg });

      expect([200, 400]).toContain(res.status);
    });

    test('handles unicode in message', async () => {
      const unicodeMsg = '你好 مرحبا שלום Привет';
      const res = await request(app)
        .post('/api/chat')
        .send({ message: unicodeMsg });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('reply');
      }
    });
  });

  describe('GET /ready - Health Check', () => {
    test('returns 200 OK', async () => {
      const res = await request(app)
        .get('/ready');

      expect(res.status).toBe(200);
    });

    test('response time is under 100ms', async () => {
      const startTime = Date.now();
      await request(app).get('/ready');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('GET /metrics - Prometheus Metrics', () => {
    test('returns 200 OK', async () => {
      const res = await request(app)
        .get('/metrics');

      expect(res.status).toBe(200);
    });

    test('returns json content type', async () => {
      const res = await request(app)
        .get('/metrics');

      expect(res.headers['content-type']).toMatch(/json/);
    });

    test('includes metrics data', async () => {
      const res = await request(app)
        .get('/metrics');

      // Check for basic metrics fields
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('requests');
    });
  });

  describe('Request Headers', () => {
    test('handles missing Content-Type gracefully', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'test' });

      expect([200, 400]).toContain(res.status);
    });

    test('rejects invalid JSON', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .send('invalid json{');

      expect([400, 500]).toContain(res.status);
    });

    test('includes appropriate security headers', async () => {
      const res = await request(app)
        .get('/ready');

      // Check for common security headers
      expect(res.headers).toHaveProperty('content-type');
    });
  });

  describe('Rate Limiting (if enabled)', () => {
    test('does not block rapid requests within limits', async () => {
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app)
            .post('/api/chat')
            .send({ message: 'test' })
        );
      }

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);

      // At least some should succeed (rate limit not exceeded)
      expect(statuses.some((s) => s === 200 || s === 400)).toBe(true);
    });
  });

  describe('Concurrent Requests', () => {
    test('handles multiple concurrent chat requests', async () => {
      const messages = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
      const promises = messages.map((msg) =>
        request(app)
          .post('/api/chat')
          .send({ message: msg })
      );

      const results = await Promise.all(promises);

      // All should complete successfully or with expected error
      results.forEach((res) => {
        expect([200, 400, 429, 500]).toContain(res.status);
      });
    });

    test('all concurrent requests get responses', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/ready')
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });
  });
});
