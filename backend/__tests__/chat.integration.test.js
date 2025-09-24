const request = require('supertest');
const app = require('../index');
const bot = require('../botLogic');

describe('POST /api/chat', () => {
  test('returns 200 and reply for valid message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'hello' })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(typeof res.body.reply).toBe('string');
  });

  test('returns 400 for empty message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: '   ' })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 500 when bot throws', async () => {
    // mock bot.getBotResponse to throw
    const orig = bot.getBotResponse;
    bot.getBotResponse = async () => { throw new Error('boom'); };

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'will cause error' })
      .set('Accept', 'application/json');

    // restore
    bot.getBotResponse = orig;

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
