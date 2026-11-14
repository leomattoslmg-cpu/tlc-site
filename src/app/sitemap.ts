import type { MetadataRoute } from 'next';
import { MENU, SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [...MENU.map((i) => i.href), '/privacidade'].map((p) => ({ url: `${SITE_URL}${p === '/' ? '' : p}` }));
}
