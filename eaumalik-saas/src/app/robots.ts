import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://eaumalik.ma';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/crm/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
