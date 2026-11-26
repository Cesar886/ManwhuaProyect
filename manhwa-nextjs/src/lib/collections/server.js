import { headers } from 'next/headers';
import { SERVER_API_BASE } from '@/config';

const apiBase = `${SERVER_API_BASE.replace(/\/$/, '')}${SERVER_API_BASE.endsWith('/api') ? '' : '/api'}`;

export async function collectionApi(path) {
  const incoming = await headers();
  const response = await fetch(`${apiBase}/${path}`, {
    headers: { cookie: incoming.get('cookie') || '' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.data || null;
}

export const collectionPath = (collection, lang = 'es') =>
  `${lang === 'en' ? '/en/collection' : '/coleccion'}/${collection.publicId}-${collection.slug}`;

export const minimumTitles = Math.max(1, Number.parseInt(process.env.MIN_INDEXABLE_COLLECTION_TITLES, 10) || 5);
