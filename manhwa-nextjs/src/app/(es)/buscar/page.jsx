import { Suspense } from 'react';
import { SITE_URL } from '@/config';
import BuscarClient from './BuscarClient';

// Wrapper server component: la UI real está en BuscarClient ('use client') — aquí solo
// se define metadata/JSON-LD/canonical para que Google indexe correctamente.

const BASE_TITLE = 'Buscar Manhwas — Catálogo completo | Manhwa Imperial';
const BASE_DESCRIPTION =
    'Busca manhwas, webtoons y manhuas por título o sinopsis en Manhwa Imperial. Resultados instantáneos, sin IA, sobre nuestro catálogo completo en español.';

export async function generateMetadata({ searchParams }) {
    const sp = (await searchParams) || {};
    const rawQ = typeof sp.q === 'string' ? sp.q : Array.isArray(sp.q) ? sp.q[0] : '';
    const q = rawQ.trim().slice(0, 80);

    const canonical = q
        ? `${SITE_URL}/buscar?q=${encodeURIComponent(q)}`
        : `${SITE_URL}/buscar`;

    const title = q
        ? `Resultados para "${q}" — Buscar Manhwas | Manhwa Imperial`
        : BASE_TITLE;
    const description = q
        ? `Resultados de búsqueda para "${q}" en Manhwa Imperial. Manhwas, webtoons y manhuas relacionados en español.`
        : BASE_DESCRIPTION;

    return {
        title,
        description,
        keywords: [
            'buscar manhwas',
            'búsqueda manhwas',
            'buscar webtoons',
            'manhwas español',
            q ? `manhwas ${q}` : '',
        ].filter(Boolean),
        // Si hay query específica, dejar indexar para capturar long-tail; sin query, también indexable
        // pero sin contenido único — Google lo dejará de baja prioridad sin duplicarse gracias al canonical.
        robots: { index: true, follow: true },
        alternates: {
            canonical,
            // Solo emitimos hreflang si existe variante EN equivalente. Hoy no hay /en/search.
            // Cuando se cree, añadir: languages: { 'es-ES': canonical, 'en-US': `${SITE_URL}/en/search...` }
        },
        openGraph: {
            title,
            description,
            type: 'website',
            url: canonical,
            siteName: 'Manhwa Imperial',
            locale: 'es_ES',
            images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Manhwa Imperial' }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: ['/og-image.png'],
        },
    };
}

function buildSearchJsonLd(q) {
    const canonical = q
        ? `${SITE_URL}/buscar?q=${encodeURIComponent(q)}`
        : `${SITE_URL}/buscar`;
    return {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        url: canonical,
        name: q ? `Resultados para "${q}"` : 'Buscar Manhwas',
        inLanguage: 'es-ES',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: 'Manhwa Imperial' },
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/buscar?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Buscar', item: `${SITE_URL}/buscar` },
                ...(q ? [{ '@type': 'ListItem', position: 3, name: `Resultados: ${q}`, item: canonical }] : []),
            ],
        },
    };
}

export default async function BuscarPage({ searchParams }) {
    const sp = (await searchParams) || {};
    const rawQ = typeof sp.q === 'string' ? sp.q : Array.isArray(sp.q) ? sp.q[0] : '';
    const q = rawQ.trim().slice(0, 80);

    return (
        <>
            <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSearchJsonLd(q)) }}
            />
            <Suspense fallback={null}>
                <BuscarClient />
            </Suspense>
        </>
    );
}
