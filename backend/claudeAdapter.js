// backend/claudeAdapter.js

require('dotenv').config();
const fetch = require('./fetch');

// Replace this with the actual Claude API endpoint if different
const CLAUDE_API_URL = process.env.CLAUDE_API_URL;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

async function getClaudeResponse(userMessage, history = []) {
  // Build conversation array including past messages
  const conversation = [...history, { role: 'user', content: userMessage }];

  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLAUDE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation }),
    });

    const data = await res.json();

    const botReply = data.reply || 'Claude did not return a response';

    // Update conversation history
    conversation.push({ role: 'assistant', content: botReply });

    return { response: botReply, history: conversation };
  } catch (err) {
    console.error('Claude adapter error:', err);
    return { response: 'Error connecting to Claude', history: conversation };
  }
}

module.exports = { getClaudeResponse };
