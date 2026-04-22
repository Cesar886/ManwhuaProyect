import RankingClient from './RankingClient'
import { SERVER_API_BASE, SITE_URL } from '@/config'
import { generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'

// ============================================================================
// SERVER COMPONENT — Fetches top streak users from backend
//
// ISR: revalidate=600 → reconstruye cada 10 minutos
// ============================================================================

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

const defaultHeaders = {
    'Accept': 'application/json',
    'Origin': SITE_URL,
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
}

async function fetchTopUsers() {
    try {
        const url = `${SERVER_API_BASE}/users/top-streak`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const res = await fetch(url, {
            headers: defaultHeaders,
            next: { revalidate: 600 },
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
            console.warn(`[Ranking] API error: returned ${res.status}`)
            return []
        }

        const result = await res.json()
        return result.data?.users || []
    } catch (error) {
        console.error(`[Ranking] Fetch error:`, error.message)
        return []
    }
}

export const revalidate = 600

export default async function RankingPage() {
    const topUsers = await fetchTopUsers()

    const breadcrumbJsonLd = generateBreadcrumbJsonLd([
        { name: 'Inicio', url: '/home' },
        { name: 'Ranking de Racha', url: '/populares' },
    ])

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <RankingClient topUsers={topUsers} />
        </>
    )
}
