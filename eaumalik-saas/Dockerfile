# filepath: eaumalik-saas/Dockerfile
# ============================================================================
# EAUMALIK SARL — Build production Next.js (multi-stage)
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat pour pdfkit / jimp sous Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
RUN npm run build

# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Fichiers statiques + build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/data-store ./data-store
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3100

# tini = init propre (PID 1, gestion signaux, zombies)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/" >/dev/null || exit 1
