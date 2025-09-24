Deployment notes

Build with Docker (recommended):

```bash
# build image
make docker

# run container
docker run -p 3000:3000 --env-file .env -d midlevelbot:latest
```

Or run locally for development:

```bash
cd backend
npm install
npm run dev
```

CI: a GitHub Actions workflow is included at `.github/workflows/ci.yml`. It runs tests on push and PR to main/master.
