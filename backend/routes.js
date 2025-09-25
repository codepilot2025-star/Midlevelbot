const express = require('express');
const { body, validationResult } = require('express-validator');
const bot = require('./botLogic');
const { getCopilotResponse } = require('../nlp/botCopilot');
const { getClaudeResponse } = require('../nlp/botClaude');
const logger = require('./logger');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

const messageValidators = [
  body('message')
    .exists().withMessage('message is required')
    .bail()
    .isString().withMessage('message must be a string')
    .bail()
    .trim()
    .notEmpty().withMessage('message cannot be empty')
    .isLength({ max: 2000 }).withMessage('message is too long'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

// legacy sync endpoint (validated)
router.post('/message', messageValidators, handleValidation, (req, res) => {
  const { message } = req.body || {};
  try {
    const reply = bot.getResponse(message);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// async endpoint for future NLP/LLM integrations (validated)
router.post('/chat', messageValidators, handleValidation, async (req, res) => {
  const { message } = req.body || {};
  try {
    const reply = await bot.getBotResponse(message);
    res.json({ reply });
  } catch (err) {
    logger.error({ err, message }, 'Chat handler error');
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

module.exports = router;
