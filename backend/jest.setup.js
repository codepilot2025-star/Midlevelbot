const nock = require('nock');

// Prevent external HTTP requests during tests, allow localhost connections
nock.disableNetConnect();
// Allow connections to localhost (any port) so supertest can hit the server
nock.enableNetConnect(/127\.0\.0\.1|::1|localhost/);

// If you need to allow specific external hosts for adapter integration tests,
// you can enable them explicitly with `nock.enableNetConnect('api.openai.com')`.

// Cleanup after each test
afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

module.exports = {};
