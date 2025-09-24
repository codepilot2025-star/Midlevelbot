const bot = require('../botLogic');

test('responds to greetings', () => {
  expect(bot.getResponse('hello')).toMatch(/hi/i);
  expect(bot.getResponse('Hi there')).toMatch(/hi/i);
});

test('responds to help', () => {
  expect(bot.getResponse('I need help')).toMatch(/help/i);
});

test('default fallback', () => {
  const r = bot.getResponse('something random');
  expect(typeof r).toBe('string');
});
