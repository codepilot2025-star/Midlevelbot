// botHuggingFace.js
// Robust Hugging Face Inference API adapter with timeout and retries

const fetch = require('../backend/fetch');

const DEFAULT_MODEL = process.env.HUGGINGFACE_MODEL || 'facebook/blenderbot-400M-distill';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callHfApi(model, message, { timeoutMs = 15000, maxNewTokens } = {}) {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error('HUGGINGFACE_API_KEY not set');

  const url = `https://api-inference.huggingface.co/models/${model}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const body = { inputs: message };
  if (typeof maxNewTokens === 'number') body.parameters = { max_new_tokens: maxNewTokens };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '<no-body>');
      throw new Error(`Hugging Face API error: ${res.status} ${txt}`);
    }

    const data = await res.json().catch(() => null);

    // Parse common response shapes
    if (data == null) return '';
    if (typeof data === 'string') return data;
    if (Array.isArray(data) && data.length > 0) {
      // many models return [{ generated_text: '...' }]
      if (data[0].generated_text) return data[0].generated_text;
      // some return text in 'generated_text' at top-level inside objects
      if (typeof data[0] === 'string') return data.join('\n');
    }
    if (data.generated_text) return data.generated_text;
    if (data.error) throw new Error(`Hugging Face error: ${data.error}`);

    // fallback to stringified json
    return JSON.stringify(data);
  } finally {
    clearTimeout(timeout);
  }
}

async function getHuggingFaceResponse(message, opts = {}) {
  // Local fallback when no API key is present to keep CLI/tests usable
  function localFallback(msg) {
    const m = String(msg || '').toLowerCase();
    if (m.includes('hello') || m.includes('hi')) return 'Hi there! How can I help you today?';
    if (m.includes('book')) return 'Sure! I can help you make a booking. What date do you want?';
    if (m.includes('help')) return 'Tell me what you need help with.';
    if (m.includes('price') || m.includes('cost')) return 'Pricing depends on your requirements. Can you tell me more?';
    return 'I am not sure I understand. Can you please rephrase?';
  }

  // If API key not set, return a fast local fallback instead of throwing
  if (!process.env.HUGGINGFACE_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ HUGGINGFACE_API_KEY not set — returning local fallback response.');
    return Promise.resolve(localFallback(message));
  }

  const model = process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL;
  const attempts = Math.max(1, parseInt(process.env.HUGGINGFACE_RETRIES || '2', 10));
  let attempt = 0;
  let lastErr;
  while (attempt < attempts) {
    try {
      return await callHfApi(model, message, opts);
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt < attempts) {
        const backoff = 200 * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  }
  throw lastErr || new Error('Hugging Face adapter failed');
}

module.exports = { getHuggingFaceResponse };
