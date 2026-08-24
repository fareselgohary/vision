# Security baseline

This project follows the [OWASP Top 10:2025](https://owasp.org/Top10/2025/) as its application-security baseline.

| OWASP category | Current control | Remaining operational control |
| --- | --- | --- |
| A01 Broken Access Control | Admin API routes validate the Supabase user and `admins` membership; year changes require an admin token. | Apply migration `004_year_controls_and_final_registration.sql` to make a registration immutable in PostgreSQL as well. |
| A02 Security Misconfiguration | CSP, HSTS, frame protection, MIME sniffing protection, permissions policy, and cache controls are deployed through Pages headers. | Keep Cloudflare/Supabase secrets only in their secret stores. |
| A03 Software Supply Chain Failures | Exact dependency versions, Node engine requirement, `.npmrc`, and `package-lock.json`. | Run `npm ci` and `npm audit` in CI before every production deployment. |
| A04 Cryptographic Failures | HTTPS is enforced by Cloudflare; API responses avoid sensitive caching; Supabase secret keys remain server-side. | Rotate Supabase and Cloudflare secrets after any suspected exposure. |
| A05 Injection | Strict input validation, parameterized Supabase REST filters, UUID checks, and no dynamic SQL in the Worker. | Keep database changes in reviewed migrations only. |
| A06 Insecure Design | Registration capacity and final-registration rules are server-side; public routes expose only minimum data. | Add a staging Supabase project for load tests. |
| A07 Authentication Failures | Supabase Auth validates admin tokens; login errors are generic; admin tokens use `sessionStorage`, not persistent storage. | Configure Cloudflare rate limits and Turnstile as listed below. |
| A08 Software or Data Integrity Failures | Admin-only state changes, audited deployments, pinned dependencies, and no public loader payloads. | Protect the production branch and require code review. |
| A09 Security Logging and Alerting Failures | Worker emits structured audit events without registration numbers, passwords, or IP addresses. | Enable Cloudflare Logpush or Workers Logs and set alerts for repeated `admin_login_failed` events. |
| A10 Mishandling of Exceptional Conditions | Invalid JSON returns `400`; internal failures return generic `500` responses without stack traces. | Monitor 5xx rates and test failure scenarios before releases. |

## Required Cloudflare configuration

Create these WAF rate-limiting rules in Cloudflare before public launch:

1. `POST /api/admin/login`: block or Managed Challenge after 5 requests per IP in 15 minutes.
2. `POST /api/register`: Managed Challenge after 10 requests per IP in 1 minute; keep the limit high enough for students sharing a campus network.
3. Enable Bot Fight Mode, and add Turnstile verification to `POST /api/register` before accepting public registrations.

## Required Supabase configuration

1. Run `supabase/migrations/004_year_controls_and_final_registration.sql` in SQL Editor.
2. Confirm RLS is enabled on every `public` table and that `service_role` is never exposed to the browser.
3. Enable MFA for every Supabase project owner and rotate service keys after any suspected leak.
