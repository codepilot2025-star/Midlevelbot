This folder contains the backend for the Midlevelbot project.

Quick start (local development)

1. Install dependencies (use legacy peer deps to avoid a known peer conflict between ioredis and ioredis-mock):

```bash
cd backend
npm install --legacy-peer-deps
# or: npm run install:legacy
```

2. Run tests:

```bash
npm test
```

3. Run the dev server:

```bash
npm run dev
# or: PORT=3000 node index.js
```

4. Run the task runner (SAFE mode by default — no external API calls):

```bash
npm run run:tasks
# To enable live remote calls (requires API keys):
LIVE=true HUGGINGFACE_API_KEY=... OPENAI_API_KEY=... npm run run:tasks
# or: node ../scripts/run_tasks.js --live
```

Notes

- The repo uses a lightweight in-memory circuit-breaker for OpenAI calls and optionally a Redis-backed store when `REDIS_URL` is configured.
- The test suite uses `ioredis-mock`. If you prefer not to use `--legacy-peer-deps`, replace the mock with a compatible version.
