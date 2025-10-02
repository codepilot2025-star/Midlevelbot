// Centralized sync response generator (used by both sync and async exports)
const logger = require('./logger');
// Make adapters optional so the bot is resilient when provider modules are absent in test/dev
let getCopilotResponse;
try {
  ({ getCopilotResponse } = require('../nlp/botCopilot'));
} catch (e) {
  getCopilotResponse = null;
}
let getClaudeResponse;
try {
  ({ getClaudeResponse } = require('../nlp/botClaude'));
} catch (e) {
  getClaudeResponse = null;
}
let getHuggingFaceResponse;
try {
  ({ getHuggingFaceResponse } = require('../nlp/botHuggingFace'));
} catch (e) {
  getHuggingFaceResponse = null;
}
let getOpenAIResponse;
try {
  ({ getOpenAIResponse } = require('../nlp/botOpenAI'));
} catch (e) {
  getOpenAIResponse = null;
}

// Small in-memory cache for computeResponse to avoid repeated CPU work for identical short-lived queries
const CACHE_TTL_MS = parseInt(process.env.BOT_RESPONSE_CACHE_TTL_MS || '30000', 10); // 30s default
const responseCache = new Map();
function getCachedResponse(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}
function setCachedResponse(key, value) {
  try {
    responseCache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
  } catch (e) {
    // ignore cache set failures
  }
}

// Adapter call timeout wrapper to avoid hanging on slow network providers
const ADAPTER_TIMEOUT_MS = parseInt(process.env.ADAPTER_TIMEOUT_MS || '5000', 10);
function callWithTimeout(fn) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error('adapter timeout'));
    }, ADAPTER_TIMEOUT_MS);
    Promise.resolve()
      .then(() => fn())
      .then((r) => {
        if (!settled) {
          clearTimeout(timer);
          resolve(r);
        }
      })
      .catch((err) => {
        if (!settled) {
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

// Circuit store abstraction (redis-backed when REDIS_URL set)
let circuitStore;
try {
  circuitStore = require('./circuit');
} catch (e) {
  circuitStore = null; // fallback handled later
}

// Optional Prometheus metrics (lazy require)
let promClient;
try {
  promClient = require('prom-client');
} catch (e) {
  promClient = null;
}

// Helper to ensure metrics exist
function ensureMetrics() {
  if (!promClient) return null;
  // create metrics only once on the global registry
  if (!global.__openai_metrics) {
    global.__openai_metrics = {
      cbOpen: new promClient.Gauge({ name: 'openai_cb_open', help: '1 if OpenAI circuit is open, 0 otherwise' }),
      cbFailures: new promClient.Gauge({ name: 'openai_cb_failures', help: 'Number of failures in window' }),
      cbOpenedCount: new promClient.Gauge({ name: 'openai_cb_opened_count', help: 'Number of times circuit opened' }),
      cbLastOpened: new promClient.Gauge({ name: 'openai_cb_last_opened_ts', help: 'Last time circuit opened (unix seconds)' }),
      // model-level metrics: include adapter and model labels
      adapterLatency: new promClient.Histogram({ name: 'nlp_adapter_latency_seconds', help: 'Latency of NLP adapter calls in seconds', labelNames: ['adapter', 'model'] }),
      adapterErrors: new promClient.Counter({ name: 'nlp_adapter_errors_total', help: 'Total errors from NLP adapters', labelNames: ['adapter', 'model'] }),
    };
  }
  return global.__openai_metrics;
}

// Expose a helper to initialize metrics at startup
exports.initMetrics = function initMetrics() {
  const metrics = ensureMetrics();
  if (!metrics) return null;
  // initialize to zeros if not present
  try {
    metrics.cbOpen.set(0);
    metrics.cbFailures.set(0);
    metrics.cbOpenedCount.set(0);
    metrics.cbLastOpened.set(0);
  } catch (e) {
    // ignore
  }
  return metrics;
};

function computeResponse(message) {
  const msg = String(message || '').toLowerCase();

  if (msg.includes('hello') || msg.includes('hi')) {
    return 'Hi there! How can I help you today?';
  }
  if (msg.includes('book')) {
    return 'Sure! I can help you make a booking. What date do you want?';
  }
  if (msg.includes('help')) {
    return 'Tell me what you need help with.';
  }
  if (msg.includes('price') || msg.includes('cost')) {
    return 'Pricing depends on your requirements. Can you tell me more?';
  }

  // Default fallback
  return 'I am not sure I understand. Can you please rephrase?';
}

// Synchronous interface (keeps backward compatibility)
exports.getResponse = (message) => computeResponse(message);

// Async interface for routes that call external services or await responses
exports.getBotResponse = async (message) => {
  const msg = String(message || '').toLowerCase();

  try {
    // If the user asks to book something or requests a calculation, prefer Copilot
    if (msg.includes('book') || msg.includes('calculate')) {
      // instrument Copilot
      const metrics = ensureMetrics();
      let stop;
      try {
        const modelLabel = process.env.COPILOT_MODEL || 'default';
        if (metrics && metrics.adapterLatency) stop = metrics.adapterLatency.startTimer({ adapter: 'copilot', model: modelLabel });
        if (!getCopilotResponse) throw new Error('copilot adapter not available');
        const r = await callWithTimeout(() => getCopilotResponse(message));
        if (stop) stop();
        return r;
      } catch (err) {
        if (stop) stop();
        const modelLabel = process.env.COPILOT_MODEL || 'default';
        if (metrics && metrics.adapterErrors) metrics.adapterErrors.inc({ adapter: 'copilot', model: modelLabel });
        throw err;
      }
    }

    // Prefer OpenAI if enabled
    if (String(process.env.USE_OPENAI || '').toLowerCase() === 'true' && typeof getOpenAIResponse === 'function') {
      // Circuit-breaker parameters (in-memory)
      const CB_THRESHOLD = parseInt(process.env.OPENAI_CB_THRESHOLD || '5', 10);
      const CB_WINDOW_MS = parseInt(process.env.OPENAI_CB_WINDOW_MS || '60000', 10);
      const CB_COOLDOWN_MS = parseInt(process.env.OPENAI_CB_COOLDOWN_MS || '60000', 10);

      // initialize cb state on first use (in-memory fallback)
      if (!global.__openai_cb) {
        global.__openai_cb = { failures: [], openUntil: 0, openedCount: 0 };
      }
      const cb = global.__openai_cb;

      // If we have a redis-backed circuit store, consult it to see if the circuit is open
      if (circuitStore) {
        try {
          const open = await circuitStore.isOpen();
          if (open) {
            logger.warn('OpenAI circuit is open (store), falling back to computeResponse');
            return computeResponse(message);
          }
        } catch (e) {
          // ignore and use in-memory fallback
        }
      }

      // ensure metrics reflect current cb state
      const metrics = ensureMetrics();
      if (metrics) {
        const isOpen = Date.now() < (cb.openUntil || 0) ? 1 : 0;
        metrics.cbOpen.set(isOpen);
        metrics.cbFailures.set(cb.failures.length || 0);
        metrics.cbOpenedCount.set(cb.openedCount || 0);
        metrics.cbLastOpened.set(cb.openedCount ? Math.floor((cb.openUntil - (parseInt(process.env.OPENAI_CB_COOLDOWN_MS || '60000', 10))) / 1000) : 0);
      }

      // If circuit is open, short-circuit to fallback
      if (Date.now() < (cb.openUntil || 0)) {
        logger.warn('OpenAI circuit is open; falling back to computeResponse');
        return computeResponse(message);
      }

      // Attempt OpenAI call and update circuit state on failure
      try {
        // instrument OpenAI adapter
        const metricsAi = ensureMetrics();
        let stopAi;
        try {
          const modelLabel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
          if (metricsAi && metricsAi.adapterLatency) stopAi = metricsAi.adapterLatency.startTimer({ adapter: 'openai', model: modelLabel });
          if (!getOpenAIResponse) throw new Error('openai adapter not available');
          const resp = await callWithTimeout(() => getOpenAIResponse(message));
          if (stopAi) stopAi();
          // on success prune old failures
          const now = Date.now();
          cb.failures = cb.failures.filter((t) => now - t <= CB_WINDOW_MS);
          return resp;
        } catch (err) {
          if (stopAi) stopAi();
          const modelLabel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
          if (metricsAi && metricsAi.adapterErrors) metricsAi.adapterErrors.inc({ adapter: 'openai', model: modelLabel });
          throw err;
        }
      } catch (err) {
        // record failure
        const now = Date.now();
        // If we have a redis-backed store, let it handle failures and opens
        if (circuitStore) {
          try {
            await circuitStore.recordFailure(now, CB_WINDOW_MS, CB_THRESHOLD, CB_COOLDOWN_MS);
          } catch (e) {
            // fall back to in-memory update
            cb.failures.push(now);
            cb.failures = cb.failures.filter((t) => now - t <= CB_WINDOW_MS);
            if (cb.failures.length >= CB_THRESHOLD) {
              cb.openUntil = Date.now() + CB_COOLDOWN_MS;
              cb.openedCount = (cb.openedCount || 0) + 1;
              logger.warn('OpenAI circuit opened (in-memory fallback)', { openedCount: cb.openedCount });
            }
          }
        } else {
          cb.failures.push(now);
          // prune
          cb.failures = cb.failures.filter((t) => now - t <= CB_WINDOW_MS);
          if (cb.failures.length >= CB_THRESHOLD) {
            cb.openUntil = Date.now() + CB_COOLDOWN_MS;
            cb.openedCount = (cb.openedCount || 0) + 1;
            logger.warn('OpenAI circuit opened', { openedCount: cb.openedCount });
          }
        }

        // update metrics
        const metrics3 = ensureMetrics();
        if (metrics3) {
          try {
            if (circuitStore) {
              const state = await (circuitStore.getState ? circuitStore.getState() : {});
              metrics3.cbFailures.set(state.failures?.length || 0);
              metrics3.cbOpenedCount.set(state.openedCount || 0);
              metrics3.cbOpen.set(Date.now() < (state.openUntil || 0) ? 1 : 0);
              metrics3.cbLastOpened.set(state.openedCount ? Math.floor((state.openUntil - CB_COOLDOWN_MS) / 1000) : 0);
            } else {
              metrics3.cbFailures.set(cb.failures.length || 0);
              metrics3.cbOpenedCount.set(cb.openedCount || 0);
              metrics3.cbOpen.set(Date.now() < (cb.openUntil || 0) ? 1 : 0);
              metrics3.cbLastOpened.set(cb.openedCount ? Math.floor((cb.openUntil - CB_COOLDOWN_MS) / 1000) : 0);
            }
          } catch (e) {
            // ignore metric update errors
          }
        }
        logger.error({ err, message }, 'OpenAI adapter error, falling back');
        return computeResponse(message);
      }
    }

    // If configured to use Hugging Face, prefer that (feature flag)
    if (String(process.env.USE_HUGGINGFACE || '').toLowerCase() === 'true' && typeof getHuggingFaceResponse === 'function') {
      // instrument Hugging Face
      const metricsHf = ensureMetrics();
      let stopHf;
      try {
        const modelLabel = process.env.HUGGINGFACE_MODEL || 'facebook/blenderbot-400M-distill';
        if (metricsHf && metricsHf.adapterLatency) stopHf = metricsHf.adapterLatency.startTimer({ adapter: 'huggingface', model: modelLabel });
        if (!getHuggingFaceResponse) throw new Error('huggingface adapter not available');
        const r = await callWithTimeout(() => getHuggingFaceResponse(message));
        if (stopHf) stopHf();
        return r;
      } catch (err) {
        if (stopHf) stopHf();
        const modelLabel = process.env.HUGGINGFACE_MODEL || 'facebook/blenderbot-400M-distill';
        if (metricsHf && metricsHf.adapterErrors) metricsHf.adapterErrors.inc({ adapter: 'huggingface', model: modelLabel });
        throw err;
      }
    }

    // Otherwise use Claude for conversational responses (instrumented)
    // Use cached computeResponse as a fast and reliable fallback for short messages
    const cacheKey = `compute:${String(message || '')}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;

    const metricsCl = ensureMetrics();
    let stopCl;
    try {
      const modelLabel = process.env.CLAUDE_MODEL || 'default';
      if (metricsCl && metricsCl.adapterLatency) stopCl = metricsCl.adapterLatency.startTimer({ adapter: 'claude', model: modelLabel });
      if (!getClaudeResponse) throw new Error('claude adapter not available');
      const r = await callWithTimeout(() => getClaudeResponse(message));
      if (stopCl) stopCl();
      setCachedResponse(cacheKey, r);
      return r;
    } catch (err) {
      if (stopCl) stopCl();
      const modelLabel = process.env.CLAUDE_MODEL || 'default';
      if (metricsCl && metricsCl.adapterErrors) metricsCl.adapterErrors.inc({ adapter: 'claude', model: modelLabel });
      // fallback to computeResponse and cache result
      const fallback = computeResponse(message);
      setCachedResponse(cacheKey, fallback);
      throw err;
    }
  } catch (err) {
    // Log and fall back to the sync response so the API still returns something
    logger.error({ err, message }, 'Error in getBotResponse, falling back to computeResponse');
    return computeResponse(message);
  }
};