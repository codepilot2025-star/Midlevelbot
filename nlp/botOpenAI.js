// botOpenAI.js
// OpenAI adapter: prefer official SDK when available, fallback to fetch-based implementation

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
let hasSdk = false;
let OpenAI;
try {
  OpenAI = require('openai');
  hasSdk = true;
} catch (e) {
  hasSdk = false;
}

const fetch = require('../backend/fetch');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOpenAIResponseWithSdk(message, options = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const configuration = new OpenAI.Configuration({ apiKey: key });
  const client = new OpenAI.OpenAIApi(configuration);

  const maxAttempts = options.retries || 2;
  let attempt = 0;
  let lastErr;

  while (attempt <= maxAttempts) {
    try {
      const resp = await client.createChatCompletion({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: [{ role: 'user', content: message }],
        max_tokens: options.max_tokens || 256,
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
      });

      if (resp && resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
        return resp.data.choices[0].message.content.trim();
      }
      return JSON.stringify(resp.data || resp);
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt > maxAttempts) break;
      const backoff = 250 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }
  throw lastErr || new Error('OpenAI SDK adapter failed');
}

async function getOpenAIResponseWithFetch(message, options = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    messages: [{ role: 'user', content: message }],
    max_tokens: options.max_tokens || 256,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
  };

  const maxAttempts = options.retries || 2;
  let attempt = 0;
  let lastErr;

  while (attempt <= maxAttempts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${txt}`);
      }

      const data = await res.json();
      if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        return data.choices[0].message.content.trim();
      }
      return JSON.stringify(data);
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt > maxAttempts) break;
      const backoff = 250 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }

  throw lastErr || new Error('OpenAI adapter failed');
}

async function getOpenAIResponse(message, options = {}) {
  if (hasSdk) return getOpenAIResponseWithSdk(message, options);
  return getOpenAIResponseWithFetch(message, options);
}

module.exports = { getOpenAIResponse };
