import { CalendarBlank } from '@phosphor-icons/react'

/** Fecha y hora del registro en la zona del negocio; `—` si falta. */
export function recordTimestamp(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Pie gris de un panel de ficha con las fechas de alta y última modificación. */
export function RecordFooter({
  createdAt,
  updatedAt,
}: {
  createdAt: string
  updatedAt: string
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-subtle px-4 py-2 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <CalendarBlank aria-hidden="true" size={14} />
        Creado {recordTimestamp(createdAt)}
      </span>
      <span>Actualizado {recordTimestamp(updatedAt)}</span>
    </p>
  )
}
