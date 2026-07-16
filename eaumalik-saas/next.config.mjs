const supabaseHostRaw = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');
const supabaseHost =
  supabaseHostRaw && !supabaseHostRaw.includes('YOUR-PROJECT')
    ? supabaseHostRaw
    : 'db-dev.smartefp.com';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `output: 'standalone'` génère un bundle minimal autonome dans
  // .next/standalone (uniquement les fichiers et node_modules requis
  // au runtime). C'est la voie officielle recommandée pour Docker
  // (voir examples/with-docker/Dockerfile de Next.js) : l'image finale
  // passe de ~1 GB à ~150 MB, et le démarrage du container est ~3x
  // plus rapide car le serveur n'a plus à charger tout node_modules.
  // Note : pdfkit est listé dans serverComponentsExternalPackages
  // (voir plus bas), donc il est exclus du bundle et ses polices
  // AFM (Helvetica/Courier/Times) seront copiées via COPY.
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: supabaseHost },
    ],
  },
  experimental: {
    // Exclure pdfkit du bundle webpack côté serveur pour que __dirname
    // (utilisé pour localiser les polices AFM Helvetica, Courier, Times…)
    // résolve vers node_modules/pdfkit/js/data/ et non .next/server/vendor-chunks/.
    serverComponentsExternalPackages: ['pdfkit'],
    serverActions: {
      // Origin serveur autorisée pour Server Actions.
      // Production : valeur issue de NEXT_PUBLIC_APP_URL. Dev : localhost.
      allowedOrigins:
        process.env.NODE_ENV === 'development'
          ? ['localhost:3000']
          : process.env.NEXT_PUBLIC_APP_URL
            ? [process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')]
            : [],
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Désactiver le cache persistant sur disque en dev. Sur cette machine
      // sous-alimentée en RAM, les écritures de cache sont interrompues (OOM kill)
      // et corrompues (« invalid code lengths set »), produisant des builds .next
      // incomplets (chunks vendor manquants). On recompile depuis la source à
      // chaque fois, sans cache disque, évitant la restauration d'un cache corrompu.
      config.cache = false;
      // Réduire le parallélisme webpack pour limiter le pic de mémoire lors de la
      // compilation de la lourde route '/' (lucide-react + supabase + next).
      config.parallelism = 1;
    }
    return config;
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const imgHosts = ['picsum.photos', 'images.unsplash.com'];
    // CDN externes nécessaires au rendu (fonts, icônes)
    const fontHosts = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];
    // En dev, Next.js + webpack-hot-middleware utilisent eval() pour le HMR.
    // En prod, on garde la CSP durcie (F-07 audit sécurité) : 'unsafe-eval' est INTERDIT.
    const scriptSrc = isProd
      ? "'self' 'unsafe-inline' https://cdn.jsdelivr.net"
      : "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net";

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      // Styles : Google Fonts + FontAwesome
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      // img-src : hôtes explicites uniquement (pas de 'https:' générique qui autorise tout).
      "img-src 'self' data: blob: " + [...imgHosts, 'https://db-dev.smartefp.com'].join(' '),
      // connect-src : uniquement l'hôte Supabase réel (db-dev.smartefp.com) + ws. Pas de *.supabase.co ni raw.githubusercontent.com.
      `connect-src 'self' ${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ''}`,
      // Fonts : autoriser Google Fonts (woff2) + data URIs
      `font-src 'self' data: https://${fontHosts.join(' https://')}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Workers : permettre les blobs pour Web Workers Next.js
      "worker-src 'self' blob:",
      // Iframes : autoriser les fournisseurs de cartographie tiers (Google Maps embed, OpenStreetMap)
      "frame-src 'self' https://www.google.com https://maps.google.com https://www.openstreetmap.org https://*.openstreetmap.org",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          isProd ? { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' } : null,
          { key: 'Content-Security-Policy', value: csp },
        ].filter(Boolean),
      },
    ];
  },
};

export default nextConfig;
