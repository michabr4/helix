# Security Hardening Checklist

## Secrets and Credentials
- Keep all credentials out of source control.
- Use `.env.example` placeholders only in repository.
- Rotate TAC, DNAC, Smart Licensing, and WebEx credentials before non-prod launch.

## Authentication and Session Security
- Enforce strong JWT secrets (32+ random chars).
- Use secure cookie transport if migrating auth to cookie mode.
- Return generic login failure response (`Invalid username or password`).

## Authorization
- Apply role checks to all mutating routes.
- Deny by default for unknown roles and unauthenticated requests.

## Input Validation and Injection Defense
- Validate all request payloads with schema validation.
- Use parameterized SQL for all DB operations.
- Restrict dynamic identifiers to allow-listed values.

## API and Integration Hardening
- Use HTTPS for all outbound API calls.
- Set outbound allowlist for known API hosts only.
- Add retry backoff and dead-letter queue for failed sync jobs.

## Logging and Monitoring
- Emit structured JSON logs with request correlation IDs.
- Redact credentials/tokens from logs.
- Monitor sync failures, auth anomalies, and repeated 4xx/5xx spikes.

## Data Protection
- Encrypt DB and backup storage in non-prod/prod.
- Enable TLS for database and cache connections in hosted environments.
- Keep audit trail enabled for security-relevant operations.
