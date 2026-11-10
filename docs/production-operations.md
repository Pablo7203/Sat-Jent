# Production operations

## Environment boundary

Use separate Supabase projects and hosting targets for local development, staging, and production. Never copy production secrets into `.env.local`, CI logs, source control, test fixtures, or a staging project. Set `NEXT_PUBLIC_APP_ENV` to `staging` or `test` outside production so robots disallow indexing; set it to `production` only for the approved live domain.

Production requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is permitted only in trusted provisioning/administrative execution and must not be exposed to browser code. Rotate it after suspected disclosure.

## Authentication

Disable public signup in the production Supabase Auth settings. Provision the initial Super Admin using the documented bootstrap command in a trusted environment, then use controlled employee invitations. Configure the final site URL, exact callback allow-list, SMTP sender/domain, email templates, password policy (minimum 12 with mixed character classes), HTTPS, and secure cookies. Test login, logout, password reset, expired-link handling, inactive-user denial, and session persistence on staging.

## Monitoring and incident response

Monitor `GET /api/health`; HTTP 200 means the application can reach its public database API, and HTTP 503 means unavailable. Do not treat it as a full business-workflow check. Alert on sustained 5xx responses, auth failures, database saturation, backup failures, and storage errors. Application logs must contain correlation context but no passwords, tokens, cookies, authorization headers, or customer-sensitive payloads.

For an incident: record the time and impact, stop unsafe writes if integrity is at risk, preserve logs, identify the last known-good backup, notify the owner, and decide rollback versus forward fix. Never repair stock or financial ledgers with direct table updates; use an approved reversal/correction workflow.

## Scheduled checks

- Daily: health, error rate, quotation delivery/triage, backup completion.
- Weekly: restore-sample evidence, inactive accounts, unexpected privileged users, unresolved reconciliation issues.
- Monthly: access review, key rotation assessment, dependency/security review, recovery exercise results.
