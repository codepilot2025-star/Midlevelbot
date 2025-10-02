const readline = require('readline');
const { getHFResponse } = require('./huggingface');
const { handleClaudeMessage } = require('./botLogic');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const mode = process.argv[2] || 'hf'; // 'hf' or 'claude'

// Keep conversation history per bot
let hfHistory = [];
let claudeHistory = [];

function ask() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    let reply;

    if (mode === 'hf') {
      reply = await getHFResponse(input, hfHistory);
      hfHistory.push({ role: 'user', content: input });
      hfHistory.push({ role: 'assistant', content: reply });
    } else {
      reply = await handleClaudeMessage(input);
    }

    console.log(`Bot: ${reply}\n`);
    ask();
  });
}

ask();