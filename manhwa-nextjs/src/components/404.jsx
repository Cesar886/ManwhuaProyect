'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLang } from '../hooks/useLang';
import { getLocalizedPath } from '../utils/i18nRoutes';
import { slugifyQuery } from '@/hooks/useIA';
import { getTranslations } from '../i18n/translations';
import classes from './404.module.css';

const ChatIA = dynamic(() => import('./ia-minicpm'), { ssr: false });

export default function NotFound() {
    const router = useRouter();
    const { lang } = useLang();
    const t = getTranslations(lang).notFound;
    const [navigating, setNavigating] = useState(false);

    const handleIASearch = useCallback((pregunta) => {
        const slug = slugifyQuery(pregunta);
        setNavigating(true);
        const targetPath = getLocalizedPath(`/busqueda-ia/${slug}`, lang);
        router.prefetch(targetPath);
        router.push(targetPath);
    }, [router, lang]);

    return (
        <div className={classes.root}>
            <div className={classes.heroIcon}>
                <svg className={classes.heroIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                </svg>
            </div>

            <h1 className={classes.headline}>
                <span className={classes.errorBadge}>404</span>
                {t.youGotLost}
            </h1>

            <p className={classes.subtitle}>
                {t.subtitle}
            </p>

            <div className={classes.searchSection}>
                <div className={classes.searchCard}>
                    <div className={classes.searchHeader}>
                        <svg className={classes.searchHeaderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                        </svg>
                        <span className={classes.searchHeaderText}>
                            {t.askAi}
                        </span>
                        <span className={classes.searchHeaderBadge}>{t.imperialAi}</span>
                    </div>

                    <ChatIA
                        onSearch={handleIASearch}
                        loading={navigating}
                        explanation={null}
                        onClear={null}
                    />
                </div>
            </div>

            <div className={classes.footerLinks}>
                <Link href={getLocalizedPath('/home', lang)} className={classes.footerLink}>
                    <svg className={classes.footerLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    {t.home}
                </Link>
                <span className={classes.footerDot} />
                <Link href={getLocalizedPath('/biblioteca', lang)} className={classes.footerLink}>
                    <svg className={classes.footerLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                    {t.library}
                </Link>
            </div>
        </div>
    );
}
