#!/bin/sh
#
# Container entrypoint.
#
# Two jobs, in order:
#
#   1. Wait for Postgres to accept connections. `depends_on: service_healthy`
#      already gates on the healthcheck, but a restart of the database mid-life
#      (or a slow first init) would otherwise crash the app on boot.
#
#   2. Apply pending migrations with `prisma migrate deploy`. `migrate deploy`
#      is idempotent and, unlike `migrate dev`, never tries to detect drift or
#      reset anything — see the production checklist in the README.
#
# Set SKIP_MIGRATIONS=1 to boot without touching the schema (for example when
# migrations are run as a separate release step, as the README recommends).
set -e

if [ "${SKIP_MIGRATIONS}" = "1" ]; then
  echo "[entrypoint] SKIP_MIGRATIONS=1 — not applying migrations."
else
  echo "[entrypoint] Applying database migrations..."
  npx prisma migrate deploy
fi

echo "[entrypoint] Starting: $*"
exec "$@"
