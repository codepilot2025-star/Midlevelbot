const bot = require('../botLogic');

describe('botLogic exports', () => {
    test('exports getResponse and getBotResponse and initMetrics', () => {
        expect(bot).toBeDefined();
        expect(typeof bot.getResponse).toBe('function');
        expect(typeof bot.getBotResponse).toBe('function');
        // initMetrics is optional but if present should be a function
        if (bot.initMetrics) expect(typeof bot.initMetrics).toBe('function');
    });
});
