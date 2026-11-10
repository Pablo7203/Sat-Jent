# Staging deployment

## Current status

- GitHub target: `https://github.com/Pablo7203/Sat-Jent.git`
- Branch: `main`
- Repository visibility: public
- Supabase staging project: `SAT-J Commerce Staging` in Ireland (`ewzwfuwkcvwgbndcyxct`)
- Database migrations: remote dry run reports up to date
- Vercel: no project is linked or deployed from this checkout yet
- The local `.env` has the staging Supabase URL, but is missing the publishable key and service-role key needed for a complete hosted setup

## Local release checks

These checks passed on 2026-11-10:

| Check                              | Result                                        |
| ---------------------------------- | --------------------------------------------- |
| Prettier write and check           | Passed; SQL migrations were left untouched    |
| ESLint                             | Passed with zero warnings                     |
| TypeScript                         | Passed                                        |
| Unit tests                         | Passed: 12 files and 37 tests                 |
| Production build                   | Passed                                        |
| Mobile Lighthouse accessibility    | 100                                           |
| Mobile Lighthouse best practices   | 100                                           |
| Mobile Lighthouse agentic browsing | 100                                           |
| Mobile Lighthouse SEO              | 69; crawl blocking is intentional for staging |

The public routes and `/api/health` returned HTTP 200 in the local browser smoke check. The mobile layout had no horizontal overflow at 375 pixels.

The local production preview used `.env.local`, which points to local Supabase. One image request returned HTTP 400 because Next.js blocks private IP image optimization in production. This was specific to the local database image URL; `next.config.ts` keeps local-IP image access development-only. Staging image URLs should use the hosted Supabase domain.

## Vercel project setup

Create a dedicated Vercel project such as `sat-j-ent-staging` and import `Pablo7203/Sat-Jent` from the `main` branch. Use the repository root and Next.js framework detection. The standard build command is `pnpm build`; the committed pnpm lockfile selects the package manager.

Because this Vercel project is reserved for staging, set its Production environment values to the staging Supabase project. Keep any future production deployment in a separate Vercel project with separate credentials.

Configure these variables in Vercel. Do not copy `.env.local` or commit real values to GitHub.

| Variable                                 | Use                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`               | The staging project API URL                                                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`   | The staging publishable key                                                                        |
| `NEXT_PUBLIC_APP_ENV`                    | Set to `staging` to keep the site out of search indexing                                           |
| `SUPABASE_SERVICE_ROLE_KEY`              | Server-only key used by the store-order request API                                                |
| `NEXT_PUBLIC_SITE_URL`                   | Set the stable HTTPS staging URL after the first deployment; it can be omitted for the first build |
| `RESEND_API_KEY` and `RESEND_FROM_EMAIL` | Optional; needed only for email flows that use Resend                                              |

After the first deployment, set `NEXT_PUBLIC_SITE_URL` to its stable HTTPS origin and add that origin to Supabase Auth's Site URL and redirect allowlist. Keep public sign-up disabled. Verify the `/auth/callback`, password-reset, and invitation redirects before testing account emails.

## Staging acceptance still required

After the Vercel project is connected and the required variables are set, verify the deployed commit and build result, `/api/health`, public catalogue and product images, staff login, branch separation, private product and price visibility, store-order requests, and responsive behavior. Use synthetic accounts and data only. Review Vercel and Supabase logs for errors before treating the deployment as ready for UAT.
