describe('OpenAI routing', () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...origEnv };
    jest.resetModules();
  });

  test('routes to OpenAI when USE_OPENAI=true', async () => {
    process.env.USE_OPENAI = 'true';

    jest.doMock('../../nlp/botOpenAI', () => ({
      getOpenAIResponse: async (msg) => `OPENAI:${msg}`,
    }));

    const bot = require('../botLogic');
    const out = await bot.getBotResponse('what is 2+2?');
    expect(out).toBe('OPENAI:what is 2+2?');
  });

  test('falls back to claude when OPENAI not set', async () => {
    process.env.USE_OPENAI = '';
    jest.doMock('../../nlp/botClaude', () => ({
      getClaudeResponse: async (msg) => `Claude:${msg}`,
    }));

    const bot = require('../botLogic');
    const out = await bot.getBotResponse('hello');
    expect(out).toContain('Claude:');
  });
});
