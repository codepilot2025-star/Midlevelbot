# MidLevelBot

Simple scaffold for a mid-level SME chat bot.

Quick start

1. Install dependencies for backend

```bash
cd backend
npm install
```

2. Copy `.env.example` to `.env` and adjust values.

3. Run in development

```bash
npm run dev
```

4. Open http://localhost:3000 (the frontend files are served statically) and use the chat widget.

Testing

```bash
cd backend
npm test
```

CLI (interactive testing)

You can run a simple interactive CLI to test the Hugging Face or OpenAI adapters.

From the `backend` folder (uses backend/node_modules):

```bash
# Hugging Face mode
npm run cli:hf

# OpenAI mode
npm run cli:openai
```

Or run directly from the backend folder:

```bash
node ../cli/chat-cli.js hf
node ../cli/chat-cli.js openai
```

Files

- `backend/` - Express backend
- `frontend/` - static chat widget
- `nlp/` - placeholder NLP adapter

Next steps

- Wire a real NLP provider in `nlp/nlp.js`.
- Add rate limiting and authentication for production.
