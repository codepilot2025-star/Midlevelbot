const express = require('express');
const dotenv = require('dotenv');
const envalid = require('envalid');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const routes = require('./routes');
const docs = require('./docs');
const botLogic = require('./botLogic');

dotenv.config();

// Validate environment variables at startup. This only runs once and does not affect runtime performance.
const { str, num } = envalid;
envalid.cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  RATE_LIMIT_WINDOW_MS: num({ default: 900000 }),
  RATE_LIMIT_MAX: num({ default: 100 }),
  NODE_ENV: str({ default: 'development' }),
  HUGGINGFACE_API_KEY: str({ default: '' }),
  OPENAI_API_KEY: str({ default: '' }),
  USE_OPENAI: str({ default: '' }),
});

const app = express();

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// simple request counter for basic metrics
let requestCount = 0;
app.use((req, res, next) => {
  requestCount += 1;
  next();
});

// Serve frontend static files (optional)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rate limiter (configurable via env)
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10); // max requests per window

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests, please try again later.' }),
});

// API routes mounted at /api with rate limiting
app.use('/api', apiLimiter, routes);

// Mount API docs (Swagger UI)
docs(app);

// basic /metrics endpoint
// prom-client for Prometheus-style metrics (optional)
let promClient;
try {
  promClient = require('prom-client');
} catch (e) {
  promClient = null;
}

// initialize in-process metrics if available
try {
  if (promClient && botLogic && typeof botLogic.initMetrics === 'function') {
    botLogic.initMetrics();
  }
} catch (e) {
  // ignore
}

app.get('/metrics', async (req, res) => {
  // If prom-client installed and OPENAI_CB_METRICS enabled, return Prometheus text format
  const useProm = promClient && String(process.env.OPENAI_CB_METRICS || 'true').toLowerCase() === 'true';
  // If the client explicitly asks for JSON, return the simple JSON metrics for compatibility/testing
  const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
  if (useProm) {
    try {
      const registry = promClient.register;
      // ensure our app-specific metrics are (re)initialized before collection
      try {
        if (botLogic && typeof botLogic.initMetrics === 'function') botLogic.initMetrics();
      } catch (e) {
        // ignore
      }
      // ensure we include basic process and node metrics
      promClient.collectDefaultMetrics({ register: registry });
      if (wantsJson) {
        // return backward-compatible JSON
        return res.json({ uptime: process.uptime(), requests: requestCount });
      }
      const metrics = await registry.metrics();
      res.set('Content-Type', registry.contentType);
      return res.send(metrics);
    } catch (err) {
      logger.error({ err }, 'Failed to collect Prometheus metrics');
      // fallthrough to JSON
    }
  }

  // Backwards-compatible simple JSON metrics
  res.json({ uptime: process.uptime(), requests: requestCount });
});

// Health and readiness endpoints
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/ready', async (req, res) => {
  // If Redis is configured, check connectivity via the circuit store's redis client
  try {
    const circuit = require('./circuit');
    const client = circuit && typeof circuit._redisClient === 'function' ? circuit._redisClient() : null;
    if (client) {
      // ioredis exposes a 'ping' method
      try {
        const pong = await client.ping();
        if (pong === 'PONG' || pong === 'pong') return res.json({ ready: true, redis: pong });
        return res.status(503).json({ ready: false, redis: pong });
      } catch (e) {
        return res.status(503).json({ ready: false, error: e.message });
      }
    }
    return res.json({ ready: true, redis: 'not-configured' });
  } catch (e) {
    return res.status(500).json({ ready: false, error: e.message });
  }
});

// 404 for unknown API routes
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    logger.info(`Mid-level SME Bot running on http://localhost:${PORT}`);
  });

  // graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    server.close(() => {
      logger.info('Closed server');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forcing shutdown');
      process.exit(1);
    }, 10000);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
