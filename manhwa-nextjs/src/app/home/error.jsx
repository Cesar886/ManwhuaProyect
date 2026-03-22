'use client'
import RouteError from '@/components/RouteError'
export default function HomeError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error cargando el inicio" />
}
