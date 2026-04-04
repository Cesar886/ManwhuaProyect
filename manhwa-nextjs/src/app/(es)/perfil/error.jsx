'use client'
import RouteError from '@/components/RouteError'
export default function PerfilError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error cargando tu perfil" />
}
