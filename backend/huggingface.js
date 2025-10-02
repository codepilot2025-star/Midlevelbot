


require('dotenv').config();
const fetch = require('./fetch');

async function getHFResponse(userMessage) {
    const messages = [
        {
            role: "system",
            content: "You are a helpful assistant. Do not repeat the user's message. Always respond naturally."
        },
        {
            role: "user",
            content: userMessage
        }
    ];

    const response = await fetch('https://api-inference.huggingface.co/models/claude', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages })
    });

    const data = await response.json();
    return data[0]?.content || "No response from Claude";
}

module.exports = { getHFResponse };