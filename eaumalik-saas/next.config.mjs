/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
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
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    const imgHosts = ['picsum.photos', 'images.unsplash.com'];
    // CDN externes nécessaires au rendu (fonts, icônes)
    const fontHosts = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];
    const csp = [
      "default-src 'self'",
      // 'unsafe-eval' retiré (dev-only, dangereux en prod). 'unsafe-inline' conservé car requis par le SSR Next.js.
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
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
