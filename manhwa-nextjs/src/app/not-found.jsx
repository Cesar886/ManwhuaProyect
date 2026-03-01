'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { slugifyQuery } from '@/hooks/useIA';
import classes from '@/components/404.module.css';

const ChatIA = dynamic(() => import('@/components/ia-minicpm'), { ssr: false });

export default function NotFound() {
    const router = useRouter();
    const [navigating, setNavigating] = useState(false);

    const handleIASearch = useCallback((pregunta) => {
        const slug = slugifyQuery(pregunta);
        setNavigating(true);
        router.prefetch(`/busqueda-ia/${slug}`);
        router.push(`/busqueda-ia/${slug}`);
    }, [router]);

    return (
        <AppLayout>
            <div className={classes.root}>
                {/* Icono sparkle principal */}
                <div className={classes.heroIcon}>
                    <svg className={classes.heroIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                    </svg>
                </div>

                {/* Headline con badge 404 discreto */}
                <h1 className={classes.headline}>
                    <span className={classes.errorBadge}>404</span>
                    Parece que te perdiste
                </h1>

                <p className={classes.subtitle}>
                    Esta página no existe, pero nuestra IA puede llevarte
                    exactamente a donde necesitas ir.
                </p>

                {/* Buscador IA — el protagonista */}
                <div className={classes.searchSection}>
                    <div className={classes.searchCard}>
                        <div className={classes.searchHeader}>
                            <svg className={classes.searchHeaderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                            </svg>
                            <span className={classes.searchHeaderText}>
                                Pregúntale a la IA adónde ir
                            </span>
                            <span className={classes.searchHeaderBadge}>IA Imperial</span>
                        </div>

                        <ChatIA
                            onSearch={handleIASearch}
                            loading={navigating}
                            explanation={null}
                            onClear={null}
                        />
                    </div>
                </div>

                {/* Links secundarios — discretos abajo */}
                <div className={classes.footerLinks}>
                    <Link href="/home" className={classes.footerLink}>
                        <svg className={classes.footerLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Inicio
                    </Link>
                    <span className={classes.footerDot} />
                    <Link href="/biblioteca" className={classes.footerLink}>
                        <svg className={classes.footerLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                        </svg>
                        Biblioteca
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
