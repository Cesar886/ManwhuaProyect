import { SITE_URL } from '@/config'

export async function GET() {
  const body = `# Manhwa Imperial – robots.txt
# Optimizado para motores de búsqueda y crawlers de IA

# ===================================
# REGLAS GENERALES
# ===================================
User-agent: *
Allow: /
Allow: /_next/static/
Allow: /_next/image
Allow: /static/
Allow: /images/
Allow: /assets/
Allow: /favicon.ico
Allow: /manifest.json
Disallow: /api/
Disallow: /_next/data/
Disallow: /admin/
Disallow: /temp/
Disallow: /auth/
Disallow: /private/
Disallow: /*.json$
Disallow: /*?*utm_source=
Disallow: /*?*sessionid=

# ===================================
# MOTORES DE BÚSQUEDA PRINCIPALES
# ===================================

User-agent: Googlebot
Allow: /
Allow: /_next/static/
Allow: /_next/image

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /
Allow: /_next/static/
Allow: /_next/image

User-agent: Slurp
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: Brave-Indexer
Allow: /

User-agent: Yandex
Allow: /

User-agent: Baiduspider
Allow: /

# Naver (motor coreano - importante para manhwa)
User-agent: Yeti
Allow: /

User-agent: Sogou
Allow: /

# ===================================
# CRAWLERS DE INTELIGENCIA ARTIFICIAL
# ===================================

# OpenAI
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

# Anthropic Claude
User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

# Google Gemini
User-agent: Google-InspectionTool
Allow: /

# Meta AI
User-agent: meta-externalagent
Allow: /

User-agent: FacebookBot
Allow: /

# Perplexity AI
User-agent: PerplexityBot
Allow: /

# Cohere AI
User-agent: cohere-ai
Allow: /

# Apple Intelligence
User-agent: Applebot-Extended
Allow: /

User-agent: Applebot
Allow: /

# Amazon Alexa
User-agent: Amazonbot
Allow: /

# Bytespider (TikTok/Bytedance)
User-agent: Bytespider
Allow: /

# Common Crawl (dataset para IA)
User-agent: CCBot
Allow: /

# Diffbot
User-agent: Diffbot
Allow: /

# You.com
User-agent: YouBot
Allow: /

# Neeva
User-agent: Neevabot
Allow: /

# ===================================
# CRAWLERS SOCIALES
# ===================================

User-agent: Twitterbot
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: Pinterestbot
Allow: /

User-agent: TelegramBot
Allow: /

User-agent: WhatsApp
Allow: /

User-agent: Discordbot
Allow: /

# ===================================
# CRAWLERS ACADÉMICOS Y ARCHIVO
# ===================================

User-agent: ia_archiver
Allow: /

User-agent: archive.org_bot
Allow: /

User-agent: citeseerxbot
Allow: /

User-agent: Scrapy
Crawl-delay: 5
Allow: /

# ===================================
# HERRAMIENTAS SEO (con rate limiting)
# ===================================

User-agent: AhrefsBot
Crawl-delay: 10
Allow: /

User-agent: SemrushBot
Crawl-delay: 10
Allow: /

User-agent: rogerbot
Crawl-delay: 10
Allow: /

User-agent: dotbot
Crawl-delay: 10
Allow: /

User-agent: MJ12bot
Crawl-delay: 10
Allow: /

User-agent: SeznamBot
Crawl-delay: 10
Allow: /

# ===================================
# BOTS MALICIOSOS BLOQUEADOS
# ===================================

User-agent: SurveyBot
Disallow: /

User-agent: spbot
Disallow: /

User-agent: NPBot
Disallow: /

User-agent: WebReaper
Disallow: /

User-agent: WebCopier
Disallow: /

User-agent: Offline Explorer
Disallow: /

User-agent: HTTrack
Disallow: /

User-agent: Microsoft.URL.Control
Disallow: /

User-agent: EmailCollector
Disallow: /

User-agent: penthesilea
Disallow: /

# ===================================
# SITEMAP
# ===================================
Sitemap: ${SITE_URL}/sitemap-index.xml
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
