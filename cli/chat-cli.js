#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// dotenv optional
try {
  require('dotenv').config();
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('dotenv not available — ensure env vars are exported if you rely on .env');
}

// Load adapters (adapted to repo structure)
let getHFResponse = null;
let getOpenAIResponse = null;
try {
  ({ getHuggingFaceResponse: getHFResponse } = require(path.join(__dirname, '..', 'nlp', 'botHuggingFace')));
} catch (e) {
  // adapter optional
}
try {
  ({ getOpenAIResponse } = require(path.join(__dirname, '..', 'nlp', 'botOpenAI')));
} catch (e) {
  // adapter optional
}

let mode = 'hf'; // safe default

// Load from bot.config.json (repo root) if available
try {
  const configPath = path.join(__dirname, '..', 'bot.config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.mode) mode = config.mode;
  }
} catch (e) {
  console.warn('⚠️ No bot.config.json found or it could not be parsed. Defaulting to Hugging Face.');
}

// Allow CLI override: `node cli/chat-cli.js openai`
const argMode = process.argv[2];
if (argMode) {
  if (argMode === 'openai' && !process.env.OPENAI_API_KEY) {
    console.warn('⚠️ No OPENAI_API_KEY found. Staying in Hugging Face mode.');
  } else {
    mode = argMode;
  }
}

// Ensure adapter exists for the chosen mode
if (mode === 'openai' && typeof getOpenAIResponse !== 'function') {
  console.warn('⚠️ OpenAI adapter not available. Falling back to Hugging Face.');
  mode = 'hf';
}
if (mode === 'hf' && typeof getHFResponse !== 'function') {
  console.warn('⚠️ Hugging Face adapter not available. Some features may be limited.');
}

console.log(`💬 Running CLI in mode: ${mode.toUpperCase()}`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    let reply;
    try {
      if (mode === 'hf') {
        reply = await getHFResponse(input);
      } else {
        reply = await getOpenAIResponse(input);
      }
    } catch (err) {
      console.error('Error:', err && err.message ? err.message : err);
      reply = '(error)';
    }

    console.log(`Bot: ${reply}\n`);
    ask();
  });
}

ask();
