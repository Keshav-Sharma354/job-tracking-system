# Job Search CRM

A self-hosted CRM for running a job search: applications, contacts, outreach,
follow-ups, notes and analytics in one place, with real database persistence and
no simulated behaviour.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS 4** and
**PostgreSQL** via **Prisma 7**.

---

## Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Email: sending and receiving](#email-sending-and-receiving)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Data import and export](#data-import-and-export)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## What it does

| Area | Capability |
| --- | --- |
| **Dashboard** | Application stats, pipeline breakdown, upcoming interviews, today's tasks, overdue follow-ups and a full activity log. |
| **Applications** | Company, title, URL, status, priority, deadlines, salary, resume version, referral, tags and notes. List view with filters, a Kanban board with drag-and-drop, and a detail page with history, notes and tasks. |
| **Contacts** | Recruiters, HR, hiring managers, engineers, engineering managers, directors and employee referrals, with email, phone, LinkedIn, company and relationship strength. A contact page carries the whole conversation. |
| **Outreach** | Reusable templates with `{{variable}}` substitution, personalised drafts, real SMTP sending, delivery log and threaded replies. |
| **Follow-ups** | Tasks linked to an application, contact or email, with due dates, priority, one-click completion and snoozing. Overdue items surface on the dashboard. |
| **Notes** | Free-form notes typed for context, attachable to an application and/or a contact, pinnable and searchable. |
| **Search & analytics** | Global search across every entity, funnel and monthly reports, source breakdown, time-to-decision and per-company performance. |
| **Import / export** | CSV in and out for applications, contacts, tasks and notes. |

---

## Quick start

**Requirements:** Node.js 20.19+ (22 or 24 recommended) and Docker (for
PostgreSQL and Mailpit).

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL and Mailpit
docker compose up -d

# 3. Configure the environment
cp .env.example .env

# 4. Create the database schema and generate the Prisma client
npm run db:deploy      # applies prisma/migrations to your database
npm run db:generate    # generates src/generated/prisma

# 5. Create your login
npm run db:seed -- --account you@example.com "Your Name"
#    Temporary password: ChangeMe123456 — change it in Settings after signing in.

# 6. Start the app
npm run dev
```

Open <http://localhost:3000>.

### Trying it out with sample data

```bash
npm run db:seed -- --demo
```

Creates `demo@example.com` / `DemoPassword123` with six companies, nine contacts,
ten applications, templates, outreach and follow-ups. Regenerate at any time
with `npm run db:seed -- --demo --reset`.

The seed script refuses to create demo data when `NODE_ENV=production`, and
without a flag it only prints usage — so an accidental `npm run db:seed` can
never inject fake records into a real database.

---

## Environment variables

Every variable is validated at boot by `src/lib/env.ts`; a missing or malformed
value fails immediately with a readable message rather than at the first request
that happens to need it.

### Required

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Used by the app and by the Prisma CLI. |
| `SESSION_SECRET` | At least 32 characters in production. Generate one with:<br>`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |

### Recommended

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Standard Next.js environment flag. |
| `APP_URL` | `http://localhost:3000` | Public origin. |
| `DIRECT_DATABASE_URL` | — | Direct (unpooled) connection for the app when `DATABASE_URL` points at a pooler such as PgBouncer. |
| `SHADOW_DATABASE_URL` | — | Disposable database used by `prisma migrate dev` to detect schema drift. |
| `SESSION_TTL_DAYS` | `30` | Session lifetime. Sessions renew once past the halfway point (sliding expiry). |
| `ALLOW_REGISTRATION` | `1` | Set to `0` to disable self-service sign-up and provision accounts only via `db:seed --account`. |

### Email

All optional. With them unset, drafts still work and sending is explicitly
disabled — see [Email](#email-sending-and-receiving).

| Variable | Description |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Relay connection. `SMTP_SECURE` defaults to true on port 465 (implicit TLS) and false elsewhere (STARTTLS). |
| `SMTP_USER`, `SMTP_PASSWORD` | Optional credentials. Omit both for an open relay such as Mailpit. |
| `SMTP_FROM_EMAIL` | The address outreach is sent from. Must be a domain you control with SPF/DKIM/DMARC configured. |
| `SMTP_FROM_NAME` | Display name for the sender. |
| `EMAIL_INBOUND_SECRET` | Shared secret for `POST /api/webhooks/email-inbound`. Leave unset to disable inbound replies. |

---

## Email: sending and receiving

**This application never fakes sending mail.** If SMTP is not configured, the
"Send" action is disabled in the UI and the server action returns
`MAILER_NOT_CONFIGURED`. Nothing is written to the delivery log and no message is
marked as sent. This behaviour is covered by tests.

### Local testing

`docker compose up -d mailpit` starts a real SMTP server:

- SMTP on `localhost:1025`
- Web UI on <http://localhost:8025> — see exactly what was sent

With the default `.env` you can send to any address and read it in Mailpit.

### Sending in production

1. Point `SMTP_HOST` / `SMTP_PORT` at a real relay (SES, Postmark, Fastmail…).
2. Set `SMTP_FROM_EMAIL` to an address on a domain with SPF, DKIM and DMARC.
3. Set `SMTP_USER` / `SMTP_PASSWORD` if the relay requires auth.
4. Restart and check **Settings → Outbound email**, which runs a live SMTP
   handshake and reports the result.

Sending is a three-step sequence that is deliberately not one transaction:

1. **Claim** the draft (`DRAFT` → guarded update) so a double-click cannot send twice.
2. **Hand off** to SMTP.
3. **Persist** the outcome — on success mark `SENT` and append a delivery record; on failure restore the row and record why.

If the process dies between steps 2 and 3 the row stays claimed rather than
silently reporting a success that cannot be verified.

### Receiving replies

Point your mail provider's inbound webhook at:

```
POST https://your-app.example.com/api/webhooks/email-inbound
Authorization: Bearer <EMAIL_INBOUND_SECRET>
Content-Type: application/json
```

```json
{
  "from": "dana@example.com",
  "to": "you@example.com",
  "subject": "Re: Staff Engineer at Acme",
  "text": "…plain text body…",
  "messageId": "<abc@mail.example>",
  "inReplyTo": "<xyz@mail.example>",
  "receivedAt": "2026-05-04T09:30:00.000Z"
}
```

The endpoint is idempotent on `messageId`, so a provider retrying a delivery will
not create a duplicate. It threads the reply onto the outbound message (matching
`In-Reply-To` first, then recipient plus normalised subject), marks that message
`REPLIED`, and schedules a follow-up task.

It returns **202** when no matching outbound message exists. That is deliberate:
the delivery itself succeeded and retrying will not change the outcome, so a
4xx would make the provider retry forever.

Replies you receive elsewhere can be logged by hand from the contact page.

---

## Testing

237 tests across three suites.

```bash
npm test                  # everything
npm run test:unit         # pure logic, no database
npm run test:integration  # real PostgreSQL
npm run test:watch
npm run verify            # typecheck + lint + tests
```

| Suite | Environment | Covers |
| --- | --- | --- |
| `unit` | node | CSV round-tripping and injection guard, date/timezone maths, Zod field builders, template rendering, architecture invariants. |
| `integration` | node + PostgreSQL | Repositories, services, tenancy isolation, authentication, and the CSV/webhook route handlers. |
| `component` | jsdom | Theme persistence, the mailer-disabled banner, chart rendering. |

### Integration tests need a real database

They `TRUNCATE` every table between specs, so they must never point at a
database you care about. The setup **refuses to run** if `TEST_DATABASE_URL`
equals `DATABASE_URL`.

```bash
cp .env.test.example .env.test
# then edit the connection string
createdb jobsearch_crm_test        # or: docker exec -it <container> createdb -U jts jobsearch_crm_test
DATABASE_URL=<test url> npx prisma migrate deploy
npm run test:integration
```

### Smoke check against a running dev server

With `npm run dev` in another terminal:

```bash
npx tsx scripts/smoke.ts
```

Signs in as the demo account and asserts every route renders. Override with
`SMOKE_EMAIL`, `SMOKE_PASSWORD` and `SMOKE_BASE_URL`.

---

## Project layout

```
prisma/
  schema.prisma          Data model
  migrations/            Committed SQL migrations
  seed.ts                Account + demo data
prisma.config.ts         Prisma 7 configuration
src/
  app/
    (auth)/              Sign in and sign up
    (app)/               Authenticated area (shell + pages)
    actions/             Server actions: thin, auth + validate + delegate
    api/                 health, CSV export/import, inbound webhook
    globals.css          Design tokens and base styles
  components/
    ui/                  Primitives (button, inputs, dialogs, form engine)
    layout/              App shell, navigation, global search, theme
    features/            Domain components (jobs, contacts, emails, …)
  lib/
    auth/                Passwords, tokens, session store, cookie adapter
    validation/          Zod field builders and schemas
    utils/               CSV, dates, formatting, typed action results
    constants.ts         Domain vocabulary and display metadata
    db.ts, env.ts        Prisma singleton and validated configuration
  server/
    repo/                Queries. Every function takes a userId.
    services/            Business rules, transactions, activity logging
    email/               SMTP transport and template rendering
prisma/generated → src/generated/prisma (git-ignored)
tests/
  unit/  integration/  component/
```

---

## Architecture

Three layers, each with a single job:

```
Server action          HTTP layer.  Authenticate → validate → delegate → revalidate.
   ↓
Service                Business rules. Ownership checks, transactions, activity
   ↓                    logging, follow-up scheduling, email delivery.
Repository             Queries. Every function requires a userId and includes it
   ↓                    in the WHERE clause.
Prisma / PostgreSQL
```

### Why data isolation is structural, not conventional

Every user-owned table carries a `userId` column with a composite index, and
**every repository function takes `userId` as its first argument and includes it
in the query**. Reading or mutating another account's row is not something you
can forget to guard against — it is not expressible. `getJobById(otherUserId, id)`
returns `null`, not someone else's data.

This is enforced two ways:

- `tests/integration/repositories.test.ts` and `services.test.ts` assert the
  behaviour against a real database.
- `tests/unit/architecture.test.ts` parses every exported function in
  `src/server/repo/` and fails if one queries the database without a `userId`
  parameter, or accepts one without scoping by it.

The same architecture test refuses to let a Client Component import `@/lib/env`,
`@/lib/db`, the generated Prisma client or anything under `src/server/`, which is
the mistake most likely to leak a secret into the browser bundle.

### Forms

`ResourceFormDialog` renders a declarative field list, posts a `FormData`
straight to a server action, and renders whatever field errors come back.
Validation therefore always happens on the server, where it cannot be bypassed by
editing the DOM. It keeps ~15 CRUD screens small enough to audit at a glance.

### Actions never throw for expected failures

A thrown error crosses the network boundary as an opaque digest the client cannot
render. Instead every action returns a discriminated union:

```ts
type ActionResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ActionErrorCode; error: string; fieldErrors?: Record<string, string> }
```

so the UI can distinguish "not signed in", "no longer exists", "that clashes" and
"please fix these fields" — and render field errors inline rather than in a toast.

---

## Security model

| Concern | How it is handled |
| --- | --- |
| **Passwords** | Argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1). |
| **Sessions** | 256-bit random opaque token in an `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookie. Only the SHA-256 digest is stored, so a database leak cannot be replayed. Sliding expiry; expired sessions are deleted on sight. |
| **Password change** | Revokes every existing session, then issues a fresh one for the current device. |
| **User enumeration** | An unknown email and a wrong password return an identical message, and the unknown-email path still performs an Argon2 verification so response timing does not reveal which addresses exist. |
| **Brute force** | Fixed-window rate limits per IP and per account for both sign-in and sign-up. |
| **Authorization** | Pages call `requireSession()`; server actions call `requireUserId()`, which throws for anonymous callers. Foreign keys supplied by the client are re-validated against the caller in the service layer. |
| **CSRF** | Next.js verifies the Origin header on server actions. Route handlers authenticate with a bearer secret, not the session cookie. |
| **XSS** | React escapes by default; URL fields are restricted to `http`/`https` (a `javascript:` URL cannot survive validation); the email HTML part escapes all interpolated text. |
| **CSV injection** | Exported cells beginning with `=`, `+`, `-`, `@` or a tab are prefixed with an apostrophe so spreadsheets do not execute them. |
| **Headers** | `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a strict referrer policy on every response. |

### Rate limiting caveat

The limiter is backed by process memory. That is effective for a single instance,
which is the usual case for a self-hosted personal app. Behind a load balancer
each instance keeps its own counters, so the effective limit multiplies by the
instance count. `src/server/auth/rate-limit.ts` is deliberately narrow so
swapping `hits` for a Redis `INCR` + `EXPIRE` is a one-file change.

---

## Data import and export

**Settings → Import & export**, or directly:

```bash
# Export
GET /api/export?entity=applications   # also: contacts, tasks, notes

# Import (multipart/form-data, field name "file")
POST /api/export?entity=applications  # also: contacts
```

Export writes a UTF-8 BOM so spreadsheet apps detect the encoding. Import is
**partial success**: every row is validated and applied independently, and the
response reports exactly which rows failed and why. Headers are matched
case- and punctuation-insensitively, and status columns accept either the
human label (`Phone Screen`) or the raw value (`PHONE_SCREEN`), so a file
exported by this app re-imports cleanly.

A round-trip test asserts that titles containing commas, notes with embedded
punctuation and tag lists all survive export → import unchanged.

Limits: 5 MB per file and 2,000 rows per import.

---

## Deployment

### Any Node host (VPS, Fly.io, Railway, Render)

```bash
npm ci
npx prisma generate
npx prisma migrate deploy     # apply migrations, do NOT run `migrate dev`
npm run build
npm run start                 # respects PORT, defaults to 3000
```

Point `DATABASE_URL` at your managed PostgreSQL instance. If you are using a
connection pooler, set `DIRECT_DATABASE_URL` to the direct connection so
migrations are not run through the pool.

Behind a reverse proxy, forward the client address so rate limiting sees real IPs:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

Health checks:

```bash
curl -fsS https://your-app.example.com/api/health
```

Returns `200` with `"status":"ok"` when the database is reachable and `503` with
`"status":"degraded"` when it is not.

### Docker

```dockerfile
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Note the `openssl` and `libc6-compat` packages: they are needed by the native
`argon2` and `pg` bindings.

Run migrations as a separate step before starting the container:

```bash
npx prisma migrate deploy
```

### Backups

Everything lives in PostgreSQL. A nightly `pg_dump` is sufficient:

```bash
pg_dump "$DATABASE_URL" -Fc -f backup.dump
```

### Production checklist

- [ ] `SESSION_SECRET` is at least 32 random characters
- [ ] `NODE_ENV=production` (enforces the secret length check)
- [ ] TLS terminated in front of the app
- [ ] `ALLOW_REGISTRATION=0` if you do not want open sign-up
- [ ] `SMTP_FROM_EMAIL` on a domain with SPF/DKIM/DMARC
- [ ] Database backups scheduled and a restore tested
- [ ] `npx prisma migrate deploy` runs as part of your release, not `migrate dev`

---

## Troubleshooting

**"Invalid environment configuration" on startup**
One or more required variables are missing or malformed. The message names each
field. Copy `.env.example` and fill in `DATABASE_URL` and `SESSION_SECRET`.

**"Sending is not configured"**
Expected, not an error. Set the `SMTP_*` variables and restart. Check
**Settings → Outbound email**, which performs a live handshake.

**Integration tests refuse to start**
`TEST_DATABASE_URL` matches `DATABASE_URL`. Point it at a separate database —
the suite truncates every table.

**`prisma migrate dev` reports schema drift**
It needs `SHADOW_DATABASE_URL` pointing at a disposable database.

**Session cookie is not set over HTTP**
`Secure` cookies require HTTPS. This is expected in production and convenient in
development, where `npm run dev` serves over plain HTTP.

**Port 5432 already in use**
Change the host port in `docker-compose.yml` and update `DATABASE_URL` to match.

---

## Licence

MIT.
