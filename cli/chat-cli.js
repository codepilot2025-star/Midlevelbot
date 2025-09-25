#!/usr/bin/env node

const readline = require('readline');
require('dotenv').config();

const { handleClaudeMessage } = require('../backend/botLogic'); // Ensure path is correct
const { getHFResponse } = require('../backend/huggingFace');    // Hugging Face adapter

// Mode: 'hf' for Hugging Face testing, 'claude' for deployment or Claude bot
const mode = process.argv[2] || 'hf';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`\nStarting Chat CLI in mode: ${mode}\n(Type 'exit' to quit)\n`);

async function ask() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log('Exiting chat...');
      rl.close();
      return;
    }

    let reply;
    try {
      if (mode === 'hf') {
        reply = await getHFResponse(input);
      } else if (mode === 'claude') {
        reply = await handleClaudeMessage(input);
      } else {
        reply = "Unknown mode. Use 'hf' or 'claude'.";
      }
    } catch (err) {
      console.error('Error getting bot response:', err.message);
      reply = "Oops! Something went wrong with the bot.";
    }

    console.log(`Bot: ${reply}\n`);
    ask();
  });
}

ask();