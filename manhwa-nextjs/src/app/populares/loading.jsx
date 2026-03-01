import AppLayout from '@/components/AppLayout'

function SkeletonSection({ cardWidth = 160 }) {
    return (
        <div style={{ marginBottom: '2.5rem' }}>
            {/* Section header skeleton */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-lg, 0.75rem)',
                    background: 'var(--skeleton-bg, rgba(255,255,255,0.06))',
                    flexShrink: 0,
                }} />
                <div>
                    <div style={{
                        height: '1.2rem',
                        width: '180px',
                        background: 'var(--skeleton-bg, rgba(255,255,255,0.06))',
                        borderRadius: '0.5rem',
                        marginBottom: '0.3rem',
                    }} />
                    <div style={{
                        height: '0.7rem',
                        width: '280px',
                        background: 'var(--skeleton-bg, rgba(255,255,255,0.04))',
                        borderRadius: '0.25rem',
                    }} />
                </div>
            </div>
            {/* Cards skeleton — aspect-ratio 2/3, sin bloque info debajo */}
            <div style={{
                display: 'flex',
                gap: '16px',
                overflow: 'hidden',
            }}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{
                        flexShrink: 0,
                        width: `${cardWidth}px`,
                        aspectRatio: '2/3',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: 'var(--skeleton-bg, rgba(255,255,255,0.06))',
                    }} />
                ))}
            </div>
        </div>
    )
}

export default function Loading() {
    return (
        <AppLayout>
            <div style={{
                maxWidth: '1280px',
                margin: '0 auto',
                padding: '1.5rem 1.25rem 3rem',
            }}>
                <SkeletonSection />
                <SkeletonSection />
                <SkeletonSection />
                <SkeletonSection />
                <SkeletonSection />
                <SkeletonSection />
                <SkeletonSection />
            </div>
        </AppLayout>
    )
}
