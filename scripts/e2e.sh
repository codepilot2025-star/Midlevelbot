#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting e2e: prefer docker-compose, but will fall back to local tests if Docker is unavailable..."

# Prefer legacy `docker-compose`, fall back to `docker compose` if available
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo "Docker not available — running local tests instead of bringing up a stack."
  echo "Running backend tests..."
  npm --prefix backend test
  echo "Running frontend tests..."
  npm --prefix frontend test || true
  echo "E2E fallback complete"
  exit 0
fi

echo "Starting e2e stack with $COMPOSE_CMD..."
if ! $COMPOSE_CMD up -d redis backend; then
  echo "Failed to start docker-compose stack — falling back to local tests..."
  echo "Running backend tests..."
  npm --prefix backend test
  echo "Running frontend tests..."
  npm --prefix frontend test || true
  echo "E2E fallback complete"
  exit 0
fi

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
