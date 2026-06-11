# Stage 1: Build
FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Runtime
FROM oven/bun:1-slim AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Required runtime environment variables:
# TURSO_DB_URL    - Turso/libSQL database URL
# TURSO_DB_TOKEN  - Turso/libSQL auth token
# SESSION_SECRET  - Session signing secret (optional, auto-generated if missing)
# CSRF_SECRET     - CSRF signing secret (optional, auto-generated if missing)

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "run", "start"]
