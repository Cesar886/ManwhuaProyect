import AppLayout from '@/components/AppLayout'
import ManhwaCardSkeleton from '@/components/ManhwaCardSkeleton'

export default function Loading() {
  return (
    <AppLayout>
      <div className="siteContainer" style={{ padding: '2rem 0' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            height: '3rem',
            width: '300px',
            background: 'var(--skeleton-bg)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '0.5rem',
          }} />
          <div style={{
            height: '1.5rem',
            width: '400px',
            background: 'var(--skeleton-bg)',
            borderRadius: 'var(--radius-md)',
          }} />
        </div>

        {/* Grid de skeletons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1.5rem',
        }}>
          <ManhwaCardSkeleton count={8} />
        </div>
      </div>
    </AppLayout>
  )
}
