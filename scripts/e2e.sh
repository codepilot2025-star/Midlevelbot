#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting e2e stack with docker-compose..."
docker-compose up -d redis backend

echo "Waiting for backend to be ready (http://localhost:3000/ready)..."
for i in {1..30}; do
  if curl -sSf http://localhost:3000/ready >/dev/null 2>&1; then
    echo "Backend ready"
    break
  fi
  sleep 1
done

echo "Running tests against running stack..."
npm test --silent

echo "Tearing down stack..."
docker-compose down

echo "E2E done"
