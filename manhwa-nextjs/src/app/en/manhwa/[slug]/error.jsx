'use client'

export default function EnManhwaError({ error, reset }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Something went wrong!</h2>
      <p>{error?.message || 'Failed to load manhwa'}</p>
      <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  )
}
