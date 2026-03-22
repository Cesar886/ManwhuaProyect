'use client'
import RouteError from '@/components/RouteError'
export default function BibliotecaError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error cargando la biblioteca" />
}
