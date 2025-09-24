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

dotenv.config();

// Validate environment variables at startup. This only runs once and does not affect runtime performance.
const { str, num } = envalid;
envalid.cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  RATE_LIMIT_WINDOW_MS: num({ default: 900000 }),
  RATE_LIMIT_MAX: num({ default: 100 }),
  NODE_ENV: str({ default: 'development' }),
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

// basic /metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({ uptime: process.uptime(), requests: requestCount });
});

// 404 for unknown API routes
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler
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
