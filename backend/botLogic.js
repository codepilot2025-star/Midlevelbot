const { getClaudeResponse } = require('./claudeAdapter');

async function handleClaudeMessage(userMessage, history = []) {
  // Calls Claude adapter with user message and optional conversation history
  return await getClaudeResponse(userMessage, history);
}

module.exports = { handleClaudeMessage };