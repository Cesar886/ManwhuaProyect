'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { getSwitchedLangPath } from '@/utils/i18nRoutes';
import { getTranslations } from '@/i18n/translations';

const COOKIE = 'preferred_lang';
const DISMISSED_KEY = 'langBannerDismissed';

/**
 * Banner sugerencia de cambio de idioma.
 * Se muestra cuando:
 *  - El middleware detectó que el navegador prefiere otro idioma y añadió
 *    meta `x-suggest-lang` (expuesto via `<meta name="suggest-lang">` opcional),
 *  - O detectamos via navigator.language que el usuario prefiere otro idioma,
 *  - Y el usuario no ha descartado el banner ni fijado cookie.
 */
export default function LangBanner() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const currentLang = pathname.startsWith('/en') ? 'en' : 'es';
  const [suggest, setSuggest] = useState(null); // 'en' | 'es' | null

  useEffect(() => {
    // Respeta cookie explícita
    if (Cookies.get(COOKIE)) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const browserLang = (navigator.language || 'es').toLowerCase();
    const wantsEn = browserLang.startsWith('en');
    const wantsEs = browserLang.startsWith('es');

    if (currentLang === 'es' && wantsEn) setSuggest('en');
    else if (currentLang === 'en' && wantsEs) setSuggest('es');
  }, [currentLang]);

  if (!suggest) return null;

  // Mostramos el mensaje en el idioma *sugerido* (el que ofrecemos)
  const t = getTranslations(suggest).languageBanner;

  const accept = () => {
    Cookies.set(COOKIE, suggest, { expires: 365, sameSite: 'lax' });
    sessionStorage.setItem(DISMISSED_KEY, '1');
    router.push(getSwitchedLangPath(pathname, currentLang));
  };

  const dismiss = () => {
    Cookies.set(COOKIE, currentLang, { expires: 365, sameSite: 'lax' });
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setSuggest(null);
  };

  return (
    <div className="lang-banner" role="dialog" aria-live="polite">
      <p>{t.message}</p>
      <button type="button" onClick={accept}>{t.switch}</button>
      <button type="button" onClick={dismiss}>{t.stay}</button>
    </div>
  );
}
