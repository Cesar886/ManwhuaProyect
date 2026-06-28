export const metadata = {
  title: {
    default: 'Read Manhwa Online Free in English - Manhwa Imperial',
    template: '%s | Manhwa Imperial',
  },
  description: 'Read manhwa online free in English at Manhwa Imperial. AI-powered platform with intelligent search that understands natural language. Thousands of Korean manhwas and webtoons updated daily.',
  keywords: [
    'manhwa in English',
    'read manhwa free',
    'webtoon English',
    'legal manhwa',
    'legal manhwa platform',
    'manhwa online free',
    'read webtoon English',
    'manhwa',
    'read manhwa',
    'manhwa online',
    'best manhwas',
    'romance manhwa',
    'action manhwa',
    'Korean comics',
    'translated manhwa',
    'manhwa library',
    'AI manhwa search',
    'artificial intelligence manhwa',
    'AI manhwa finder',
  ],
  authors: [{ name: 'Manhwa Imperial' }],
  creator: 'Manhwa Imperial',
  publisher: 'Manhwa Imperial',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/en',
    languages: {
      'x-default': '/',
      'es': '/',
      'es-419': '/',
      'en': '/en',
      'en-US': '/en',
    },
  },
  other: {
    rating: 'general',
    'mylead-verification': 'a030d8faf1f6f5c67eabe4c817e326a7',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/en',
    siteName: 'Manhwa Imperial',
    title: 'Manhwa Imperial - Read Manhwa and Webtoons in English | Legal and Free',
    description: 'The leading platform to read manhwa in English, powered by artificial intelligence. AI-powered search, legal, free, secure and with daily updates.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Manhwa Imperial - Read Manhwa in English',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manhwa Imperial - Manhwa in English | Legal and Free',
    description: 'Read manhwa and webtoons in English for free. Legal platform with active DMCA compliance.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function EnLayout({ children }) {
  return <>{children}</>
}
