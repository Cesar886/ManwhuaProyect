'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const SearchModal = dynamic(() => import('@/components/SearchModal'), {
  ssr: false,
  loading: () => null,
});

/** Keep the search modal code out of the initial route until the user asks for it. */
export default function SearchModalLoader() {
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setRequested(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return requested ? <SearchModal initialOpen /> : null;
}
