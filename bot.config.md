# bot.config.json

This file controls the default mode for local development and the CLI.

Example JSON (bot.config.json):

```
{
  "mode": "hf"   // hf = Hugging Face (default). Change to "openai" ONLY if you want.
}
```

Notes:
- Valid values: `hf` or `openai`.
- The CLI (`cli/chat-cli.js`) and server will read `bot.config.json` at startup.
- Environment variables override the config: `OPENAI_API_KEY` must be set to enable OpenAI mode when `mode` is `openai`.
- Keep this file in source control for easy switching during deployment.
