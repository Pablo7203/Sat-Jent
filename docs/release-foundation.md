# Release foundation

## Baseline identity

This is the separate SAT-J Commerce project, with its own storefront and store-management code. Its GitHub target is the public repository `https://github.com/Pablo7203/Sat-Jent.git`, whose default branch is `main`. Do not copy history from the original `SAT-J` checkout into this repository.

The first pushed commit establishes Staging Candidate 1. GitHub is the authoritative record of its immutable commit identifier. This is not a final `v1.0.0` release: do not create a final release tag until hosted staging security checks, business UAT, content/data approval, backup evidence, and production cutover approval pass.

This baseline is **Staging Candidate 1**, not the final `v1.0.0` release. Create no final release tag until hosted staging security checks, business UAT, content/data approval, backup evidence, and production cutover approval pass.

## Repository safety policy

Never commit `.env` files, service-role keys, database credentials, backups, production exports, real business onboarding files, staff passwords, generated reports, or browser/build output. Safe placeholders belong in `.env.example`. Store owner-supplied onboarding material only under ignored `data/private/`; store local backup output only under ignored `backups/` and encrypt it when it leaves the workstation.

Tracked fixtures use synthetic names, invalid test email domains, and disposable passwords only. Supabase migrations contain schema/static system configuration, not business records. Runtime storage objects and local Supabase state are not source assets.

## Environment separation

Local, staging, and production require separate Supabase and hosting targets. Never reuse production keys, accounts, datasets, or storage in staging. Set `NEXT_PUBLIC_APP_ENV=staging` on staging; the application then returns a site-wide robots disallow rule. Set `production` only on the approved production host.

| Variable                               | Classification                 | Staging requirement                                            |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public                         | Staging project API URL                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public                         | Staging publishable key                                        |
| `NEXT_PUBLIC_SITE_URL`                 | Public                         | Exact HTTPS staging origin                                     |
| `NEXT_PUBLIC_APP_ENV`                  | Public                         | `staging`                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only                    | Required for the store-order request API                       |
| `E2E_ACTIVE_PASSWORD`                  | Test-only                      | Synthetic staging test secret if automated setup is authorized |
| `E2E_INACTIVE_PASSWORD`                | Test-only                      | Synthetic staging test secret if automated setup is authorized |
| `OPENING_STOCK_OPERATOR_EMAIL`         | Optional operations            | Not needed for synthetic smoke unless import is exercised      |
| `OPENING_STOCK_OPERATOR_PASSWORD`      | Optional server/process secret | Never expose to browser or Git                                 |

## Staging infrastructure

The separate Supabase staging project has been created in Ireland with project reference `ewzwfuwkcvwgbndcyxct`. The migration dry run reports that the remote database is up to date. Keep the database URL and credentials in ignored local environment files or the deployment provider's protected environment settings.

After the staging site has a stable URL, configure Auth with that exact Site URL and the `/auth/callback`, password-reset, and invitation redirects. Keep public signup disabled. Configure an approved SMTP sender before testing email-dependent flows, and verify the private `product-images` bucket and policies in the hosted project.

Create a dedicated Vercel staging project connected to `https://github.com/Pablo7203/Sat-Jent.git` on `main`. Use the repository root, Next.js framework detection, pnpm, and `pnpm build`. Since the project is dedicated to staging, its Vercel Production environment must use only staging Supabase values. Do not copy local `.env.local` into Vercel.

Never commit `.env` files, service-role keys, database credentials, backups, production exports, real business onboarding files, staff passwords, generated manuals, or build output. The generated Word/PDF manuals and their rendered page images are ignored; the source application and maintained Markdown documentation remain in the repository.

## Staging data and identities

Use synthetic Owner/Super Admin, Branch Manager, Sales, and Inventory identities. Create a deliberately small dataset covering two branches; active/public and private/hidden-price products; opening inventory; purchase and receipt; paid and credit sale; customer payment; transfer; reporting; public quote. Do not place staging fixtures in production migrations or use real staff/customer details.

## Deployment and security gate

Before UAT, the hosted candidate must pass:

- Migration application and `/api/health`.
- Homepage, catalogue/search/filter, product detail, quote submission, and staging no-index response.
- Login, dashboard, customer, completed sale, purchase/receipt, inventory movement, transfer dispatch/receipt, reports, and CSV export.
- Anonymous internal-table denial, inactive-user denial, branch isolation, direct inventory-write denial, cross-branch export denial, private-product denial, hidden-price protection, and quotation isolation.
- Synthetic Owner, Branch Manager, Sales, and Inventory role checks.
- Hosted logs free of credentials and sensitive payloads.

Only after deployment, migrations, health, smoke, and security pass does Staging Candidate 1 become eligible for the UAT plan in `docs/uat-plan.md`.

## Reproducibility

The baseline gate is run from a separate clean checkout: frozen-lockfile install, clean Supabase reset/migration replay, pgTAP suite, typecheck, lint, unit tests, production build, and database lint. Exact outcomes belong in the completion report and CI rather than being hard-coded here where they can become stale.
