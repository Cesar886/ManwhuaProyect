'use client'
import RouteError from '@/components/RouteError'
export default function SearchError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error en la búsqueda" />
}
