# Deployment & Build Guide for Midlevelbot

## Overview

This guide covers building and deploying the Midlevelbot application in multiple environments: local, staging, and production.

## Prerequisites

- **Node.js 18+** (for local development)
- **Docker & Docker Compose** (for containerized deployments)
- **Redis** (backend dependency for circuit breaking and caching)
- **Environment variables** (API keys for OpenAI, HuggingFace, etc.)

---

## Local Development

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (tests only)
cd ../frontend
npm install
```

### 2. Configure Environment

Create a `.env` file in the `backend/` directory:

```bash
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379/0
USE_OPENAI=true
OPENAI_API_KEY=your_key_here
HUGGINGFACE_API_KEY=your_key_here
```

### 3. Start Local Services

**Option A: Using npm scripts**

```bash
# Backend only (requires Redis running separately)
cd backend
npm run dev

# Frontend: Open frontend/index.html in your browser
```

**Option B: Using Docker Compose**

```bash
docker-compose up
# Services will be available:
# - Backend: http://localhost:3000
# - Redis: localhost:6379
```

### 4. Run Tests Locally

```bash
# Backend unit tests
cd backend
npm test

# Backend with coverage
npm test -- --coverage

# Frontend tests
cd ../frontend
npm test

# E2E tests (requires services running)
cd ..
./scripts/e2e.sh
```

---

## Docker Build & Deployment

### Building the Docker Image

```bash
# Build image with default tag
docker build -t midlevelbot-backend:latest .

# Build with custom tag
docker build -t your-registry/midlevelbot-backend:v1.0.0 .
```

### Running Docker Locally

```bash
# Run with default settings
docker run -p 3000:3000 midlevelbot-backend:latest

# Run with environment variables
docker run -p 3000:3000 \
  -e REDIS_URL=redis://host.docker.internal:6379/0 \
  -e OPENAI_API_KEY=your_key \
  midlevelbot-backend:latest

# Run with custom network (for docker-compose)
docker run -p 3000:3000 \
  --network midlevelbot_default \
  -e REDIS_URL=redis://redis:6379/0 \
  midlevelbot-backend:latest
```

### Docker Compose for Full Stack

```bash
# Start all services (redis + backend)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove data volumes
docker-compose down -v
```

---

## CI/CD Pipeline

The GitHub Actions pipeline runs on every push and pull request to `main`/`master`:

### Pipeline Stages

1. **Backend Tests** (parallel with Frontend Tests)
   - Installs deps
   - Runs Jest tests (37 tests)
   - Lints with ESLint
   - Checks code formatting with Prettier

2. **Frontend Tests** (parallel with Backend Tests)
   - Installs deps
   - Runs Jest tests (10 tests)
   - Checks DOM/UI functionality

3. **E2E Tests** (runs after Backend & Frontend pass)
   - Starts Redis service
   - Starts backend server
   - Runs full integration tests against running stack

**View Pipeline Status:**
- GitHub Actions: https://github.com/codepilot2025-star/Midlevelbot/actions

---

## Staging Deployment

### Using Docker Compose (Recommended)

```bash
# Build and push to staging registry
docker build -t staging.example.com/midlevelbot:latest .
docker push staging.example.com/midlevelbot:latest

# On staging server:
export DOCKER_REGISTRY=staging.example.com
export BOT_VERSION=latest
docker-compose pull
docker-compose up -d
```

### Using Kubernetes (Optional)

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl expose deployment midlevelbot-backend --type=LoadBalancer --port=3000
```

### Health Checks

```bash
# Check backend ready status
curl http://staging-server:3000/ready

# View metrics
curl http://staging-server:3000/metrics

# Test chat endpoint
curl -X POST http://staging-server:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello bot"}'
```

---

## Production Deployment

### Pre-Deployment Checklist

- ✅ All tests passing in CI/CD
- ✅ Code reviewed and merged to `main`
- ✅ Environment variables configured (API keys, Redis URL)
- ✅ Redis cluster/instance deployed and accessible
- ✅ Load balancer configured
- ✅ SSL/TLS certificates in place
- ✅ Monitoring and logging configured

### Deployment Methods

#### Option 1: Docker Compose (Small Scale)

```bash
# Pull latest image
docker pull your-registry/midlevelbot-backend:v1.0.0

# Update docker-compose.yml version tag
# Then:
docker-compose pull
docker-compose up -d
```

#### Option 2: Kubernetes (High Availability)

```bash
# Create namespace
kubectl create namespace midlevelbot

# Create secrets for API keys
kubectl create secret generic bot-secrets \
  --from-literal=OPENAI_API_KEY=$OPENAI_API_KEY \
  --from-literal=HUGGINGFACE_API_KEY=$HUGGINGFACE_API_KEY \
  -n midlevelbot

# Deploy
kubectl apply -f k8s/backend-deployment.yaml -n midlevelbot
kubectl apply -f k8s/backend-service.yaml -n midlevelbot
kubectl apply -f k8s/redis-deployment.yaml -n midlevelbot (or use external Redis)
```

#### Option 3: Cloud Platforms

**AWS ECS:**
```bash
aws ecs create-task-definition \
  --family midlevelbot-backend \
  --container-definitions file://ecs-task-definition.json
```

**GCP Cloud Run:**
```bash
gcloud run deploy midlevelbot-backend \
  --image gcr.io/your-project/midlevelbot-backend:latest \
  --platform managed \
  --memory 512Mi \
  --set-env-vars REDIS_URL=$REDIS_URL
```

**Azure Container Instances:**
```bash
az container create \
  --resource-group midlevelbot \
  --name midlevelbot-backend \
  --image your-registry.azurecr.io/midlevelbot-backend:latest \
  --environment-variables REDIS_URL=$REDIS_URL
```

### Scaling & Load Balancing

```bash
# Docker Compose - multiple replicas
docker-compose up -d --scale backend=3

# Kubernetes - horizontal pod autoscaler
kubectl autoscale deployment midlevelbot-backend \
  --min=2 --max=10 --cpu-percent=80 -n midlevelbot
```

### Monitoring & Logging

**Prometheus Metrics**
- Endpoint: `http://backend:3000/metrics`
- Scrape interval: 15s recommended
- Key metrics: response times, error rates, circuit breaker status

**Log Aggregation**
- Backend logs are output to stdout (JSON format)
- Forward to: ELK Stack, Datadog, CloudWatch, Stackdriver, etc.

Example with Docker:
```bash
docker-compose logs -f --tail 100 backend
```

---

## Performance Optimization

### Load Testing

```bash
# Using k6 (requires k6 installed)
# Start backend first:
cd backend && npm run start:prod &

# Run load test
npm run load-test

# Test results will show:
# - Request duration metrics (p95, p99)
# - Error rates
# - Throughput (RPS)
```

### Caching Strategy

- Redis caches circuit breaker state
- Implement response caching for frequent queries
- Use CDN for frontend static assets

### Database Optimization

- Monitor Redis memory usage
- Implement key expiration policies
- Consider Redis cluster for high availability

---

## Rollback Procedure

### Docker Compose

```bash
# Keep previous image tagged
docker tag midlevelbot-backend:latest midlevelbot-backend:prev

# Rollback to previous
docker-compose down
docker-compose up -d # uses 'prev' tag after editing docker-compose.yml
```

### Kubernetes

```bash
# Check rollout history
kubectl rollout history deployment/midlevelbot-backend -n midlevelbot

# Rollback to previous version
kubectl rollout undo deployment/midlevelbot-backend -n midlevelbot
```

---

## Environment Variables Reference

```bash
# Server Configuration
NODE_ENV=production              # development, staging, or production
PORT=3000                        # HTTP server port

# Redis
REDIS_URL=redis://localhost:6379/0

# AI Model APIs
USE_OPENAI=true
OPENAI_API_KEY=sk-...

HUGGINGFACE_API_KEY=hf_...

# Optional
USE_COPILOT=false
COPILOT_API_KEY=...

# Circuit Breaker
CIRCUIT_TIMEOUT=5000            # ms
CIRCUIT_ERROR_THRESHOLD=50      # percentage
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check Redis connectivity
curl http://localhost:6379/ping

# Verify env vars
env | grep -E "OPENAI|HUGGINGFACE|REDIS"

# Check logs
docker logs midlevel_backend
```

### Circuit Breaker Opened

- Check API key validity
- Verify rate limits not exceeded
- Monitor circuit breaker status at `/metrics`

### High Memory Usage

- Check Redis key expiration policies
- Increase cache eviction settings
- Monitor with `redis-cli info memory`

---

## Support & Further Reading

- **Local Testing**: See `README.md` in backend/
- **API Documentation**: `openapi.yaml`
- **Contributing**: `CONTRIBUTING.md`
- **Security**: `SECURITY.md`
- **Staging Info**: `README.staging.md`

---

*Last Updated: November 27, 2025*
