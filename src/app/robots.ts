import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/connexion', '/apercu', '/design'] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
