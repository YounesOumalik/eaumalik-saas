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
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: " + [...imgHosts, 'https:'].join(' '),
      `connect-src 'self' ${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ''} https://raw.githubusercontent.com`,
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
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
