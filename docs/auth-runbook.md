# Authentication Runbook

## Environment configuration

Copy `.env.example` to `.env.local`. Set the Supabase project URL, publishable key, site URL, and server-only service-role key. Never expose or log the service-role key. Production credentials must not be used for routine local work.

## Redirect configuration

In Supabase Auth URL Configuration, set the site URL to the deployed application origin and allow `https://<origin>/auth/callback`. For local work allow `http://localhost:3000/auth/callback`. Password recovery requests return through `/auth/callback?next=/reset-password`. Configure SMTP before relying on production invitation or recovery delivery.

## First Super Admin bootstrap

1. Apply migrations with `pnpm db:reset` locally or the controlled migration workflow in the target environment.
2. Create the intended first user explicitly in Supabase Auth. Do not enable public employee signup.
3. Set the required variables in `.env.local`.
4. Run `pnpm bootstrap:super-admin -- administrator@example.invalid`, replacing the placeholder with the exact intended administrator email.
5. The script refuses unknown users and refuses to promote a different user when an active Super Admin already exists. Re-running it for the same account is safe.
6. Remove shell history containing sensitive operational details where organizational policy requires it; the command never accepts a password or key argument.

## Employee provisioning

A Super Admin opens **Employees**, enters email/profile details, selects a stable system role and required branches, and confirms the invitation. The server re-verifies `users.manage`, uses the isolated admin client only to invite the Auth identity, then stores the intended access in an inactive pending profile. Pending invitations are not listed as employees and cannot access the application. After the recipient follows the secure link and successfully sets a password, the database atomically marks onboarding complete and activates the profile. A branch-scoped account cannot activate without a branch. If delivery/configuration fails, the profile remains inactive and hidden.

For Super Admins, pending profiles appear in a separate **Awaiting confirmation** section, showing the intended role, branches, recipient email, and invitation time. Use **Resend invitation** only when the recipient requests a fresh email or the prior link has expired. A resend uses Supabase Auth's standard invitation email and does not activate the profile or change its intended access.

Activation, deactivation, role changes, and branch assignments use the same confirmed access form. Self-management and removal of the final active Super Admin are blocked in the database.

Access changes send the employee an email through Resend when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured. Permanent deletion is restricted to Super Admins. Accounts with retained business history cannot be deleted because transaction attribution is immutable; deactivate those accounts instead.

## Password recovery and logout

`/forgot-password` always returns a neutral response to prevent email enumeration. Supabase sends the PKCE recovery link, `/auth/callback` exchanges its code, and `/reset-password` updates the credential. Logout ends the Supabase session and redirects to login.

## Local security testing

Start Docker Desktop, then run `pnpm db:start`, `pnpm db:reset`, `pnpm test:rls`, and `pnpm db:lint`. The transactional pgTAP suite creates `.invalid` identities for SUPER_ADMIN, OWNER, branch roles, inactive, and unassigned cases, then rolls everything back. Playwright authenticated flows use `E2E_ACTIVE_EMAIL`, `E2E_ACTIVE_PASSWORD`, `E2E_INACTIVE_EMAIL`, and `E2E_INACTIVE_PASSWORD`; never use production employees.

## Troubleshooting and production safety

- Callback failure: verify allowed redirect URLs and that the recovery link has not expired.
- Invitation failure: verify service-role server configuration and SMTP; never pretend mail was sent.
- Unexpected denial: inspect profile activation, role permission mapping, and branch assignment. Fix RLS or configuration—never bypass it with service role.
- Deactivation takes effect immediately for protected queries even if an access token has not expired.
- Rotate a service key immediately if exposure is suspected.
