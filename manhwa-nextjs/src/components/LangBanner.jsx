'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';

export default function LangBanner() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const shouldShow = sessionStorage.getItem('showLangBanner');
    if (shouldShow) setShow(true);
  }, []);

  const goEnglish = () => {
    Cookies.set('preferred_lang', 'en', { expires: 365 });
    setShow(false);

    const enPath = pathname.startsWith('/manhwa')
      ? pathname
          .replace('/manhwa', '/en/manhwa')
          .replace('/capitulo/', '/chapter/')
      : '/en';

    router.push(enPath);
  };

  const staySpanish = () => {
    Cookies.set('preferred_lang', 'es', { expires: 365 });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="lang-banner">
      <p>Would you like to switch to English?</p>
      <button onClick={goEnglish}>Switch to English</button>
      <button onClick={staySpanish}>Stay in Spanish</button>
    </div>
  );
}