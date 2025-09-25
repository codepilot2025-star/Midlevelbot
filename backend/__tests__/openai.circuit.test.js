describe('OpenAI circuit breaker', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...origEnv };
    // default small thresholds for faster tests
    process.env.USE_OPENAI = 'true';
    process.env.OPENAI_CB_THRESHOLD = '2';
    process.env.OPENAI_CB_WINDOW_MS = '10000';
    process.env.OPENAI_CB_COOLDOWN_MS = '5000';
    // ensure clean global state
    delete global.__openai_cb;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    delete global.__openai_cb;
  });

  test('opens circuit after threshold failures and short-circuits', async () => {
    // mock adapter to fail
    jest.doMock('../../nlp/botOpenAI', () => ({
      getOpenAIResponse: async () => {
        throw new Error('simulated failure');
      },
    }));

    const bot = require('../botLogic');

    // first failure -> fallback
    const r1 = await bot.getBotResponse('hello');
    expect(typeof r1).toBe('string');

    // second failure -> should open circuit
    const r2 = await bot.getBotResponse('hello again');
    expect(typeof r2).toBe('string');

    // circuit should now be open; next call should short-circuit without calling adapter
    // We check that the response is from computeResponse by matching known fallback
    const r3 = await bot.getBotResponse('unknown stuff');
    expect(r3).toMatch(/not sure I understand/i);
  });

  test('recovers after cooldown', async () => {
    let callCount = 0;
    // first make adapter fail twice, then succeed
    jest.doMock('../../nlp/botOpenAI', () => ({
      getOpenAIResponse: async (msg) => {
        callCount += 1;
        if (callCount <= 2) throw new Error('fail');
        return `OK:${msg}`;
      },
    }));

    const bot = require('../botLogic');

    // cause two failures to open circuit
    await bot.getBotResponse('a');
    await bot.getBotResponse('b');

    // immediate call should be short-circuited
    const short = await bot.getBotResponse('c');
    expect(short).toMatch(/not sure I understand/i);

    // simulate cooldown expiry by adjusting the in-memory circuit state
    if (global.__openai_cb) {
      global.__openai_cb.openUntil = Date.now() - 1;
    }

    // next call should attempt adapter and succeed
    const after = await bot.getBotResponse('hello again');
    expect(after).toBe('OK:hello again');
  });
});
