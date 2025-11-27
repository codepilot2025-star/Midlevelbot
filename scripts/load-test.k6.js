import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },  // Ramp up to 5 users
    { duration: '20s', target: 10 }, // Ramp up to 10 users
    { duration: '10s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95th percentile of requests should be under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate should be less than 10%
  },
};

export default function () {
  // Test health check endpoint
  const healthRes = http.get('http://localhost:3000/ready');
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.duration < 200,
  });

  // Test metrics endpoint
  const metricsRes = http.get('http://localhost:3000/metrics');
  check(metricsRes, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics response time < 300ms': (r) => r.timings.duration < 300,
  });

  // Test chat endpoint with various messages
  const payload = JSON.stringify({
    message: 'What is your name?',
  });

  const chatRes = http.post('http://localhost:3000/api/chat', payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(chatRes, {
    'chat status is 200': (r) => r.status === 200,
    'chat response time < 1000ms': (r) => r.timings.duration < 1000,
    'chat response has reply': (r) => r.body.includes('reply'),
  });

  sleep(1); // Wait 1 second between requests
}
