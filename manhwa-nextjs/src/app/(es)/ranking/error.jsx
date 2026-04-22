'use client'
import RouteError from '@/components/RouteError'
export default function PopularesError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error cargando populares" />
}
