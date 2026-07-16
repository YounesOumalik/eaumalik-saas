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

# Build Next.js avec cache de compilation BuildKit.
# .next/cache évite de tout re-transpiler si seul un
# fichier source change. Le --frozen-lockfile est
# implicite via npm ci déjà exécuté dans deps.
RUN npm run build

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

# sharp : requis en mode standalone pour l'optimisation d'images Next.js.
# Sans lui, toute page utilisant next/image renvoie HTTP 500
# ("'sharp' is required to be installed in standalone mode").
# Installé en root avant USER nextjs.
RUN npm install --no-save sharp@0.33.5

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
# Note : en mode standalone, `HOSTNAME=0.0.0.0` n'est PAS respecté
# par Next.js (bug connu). Il faut passer --hostname 0.0.0.0
# explicitement à `node server.js` pour écouter sur toutes les
# interfaces (et non sur 127.0.0.1 uniquement).
CMD ["node", "server.js", "--hostname", "0.0.0.0", "--port", "3100"]

# Healthcheck : wget (déjà installé ci-dessus pour ne pas ajouter curl).
# Pointe vers /api/auth/captcha (léger, sans optimisation d'image)
# plutôt que vers / qui dépend de sharp.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3100}/api/auth/captcha" >/dev/null || exit 1