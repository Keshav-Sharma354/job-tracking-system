# syntax=docker/dockerfile:1
#
# Job Search CRM — production image.
#
# Built for `docker compose up`, where Postgres and Mailpit are sibling
# containers. Three stages keep the runtime layer free of dev dependencies and
# of anything the build only needs once (source files, Prisma CLI, toolchain).
#
#   deps    installs the full dependency tree (needed to build)
#   build   generates the Prisma client and runs `next build`
#   runtime prunes to production deps and runs `next start`
#
# The README's "Deployment -> Docker" snippet is the same shape; this version
# adds the pruned-deps stage and the entrypoint that applies migrations.

# ---------------------------------------------------------------------------
# deps — full install, using the lockfile for reproducible builds
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# build — generate the Prisma client, then compile Next.js
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
# openssl is required by Prisma's engine; libc6-compat by the native argon2
# and pg bindings. Both are needed at build time as well as runtime.
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` writes to src/generated/prisma (see prisma/schema.prisma),
# which the build then imports through the "@/generated/prisma/*" alias.
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# runtime — only what is needed to serve traffic
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat

# Start from the build's tree, then drop dev dependencies. `npm prune --omit=dev`
# keeps the native modules and the Prisma engine already compiled for this image.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/next.config.ts ./next.config.ts
COPY package.json package-lock.json ./
RUN npm prune --omit=dev

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Run unprivileged. The node image already ships a `node` user.
USER node

EXPOSE 3000

# Readiness is the app's own /api/health, which returns 503 when Postgres is
# unreachable. `next start` binds 0.0.0.0 by default, so no --hostname is needed.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "start"]
