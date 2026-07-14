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

# Cache buster : incrémenter ce compteur force la re-
# copie des .env.* + le rebuild de @next/env. Sans ça,
# Docker réutilise le layer caché de la dernière image
# et les éventuelles mises à jour de .env.prod sont
# silencieusement ignorées.
ARG CACHE_BUST=1

# Next.js incline `process.env.NEXT_PUBLIC_*` dans le
# bundle CLIENT au moment du build (webpack DefinePlugin).
# Si ces variables ne sont pas présentes ici, le bundle
# client contient `undefined` à la place, et même un
# `--env-file` côté runtime ne peut plus les fournir
# (elles sont codées en dur dans le JS).
#
# Solution : on charge le fichier .env.prod dans le
# contexte du build via COPY. ATTENTION : Next.js (@next/
# env) reconnait UNIQUEMENT .env, .env.local,
# .env.development, .env.production — PAS .env.prod !
# On copie donc .env.prod sous le nom .env.production
# pour qu'il soit chargé automatiquement par @next/env
# lors du 'npm run build'.
#
# C'est la voie la plus fiable : pas de risque de
# désynchro entre le local et le serveur CI, et le bundle
# client contient bien les NEXT_PUBLIC_* inlinées par
# webpack DefinePlugin.
COPY .env.prod* .env.production* ./

# Fallback ARG/ENV pour les déploiements CI qui passent
# les secrets via `docker build --build-arg` plutôt que
# par fichier. Si COPY .env.prod a déjà posé les vars,
# ces ENV sont sans effet (équivalence).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_USE_MOCKS
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_USE_MOCKS=${NEXT_PUBLIC_USE_MOCKS}

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
