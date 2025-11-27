#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting e2e stack with docker-compose..."
# Prefer legacy `docker-compose`, fall back to `docker compose` if available
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo "Error: neither 'docker-compose' nor 'docker compose' is available. Install Docker Desktop or docker-compose."
  exit 127
fi

echo "Starting e2e stack with $COMPOSE_CMD..."
$COMPOSE_CMD up -d redis backend

echo "Waiting for backend to be ready (http://localhost:3000/ready)..."
for i in {1..30}; do
  if curl -sSf http://localhost:3000/ready >/dev/null 2>&1; then
    echo "Backend ready"
    break
  fi
  sleep 1
done

echo "Running tests against running stack..."
# Run backend tests from the backend folder so the repo root doesn't need a package.json
cd backend && npm test --silent

echo "Tearing down stack..."
$COMPOSE_CMD down

echo "E2E done"
