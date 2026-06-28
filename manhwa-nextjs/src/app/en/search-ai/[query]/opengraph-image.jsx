import { ImageResponse } from 'next/og';

// Dynamic OG image for /en/search-ai/[query].
// Queries the AI engine with the real query, takes the first 3 cover URLs and
// composes them next to the search title + "Imperial AI" branding.

export const alt = 'Manhwa Imperial — Imperial AI: search results';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
// Cache the generated image for 24h at the CDN; AI results for the same query
// rarely change in that window.
export const revalidate = 86400;

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read';
const FETCH_TIMEOUT_MS = 4500;
const MAX_COVERS = 3;

const PALETTE = {
    bg: '#0F0F14',
    bgHighlight: 'rgba(227, 179, 65, 0.14)',
    accent: '#E3B341',
    accentSoft: 'rgba(227, 179, 65, 0.18)',
    text: '#F5F1E8',
    subtext: 'rgba(245, 241, 232, 0.72)',
    cardBg: '#1A1A22',
};

function humanizeSlug(slug) {
    try {
        return decodeURIComponent(slug || '')
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .slice(0, 80);
    } catch {
        return String(slug || '').slice(0, 80);
    }
}

async function fetchTopResults(query, lang) {
    if (!query) return [];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Lang': lang,
                'X-Skip-History': 'true',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: query }],
                lang,
            }),
            signal: controller.signal,
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = await res.json();
        const series = Array.isArray(data && data.series) ? data.series : [];
        return series
            .slice(0, MAX_COVERS)
            .map((s) => ({
                title: typeof s.title === 'string' ? s.title : '',
                cover: s.coverUrl || s.cover || s.cover_url || null,
            }))
            .filter((s) => s.cover);
    } catch {
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
}

export default async function OpengraphImage({ params }) {
    const { query: slug } = await params;
    const humanQuery = humanizeSlug(slug);
    const displayTitle = humanQuery || 'AI recommendations';
    const covers = await fetchTopResults(humanQuery, 'en');

    const slots = [0, 1, 2].map((i) => covers[i] || null);

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '56px 72px',
                    backgroundColor: PALETTE.bg,
                    backgroundImage: `radial-gradient(ellipse at top right, ${PALETTE.bgHighlight} 0%, transparent 60%)`,
                    color: PALETTE.text,
                    fontFamily: 'system-ui, sans-serif',
                    position: 'relative',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '14px',
                                background: PALETTE.accent,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '30px',
                                fontWeight: 800,
                                color: PALETTE.bg,
                                letterSpacing: '-1.5px',
                            }}
                        >
                            MI
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '22px', fontWeight: 700, color: PALETTE.accent, letterSpacing: '2px', textTransform: 'uppercase' }}>
                                Manhwa Imperial
                            </span>
                            <span style={{ fontSize: '16px', color: PALETTE.subtext, letterSpacing: '0.5px' }}>
                                manhwaimperial.site/en
                            </span>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 22px',
                            borderRadius: '999px',
                            background: PALETTE.accentSoft,
                            border: `1px solid ${PALETTE.accent}`,
                            color: PALETTE.accent,
                            fontSize: '20px',
                            fontWeight: 700,
                            letterSpacing: '1px',
                        }}
                    >
                        <span style={{ display: 'flex', fontSize: '22px' }}>✨</span>
                        Imperial AI
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '1000px' }}>
                    <span style={{ fontSize: '22px', color: PALETTE.subtext, letterSpacing: '2px', textTransform: 'uppercase' }}>
                        AI Search
                    </span>
                    <span
                        style={{
                            fontSize: displayTitle.length > 40 ? '58px' : displayTitle.length > 24 ? '72px' : '86px',
                            fontWeight: 800,
                            lineHeight: 1.05,
                            letterSpacing: '-2px',
                            color: PALETTE.text,
                        }}
                    >
                        “{displayTitle}”
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
                    {slots.map((slot, i) => (
                        <CoverCard key={i} slot={slot} index={i} />
                    ))}

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            flex: 1,
                            paddingBottom: '12px',
                            gap: '8px',
                        }}
                    >
                        <span style={{ fontSize: '24px', color: PALETTE.accent, fontWeight: 700 }}>
                            Top {covers.length || 3} picks
                        </span>
                        <span style={{ fontSize: '18px', color: PALETTE.subtext }}>
                            Semantic engine · English catalog
                        </span>
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
            headers: {
                'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
            },
        },
    );
}

function CoverCard({ slot, index }) {
    const width = 160;
    const height = 230;
    if (!slot || !slot.cover) {
        return (
            <div
                style={{
                    width,
                    height,
                    borderRadius: '14px',
                    background: PALETTE.cardBg,
                    border: `1px solid ${PALETTE.accentSoft}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: PALETTE.subtext,
                    fontSize: '32px',
                    fontWeight: 700,
                }}
            >
                #{index + 1}
            </div>
        );
    }
    return (
        <div
            style={{
                width,
                height,
                borderRadius: '14px',
                overflow: 'hidden',
                display: 'flex',
                position: 'relative',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                border: `1px solid ${PALETTE.accentSoft}`,
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={slot.cover}
                alt=""
                width={width}
                height={height}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: PALETTE.accent,
                    color: PALETTE.bg,
                    fontSize: '16px',
                    fontWeight: 800,
                }}
            >
                {index + 1}
            </div>
        </div>
    );
}
