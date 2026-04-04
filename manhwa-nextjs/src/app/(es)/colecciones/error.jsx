'use client'
import RouteError from '@/components/RouteError'
export default function ColeccionesError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error cargando colecciones" />
}
