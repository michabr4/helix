# Non-Prod Deployment Runbook

## 1. Prerequisites
- Docker and Docker Compose installed.
- Valid non-prod credentials for external integrations.
- PostgreSQL and Redis ports available (5432, 6379).

## 2. Configuration
1. Copy root `.env.example` to environment-specific runtime config.
2. Replace placeholders with non-prod secrets from secret manager.
3. Confirm integration feature flags match target test scope.

## 3. Bring Up Services
1. From project root, run: `docker compose up --build -d`
2. Check container health:
   - Postgres healthy
   - Redis healthy
   - Backend serving `/api/v1/health`
   - Frontend accessible on port 3001

## 4. Database Setup
1. Run migration + seed command from backend container:
   - `npm run migrate`
2. Validate schema creation for `mgm`, `cisco`, and `audit`.

## 5. Smoke Validation
- Login with seeded admin user.
- List incidents/devices/properties.
- Trigger a manual integration sync endpoint and confirm response.

## 6. Go/No-Go Checklist
- Lint, typecheck, and tests green.
- No unresolved critical defects.
- No secrets exposed in logs.
- Security checklist reviewed and signed off.

## 7. Rollback
- If deployment fails, stop services and restore previous container images.
- Restore database from latest non-prod backup snapshot if migration corruption occurs.
