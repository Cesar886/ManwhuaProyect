'use client'
import RouteError from '@/components/RouteError'
export default function ChapterError({ error, reset }) {
  return <RouteError error={error} reset={reset} title="Error cargando el capítulo" />
}
