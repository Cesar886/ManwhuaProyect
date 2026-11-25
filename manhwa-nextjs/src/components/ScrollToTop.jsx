import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function ScrollToTop({ behavior = 'auto' }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const hash = typeof window !== 'undefined' ? window.location.hash : ''

  useEffect(() => {
    // El muro es cronológico ascendente: allí el contenido más nuevo está abajo.
    // La propia vista del muro se encarga de animar hasta el final cuando termina de cargar.
    const isWall = pathname === '/muro' || pathname === '/en/wall'
    if (isWall) return
    try {
      window.scrollTo({ top: 0, left: 0, behavior })
    } catch (e) {
      // fallback for very old browsers
      window.scrollTo(0, 0)
    }
  }, [pathname, search, hash, behavior])

  return null
}
