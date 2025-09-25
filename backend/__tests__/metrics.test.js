const request = require('supertest');
const app = require('../index');

describe('metrics endpoint and OpenAI circuit metrics', () => {
  beforeEach(() => {
    // reset global cb state if present
    if (global.__openai_cb) {
      global.__openai_cb.failures = [];
      global.__openai_cb.openUntil = 0;
      global.__openai_cb.openedCount = 0;
    }
    // clear any metrics registry to avoid collisions between tests
    try {
      const promClient = require('prom-client');
      promClient.register.clear();
      global.__openai_metrics = undefined;
    } catch (e) {
      // prom-client not installed in some environments
    }
  });

  test('GET /metrics returns JSON when prom-client disabled or collection fails', async () => {
    const res = await request(app).get('/metrics').set('Accept', 'application/json');
    expect(res.status).toBe(200);
    // should return JSON with uptime and requests when not using prom-client text format
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('requests');
  });

  test('Prometheus metrics include openai_cb_* when prom-client available', async () => {
    let promClient;
    try {
      promClient = require('prom-client');
    } catch (e) {
      // skip this test if prom-client not installed in this environment
      return;
    }

    // ensure default metrics collected
    promClient.register.clear();

    // simulate a failure to populate cb
    if (!global.__openai_cb) global.__openai_cb = { failures: [], openUntil: 0, openedCount: 0 };
    global.__openai_cb.failures.push(Date.now());

    const res = await request(app).get('/metrics').set('Accept', 'text/plain');
    expect(res.status).toBe(200);
    const text = res.text;
    expect(text).toMatch(/openai_cb_failures/);
    expect(text).toMatch(/openai_cb_open/);
  });
});
