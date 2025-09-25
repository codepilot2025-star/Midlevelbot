Staging setup (backend + Redis)

This repo includes a Docker + docker-compose setup to run the backend with a Redis instance for staging.

Requirements
- Docker
- docker-compose

Start staging stack

1. Build and start services:

```bash
docker-compose up --build
```

2. The backend will be available at http://localhost:3000 and Redis at localhost:6379.

3. To run tests inside the backend container (optional):

```bash
docker-compose run --rm backend npm test
```

Notes
- The backend reads `REDIS_URL` and will use Redis-backed circuit storage when set (the compose file sets it to redis://redis:6379/0).
- For local development keep using the existing npm workflows; the compose stack is primarily for staging and smoke tests.
