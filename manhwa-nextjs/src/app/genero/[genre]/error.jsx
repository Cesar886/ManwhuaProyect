'use client'
import RouteError from '@/components/RouteError'
export default function GenreError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error cargando el género" />
}
