import type { ReactNode } from 'react'
import { Link } from 'react-router'

export type StatTileTone = 'neutral' | 'danger'

export interface StatTileProps {
  label: string
  /** Valor ya formateado: un conteo, un importe con `Money` o una fecha. */
  value: ReactNode
  /** Dato breve bajo el valor. */
  detail?: ReactNode
  /** `danger` resalta lo que se debe; no se usa para decorar. */
  tone?: StatTileTone
  /** Lista que explica el número; con ella todo el indicador es un enlace. */
  to?: string
}

const tones: Record<StatTileTone, string> = {
  neutral: 'border-line bg-surface text-ink',
  danger: 'border-danger/25 bg-danger-soft text-danger',
}

/**
 * Indicador suelto de una cabecera: etiqueta pequeña y valor grande en su propia tarjeta. Se
 * agrupa en `StatTiles`, que reparte el ancho. Mientras carga, la página pasa `value="—"`.
 */
export function StatTile({
  label,
  value,
  detail,
  tone = 'neutral',
  to,
}: StatTileProps) {
  const body = (
    <>
      <span
        className={`text-label font-semibold ${tone === 'danger' ? '' : 'text-ink-muted'}`}
      >
        {label}
      </span>
      <span className="text-page leading-tight font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      {detail && (
        <span
          className={`text-label ${tone === 'danger' ? '' : 'text-ink-muted'}`}
        >
          {detail}
        </span>
      )}
    </>
  )
  const base = `flex h-full flex-col gap-1 rounded-card border px-4.5 py-3.5 ${tones[tone]}`
  return to ? (
    <Link className={`${base} transition-colors hover:border-ink/30`} to={to}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}

/** Fila de indicadores que reparte el ancho y baja de línea en pantallas estrechas. */
export function StatTiles({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(
    Boolean,
  )
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3"
    >
      {items.map((child, index) => (
        <li key={index}>{child}</li>
      ))}
    </ul>
  )
}
