import RankingClient from './RankingClient'
import { SERVER_API_BASE, SITE_URL } from '@/config'
import { generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'

export const revalidate = 600

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

const defaultHeaders = {
    'Accept': 'application/json',
    'Origin': SITE_URL,
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
}

async function fetchRanking(path) {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        const res = await fetch(`${SERVER_API_BASE}/${path}`, {
            headers: defaultHeaders,
            next: { revalidate: 600 },
            signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!res.ok) {
            console.warn(`[Ranking] API error ${path}: ${res.status}`)
            return []
        }
        const result = await res.json()
        return result.data?.users || []
    } catch (err) {
        console.error(`[Ranking] Fetch error ${path}:`, err.message)
        return []
    }
}

export default async function RankingPage() {
    const [topStreak, topXp] = await Promise.all([
        fetchRanking('users/top-streak'),
        fetchRanking('users/top-xp'),
    ])

    const breadcrumbJsonLd = generateBreadcrumbJsonLd([
        { name: 'Inicio', url: '/home' },
        { name: 'Ranking', url: '/ranking' },
    ])

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <RankingClient topStreak={topStreak} topXp={topXp} />
        </>
    )
}
