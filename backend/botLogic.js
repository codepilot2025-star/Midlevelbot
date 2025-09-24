// Centralized sync response generator (used by both sync and async exports)
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
  // For now just return the computed response. Replace this with async NLP/LLM calls later.
  return computeResponse(message);
};
