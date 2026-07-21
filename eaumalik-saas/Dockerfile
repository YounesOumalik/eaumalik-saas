# syntax=docker/dockerfile:1.7
# ============================================================================
# EAUMALIK SARL — Build production Next.js (multi-stage, standalone)
#
# Mode "standalone" activé dans next.config.mjs : Next.js trace les
# imports runtime et produit un bundle minimal dans .next/standalone
# (node_modules minimal + server.js). C'est la voie officielle
# recommandée par Vercel pour Docker (cf. examples/with-docker/).
#
# Tailles approximatives :
#   - Mode npm start classique : ~1 GB
#   - Mode standalone          : ~150 MB
#
# BuildKit cache mounts (`--mount=type=cache`) accélèrent les rebuilds
# de 50-70 % en réutilisant ~/.npm et /app/.next/cache entre les builds.
# ============================================================================

# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat pour pdfkit / jimp sous Alpine (musl vs glibc)
RUN apk add --no-cache libc6-compat

# Copie ciblée pour profiter du cache Docker sur package*.json
COPY package.json package-lock.json* ./

# BuildKit cache mount : ~/.npm persiste entre builds
#
# On utilise `npm install` plutôt que `npm ci` car le repo ne contient
# pas `package-lock.json` (volontairement gitignoré — cf. .gitignore).
# `npm install` est plus lent que `npm ci` mais résout les dépendances
# à partir de package.json uniquement. Le cache BuildKit ~/.npm garde
# les paquets téléchargés entre builds.
RUN npm install --no-audit --no-fund --prefer-offline

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
# 2026-07-21: bumpé à 2 pour forcer un rebuild propre après avoir détecté
# qu'un bundle pdfjs-dist stale (4.10.38) restait dans le cache webpack de
# BuildKit, mismatch avec le worker (4.7.76).
ARG CACHE_BUST=2

# Next.js inline `process.env.NEXT_PUBLIC_*` dans le bundle client au build.
# On injecte uniquement ces valeurs publiques par ARG/ENV. Les fichiers
# .env complets et les secrets serveur restent hors du contexte et des
# couches Docker ; ils sont fournis au conteneur uniquement au runtime.
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

# Build Next.js avec cache de compilation BuildKit. La référence explicite à
# CACHE_BUST garantit qu'un nouveau déploiement régénère les pages ISR même
# lorsque le code source n'a pas changé.
RUN --mount=type=cache,target=/app/.next/cache \
    echo "$CACHE_BUST" > /tmp/eaumalik-cache-bust && \
    npm run build

# ----------------------------------------------------------------------------
# Stage runner : standalone. On copie uniquement les fichiers
# tracés par Next.js dans .next/standalone + les assets statiques.
# Taille finale typique : ~150 MB (vs ~1 GB en mode npm start).
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat tini wget && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# sharp est une dépendance applicative déclarée dans package.json. Next.js
# l'inclut donc dans le traçage standalone ci-dessous, sans seconde version ni
# couche npm redondante dans l'image finale.

# .next/standalone contient le serveur Node.js + uniquement les
# dépendances runtime (node_modules filtré par file tracing).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# .next/static contient les chunks JS/CSS et images optimisées
# servies directement par Next.js (mises en cache par Nginx/Caddy).
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Public (favicon, robots.txt, images statiques non traitées par
# Next.js Image Optimization).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# pdfkit : exclu du bundle via serverComponentsExternalPackages
# (voir next.config.mjs), ses polices AFM (Helvetica, Courier,
# Times) sont chargées via __dirname. On copie donc le package
# complet pour que la résolution de chemin fonctionne.
COPY --from=builder /app/node_modules/pdfkit ./node_modules/pdfkit

# data-store : fallback JSON local utilisé par localDb.ts quand
# Supabase n'est pas accessible. Le dossier doit appartenir à
# nextjs pour qu'il puisse écrire dedans à l'exécution.
# On crée le dossier + un .gitkeep et on fixe le owner.
RUN mkdir -p /app/data-store && \
    chown -R nextjs:nodejs /app/data-store && \
    echo '{"_comment":"dossier data-store monté au runtime si nécessaire"}' > /app/data-store/.gitkeep && \
    chown nextjs:nodejs /app/data-store/.gitkeep

USER nextjs
EXPOSE 3100

# tini = init propre (PID 1, gestion signaux, zombies)
ENTRYPOINT ["/sbin/tini", "--"]
# Next.js 14.2.35 standalone : le flag CLI --hostname est IGNORÉ si
# process.env.HOSTNAME est déjà défini. On laisse donc ENV HOSTNAME=0.0.0.0
# (défini plus haut) faire le travail, et deploy.sh force -e HOSTNAME=0.0.0.0
# au docker run pour garantir l'écoute sur toutes les interfaces.
CMD ["node", "server.js", "--port", "3100"]

# Healthcheck : wget (déjà installé ci-dessus pour ne pas ajouter curl).
# Pointe vers /api/auth/captcha (léger, sans optimisation d'image)
# plutôt que vers / qui dépend de sharp.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3100}/api/auth/captcha" >/dev/null || exit 1
