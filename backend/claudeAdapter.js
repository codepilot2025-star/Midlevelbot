require('dotenv').config();
const fetch = require('node-fetch');

async function getClaudeResponse(userMessage, history = []) {
    const API_URL = 'https://api.anthropic.com/v1/complete'; // Claude endpoint
    const API_KEY = process.env.CLAUDE_API_KEY;

    // Build prompt with history for context
    const prompt = history
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n') + `\nuser: ${userMessage}\nassistant:`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: 'claude-v1', // or 'claude-instant-v1' depending on your access
            prompt: prompt,
            max_tokens_to_sample: 500,
            stop_sequences: ['\nuser:']
        })
    });

    const data = await response.json();

    // Return the assistant's text
    return data?.completion || "No response from Claude";
}

module.exports = { getClaudeResponse };