#!/usr/bin/env node
// ============================================================================
// EAUMALIK — Webhook receiver GitHub → déploiement automatique
//
// Flux (à la Vercel/Hostinger) :
//   1. Tu pousses du code sur `main` via `git push origin main`
//   2. GitHub envoie un POST sur /webhook (configuré dans l'UI repo)
//   3. On vérifie la signature HMAC SHA-256 (anti-spoofing)
//   4. On vérifie que c'est un push sur main
//   5. On lance le script de déploiement (git pull + build + restart)
//   6. On répond 200 à GitHub (sinon il réessaie)
// ============================================================================
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------- Configuration ----------
const PORT = 9000;
const WEBHOOK_SECRET_FILE = '/etc/eaumalik/webhook-secret';
const DEPLOY_SCRIPT = '/opt/eaumalik/deploy-on-push.sh';
const LOG_FILE = '/var/log/eaumalik-webhook.log';
const REPO_DIR = '/opt/eaumalik/repo';
const APP_NAME = 'eaumalik-app';

// ---------- Helpers ----------
function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}\n`;
  process.stdout.write(line);
  try {
    appendFile(LOG_FILE, line, () => {});
  } catch {}
}

function loadSecret() {
  if (!existsSync(WEBHOOK_SECRET_FILE)) {
    log('ERROR', `Secret file missing: ${WEBHOOK_SECRET_FILE}`);
    process.exit(1);
  }
  return readFileSync(WEBHOOK_SECRET_FILE, 'utf8').trim();
}

// Validation signature GitHub : HMAC SHA-256 sur le body brut
function verifySignature(secret, signatureHeader, rawBody) {
  if (!signatureHeader) return false;
  if (!signatureHeader.startsWith('sha256=')) return false;
  const provided = signatureHeader.slice(7);
  const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (provided.length !== computed.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(computed, 'utf8'));
}

// ---------- Server ----------
const server = createServer(async (req, res) => {
  // Healthcheck (pour monitoring externe / load-balancer)
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'eaumalik-webhook' }));
    return;
  }

  // Webhook GitHub
  if (req.method === 'POST' && req.url === '/webhook') {
    // Lire le body brut (nécessaire pour HMAC)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    // 1. Vérifier la signature
    const secret = loadSecret();
    const signature = req.headers['x-hub-signature-256'];
    if (!verifySignature(secret, signature, rawBody)) {
      log('WARN', `Signature invalide depuis ${req.socket.remoteAddress}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }

    // 2. Parser l'événement
    const event = req.headers['x-github-event'];
    if (event !== 'push') {
      log('INFO', `Event ignoré : ${event}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', event }));
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // 3. Vérifier la branche (uniquement main)
    const ref = payload.ref; // ex: "refs/heads/main"
    if (ref !== 'refs/heads/main') {
      log('INFO', `Push ignoré : ref=${ref} (≠ main)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', ref }));
      return;
    }

    const sha = (payload.after || '').slice(0, 7);
    const pusher = payload.pusher?.name || 'unknown';
    log('INFO', `▶ Deploy demandé par ${pusher} (commit ${sha})`);

    // 4. Répondre 202 immédiatement (GitHub n attend pas la fin du build)
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'deploying', sha, pusher }));

    // 5. Lancer le déploiement en arrière-plan
    const child = spawn('bash', [DEPLOY_SCRIPT, sha], {
      cwd: '/',
      env: { ...process.env, DEPLOY_SHA: sha, DEPLOY_PUSHER: pusher },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.unref(); // ne pas bloquer la boucle event-loop

    const tag = `${sha}-${Date.now()}`;
    log('INFO', `▶ Deploy lancé (pid=${child.pid}, tag=${tag})`);

    child.stdout.on('data', (d) => log('DEPLOY', `[stdout] ${d.toString().trim()}`));
    child.stderr.on('data', (d) => log('DEPLOY', `[stderr] ${d.toString().trim()}`));

    child.on('exit', (code) => {
      if (code === 0) {
        log('INFO', `✅ Deploy ${sha} terminé avec succès`);
      } else {
        log('ERROR', `❌ Deploy ${sha} échoué (exit code=${code})`);
      }
    });

    return;
  }

  // 404 par défaut
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  log('INFO', `Webhook server listening on :${PORT}`);
  log('INFO', `Repo dir : ${REPO_DIR}`);
  log('INFO', `Deploy script : ${DEPLOY_SCRIPT}`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('INFO', `Received ${sig}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}

// import dynamique pour éviter le warning top-level
import { appendFile } from 'node:fs';