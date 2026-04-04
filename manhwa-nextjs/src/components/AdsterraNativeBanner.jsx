'use client';

import AdsterraBannerDisplay from '@/components/AdsterraBannerDisplay';

// Compat wrapper: keeps old imports working while using the new banner implementation.
export default function AdsterraNativeBanner(props) {
  return <AdsterraBannerDisplay {...props} />;
}
