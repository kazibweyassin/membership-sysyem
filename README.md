# Membership Management & Administration System

Web application for managing the full membership lifecycle of a membership
organisation: registration, onboarding, invoicing, payments, annual renewals,
reminders and reporting. Built to the SRS in `spec.md`.

Default configuration targets **FITSPA** (Fintech Association of Uganda) —
Bronze / Silver / Gold / Platinum categories, UGX, Africa/Kampala. All of that
is configurable in `.env` and in **Settings**.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) — UI and API routes in one app |
| Language | TypeScript |
| Database | PostgreSQL 16+ |
| ORM | Prisma |
| Auth | JWT (bcrypt password hashing) |
| Styling | Tailwind CSS |
| Email | Nodemailer (SMTP) |
| Exports | ExcelJS (.xlsx), PDFKit (.pdf) |
| Tests | Vitest |

---

## Quick start (local)

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#   -> set DATABASE_URL to a reachable PostgreSQL instance

# 3. Create the schema and seed categories + admin user
npm run db:migrate      # dev: creates and applies the migration
# npm run db:push       # alternative: sync schema without a migration file

npm run db:seed

# 4. Run
npm run dev             # http://localhost:3000
```

Login with the credentials printed by `db:seed`
(the seed prints a random administrator password on first run — change it
immediately, or set `SEED_ADMIN_PASSWORD` to choose one up front).

### npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run unit tests (Vitest) |
| `npm run db:migrate` | Create + apply a dev migration |
| `npm run db:push` | Push the schema without migrations |
| `npm run db:seed` | Seed categories, settings and admin user |
| `npm run db:studio` | Prisma Studio |

---

## Docker

```bash
cp .env.example .env      # set JWT_SECRET, CRON_SECRET, POSTGRES_PASSWORD
docker compose up --build
```

The app container waits for PostgreSQL, applies migrations with
`prisma migrate deploy`, then starts Next.js on port 3000. Document uploads go to
the `documents` volume; the database lives in the `pgdata` volume.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | dev value | Token signing key, ≥32 chars |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime |
| `CRON_SECRET` | for cron | — | Guards `GET /api/cron/run` |
| `APP_URL` | no | request origin | Base URL used by the cron handler |
| `ORG_NAME` | no | `FITSPA` | Shown in emails, PDFs, Excel |
| `ORG_TIMEZONE` | no | `Africa/Kampala` | Organisation timezone |
| `ORG_CURRENCY` | no | `UGX` | Invoice/payment currency label |
| `STORAGE_DIR` | no | `./storage/documents` | Upload location (outside web root) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | for email | — | Outgoing mail |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | no | see seed | Bootstrap administrator |

---

## Scheduled jobs

`GET /api/cron/run` runs, in order:

1. **Reminder dispatch** — invoices due today, overdue invoices (one mail per
   month of overdue), memberships at each configured expiry interval, and
   expired memberships. Duplicate reminders for the same member + type on the
   same day are skipped.
2. **Notification generation** — in-app alerts for due/overdue invoices,
   expiring/expired memberships and stalled onboarding.
3. **Expiry status refresh** — recomputes `expiryStatus` on every member from
   their latest membership period.

Authenticate with `Authorization: Bearer <CRON_SECRET>`. `vercel.json` registers
this as a daily job at 07:00 UTC; Vercel supplies that header automatically when
`CRON_SECRET` is set in the project environment.

Outside Vercel, use any scheduler:

```cron
0 7 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/run
```

Both steps are also callable individually:
`/api/reminders/run` and `/api/notifications/generate`.

Without SMTP configured, reminders are still written to reminder history with
`deliveryStatus = FAILED` and a reason, so they can be retried once mail is set up.

## Deploying to Vercel

1. Import the repository and set these environment variables:
   `DATABASE_URL` (cloud Postgres, pooled connection string),
   `JWT_SECRET` (long random string), `CRON_SECRET` (long random string).
2. Deploy. The `build` script runs `prisma generate`, then
   `prisma migrate deploy`, then `prisma db seed`, then `next build` — so a fresh
   database is migrated and bootstrapped as part of the build, with nothing to
   run by hand and no need to read the connection string yourself.
3. On a first deploy the seed prints the generated administrator password to
   the build log. It is printed once. Set `SEED_ADMIN_PASSWORD` instead if you
   would rather choose it up front.

   If you lose that password, set `SEED_ADMIN_PASSWORD` in Vercel and redeploy:
   the seed then applies that password to the administrator account. Clear the
   variable afterwards if you want the password to stay under your control
   rather than the deploy pipeline's.
4. Check `GET /api/health`. It returns `status: ok` with the public table count,
   or names the misconfiguration (missing `DATABASE_URL`, a localhost host, or a
   database with no tables).

Document uploads write to `STORAGE_DIR`. Vercel's filesystem is read-only apart
from `/tmp`, which does not persist, so point that variable at durable storage
or uploads will fail there.

---

## Domain rules implemented

- **Member numbers** `MBR-YYYY-NNNN` and internal IDs `INT-NNNNNN` are generated
  server-side and are unique.
- **Contacts**: three are created by default in the registration form; more can
  be added. Exactly one is flagged primary.
- **Onboarding**: six fixed stages. Completing a stage sets its date; progress is
  `completed / 6`. Receiving a payment never marks onboarding complete — every
  stage must be ticked.
- **Payments** are append-only. Recording a payment never overwrites an earlier
  one; overpayment is rejected server-side. Invoice `amountPaid` and status
  (`ISSUED` → `PARTIALLY_PAID` → `PAID`) are recomputed from the payment rows.
- **Expiry**: when an invoice is settled in full, a `MembershipPeriod` is created
  with `expiry = payment date + N months` (default 12, configurable via the
  `membership_period_months` setting) and `renewalDate = expiry`. Previous periods
  are kept, so renewal history is never lost.
- **Months past due** stops accumulating once an invoice is paid.
- **Cancellation and user deactivation are soft** — no financial or membership
  history is destroyed through the UI.
- **Audit log** records user, action, entity, entity id, previous and new values
  for member, invoice, payment, onboarding, reminder, user and category changes.

Calculations live in `src/lib/business.ts` and are covered by
`src/lib/__tests__/business.test.ts`.

---

## Roles

| Capability | Administrator | Membership Officer | Finance Officer |
|---|---|---|---|
| Members / directory | full | full | read via reports |
| Onboarding | full | full | — |
| Invoices | full | — | full |
| Payments / reminders | full | — | full |
| Reports / audit log | full | full | full |
| Users / settings / categories | full | — | — |

Enforced server-side by `requirePermission` on every mutating route, using the
matrix in `src/lib/audit.ts`; the sidebar filters itself with the same matrix.
Tests in `flows.integration.test.ts` assert the 403s.

## Document storage

Uploads go to `STORAGE_DIR` (default `./storage/documents`), outside the web root.
Files are renamed to a UUID on disk; the original name lives in the database.
Downloads only work through `/api/documents/[id]` behind authentication, with
`nosniff` and `no-store`. Allowed types: PDF, PNG, JPEG, WebP, Word, Excel, text,
CSV, up to 10 MB.

---

## Reports

Ten reports, each exportable to **Excel** or **PDF**, with optional category and
status filters:

membership register · members by category · paid and unpaid · overdue invoices ·
payment collection · membership expiry · annual renewal · onboarding progress ·
cancelled memberships · reminder history.

Every figure is computed from database rows at request time.

---

## In-app help

The **Help & Guide** page (`/help`) walks users through the whole workflow:
getting started, roles and access, registering a member, onboarding, invoices,
payments, renewals, reminders, reports, documents, settings and users, the audit
log, a status reference, and a troubleshooting FAQ.

Every page header carries a **?** button (`HelpLink`) that deep-links to the
relevant section, so help is always one click from where the user is. On small
screens the guide exposes a contents menu for jumping between sections.

---

## Layout

```
prisma/
  schema.prisma        data model (14 entities)
  seed.ts              categories, settings, bootstrap admin
src/
  app/
    (app)/             authenticated pages (sidebar layout)
      dashboard/ members/ onboarding/ invoices/ payments/
      renewals/ notifications/ reports/ audit-logs/ settings/ help/
    api/               route handlers
      auth/ members/ onboarding/ categories/ invoices/ payments/
      reminders/ notifications/ renewals/ reports/ documents/
      dashboard/ settings/ users/ audit-logs/ cron/
    login/
  components/
    layout/            sidebar shell
    help/              HelpLink "?" deep-link component
    providers/         JWT auth context
  lib/
    auth.ts            bcrypt + JWT
    middleware.ts      request auth, ApiError, error mapping
    business.ts        expiry / overdue / progress calculations
    audit.ts           audit logging, permission matrix
    id-generator.ts    member, invoice and internal IDs
    onboarding.ts      the six stage definitions
    email.ts           SMTP transport + reminder templates
    storage.ts         document storage helpers
    pdf.ts             PDF table renderer
    prisma.ts          client singleton
    validation.ts      zod schemas
```

---

## Notes and limits

- Password reset, MFA and session revocation are not implemented.
- Reminder email is SMTP only; there is no outbound webhook or SMS path. Without
  SMTP configured, reminders are recorded with `deliveryStatus = FAILED` and the
  reason, so history is complete and can be retried later.
- In-app notifications are polled by the client rather than pushed over a socket.
- CSV import of the legacy Excel spreadsheets is not implemented — members are
  entered through the registration form or the API.
- Category fees start at `0` from the seed; set the real FITSPA fee schedule in
  **Settings → Categories** before issuing invoices.
- There is no per-role scoping of which members a user may see; roles gate
  capabilities, not rows.
- Document storage is local disk. For multi-instance hosting, point
  `STORAGE_DIR` at shared or object storage.

---

## Tests

```bash
npm test          # 44 tests: calculation units + API integration (needs TEST_DATABASE_URL)
npm run typecheck # full TypeScript check
npm run build     # production build
npm run smoke     # 59 end-to-end HTTP checks against a running server
```

The integration suite (`src/app/api/__tests__/flows.integration.test.ts`) drives the
real route handlers against a PostgreSQL database. It defaults to
`postgresql://postgres:postgres@localhost:5432/membership_system_test`; override
with `TEST_DATABASE_URL`. Create that database and run `prisma migrate deploy`
against it once before the first run.

`npm run smoke` expects a server on `http://localhost:3100` (override with
`SMOKE_BASE`). It exercises registration → invoice → partial payment →
overpayment rejection → full payment → expiry calculation → onboarding →
reports → documents → audit log, and cleans up after itself.