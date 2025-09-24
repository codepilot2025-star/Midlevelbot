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

Files

- `backend/` - Express backend
- `frontend/` - static chat widget
- `nlp/` - placeholder NLP adapter

Next steps

- Wire a real NLP provider in `nlp/nlp.js`.
- Add rate limiting and authentication for production.
