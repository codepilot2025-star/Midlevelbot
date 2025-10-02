
describe('Hugging Face routing', () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...origEnv };
    jest.resetModules();
  });

  test('routes to hugging face when USE_HUGGINGFACE=true', async () => {
    process.env.USE_HUGGINGFACE = 'true';

    // mock the adapter before requiring the bot module
    jest.doMock('../../nlp/botHuggingFace', () => ({
      getHuggingFaceResponse: async (msg) => `HF:${msg}`,
    }));

    const bot = require('../botLogic');
    const out = await bot.getBotResponse('tell me a story');
    expect(out).toBe('HF:tell me a story');
  });

  test('falls back to claude when flag not set', async () => {
    process.env.USE_HUGGINGFACE = '';
    jest.doMock('../../nlp/botClaude', () => ({
      getClaudeResponse: async (msg) => `Claude:${msg}`,
    }));

    const bot = require('../botLogic');
    const out = await bot.getBotResponse('hello');
    expect(out).toContain('Claude:');
  });
});
