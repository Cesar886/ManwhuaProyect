import { ImageResponse } from 'next/og';

// Ruta física `/og-image.png` generada dinámicamente con ImageResponse (PNG 1200×630).
// Todas las metadata del sitio referencian `/og-image.png` — al no existir el archivo
// físico en /public, Next.js enruta la petición a este handler y produce un PNG
// optimizado bajo demanda, con cache HTTP largo para CDN.

export const runtime = 'edge';

// Revalidar una vez al día en el CDN — el contenido es estático (branding), no hace falta más.
export const revalidate = 86400;

// Dimensiones del OG image. No se exportan (los Route Handlers sólo aceptan
// exports específicos: GET/POST/runtime/revalidate/etc; `size` y `contentType`
// pertenecen a la convención `opengraph-image.jsx`, no a `route.jsx`).
const size = { width: 1200, height: 630 };

const BRAND = {
    bg: '#0F0F14',
    accent: '#E3B341',
    accentSoft: 'rgba(227, 179, 65, 0.12)',
    text: '#F5F1E8',
    subtext: 'rgba(245, 241, 232, 0.72)',
};

export async function GET() {
    try {
        return new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '72px 88px',
                        background: `radial-gradient(ellipse at top right, ${BRAND.accentSoft} 0%, ${BRAND.bg} 55%), ${BRAND.bg}`,
                        color: BRAND.text,
                        fontFamily: 'system-ui, sans-serif',
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background:
                                'linear-gradient(135deg, transparent 0%, transparent 60%, rgba(227,179,65,0.06) 100%)',
                            display: 'flex',
                        }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div
                            style={{
                                width: '72px',
                                height: '72px',
                                borderRadius: '16px',
                                background: BRAND.accent,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '42px',
                                fontWeight: 800,
                                color: BRAND.bg,
                                letterSpacing: '-2px',
                            }}
                        >
                            MI
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: BRAND.accent }}>
                                Manhwa Imperial
                            </span>
                            <span style={{ fontSize: '18px', color: BRAND.subtext, letterSpacing: '1px' }}>
                                manhwaimperial.site
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
                        <span
                            style={{
                                fontSize: '86px',
                                fontWeight: 800,
                                lineHeight: 1.05,
                                letterSpacing: '-2px',
                                color: BRAND.text,
                            }}
                        >
                            Manhwas en Español
                        </span>
                        <span style={{ fontSize: '34px', color: BRAND.subtext, lineHeight: 1.3 }}>
                            Catálogo legal y gratuito de manhwas, webtoons y manhuas.
                        </span>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '24px',
                            borderTop: `1px solid ${BRAND.accentSoft}`,
                        }}
                    >
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <Badge text="LEGAL · DMCA" />
                            <Badge text="ES · EN" />
                            <Badge text="Actualizado diariamente" />
                        </div>
                        <span style={{ fontSize: '22px', color: BRAND.accent, fontWeight: 600 }}>
                            manhwaimperial.site
                        </span>
                    </div>
                </div>
            ),
            {
                ...size,
                headers: {
                    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
                },
            }
        );
    } catch (err) {
        // Fallback PNG 1×1 transparente si ImageResponse falla (runtime edge, assets, etc.)
        // Mejor servir algo válido que un 500 que rompa todos los previews sociales.
        const transparentPng = Uint8Array.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
            0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82,
        ]);
        return new Response(transparentPng, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=60',
            },
        });
    }
}

function Badge({ text }) {
    return (
        <span
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: '999px',
                background: BRAND.accentSoft,
                color: BRAND.accent,
                fontSize: '18px',
                fontWeight: 600,
                letterSpacing: '0.5px',
            }}
        >
            {text}
        </span>
    );
}
