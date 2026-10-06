import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { formatMoney, Money } from '../business/Money'
import { ScopeLabel, type ScopeLabelScope } from '../business/ScopeLabel'

const scopeNames: Record<ScopeLabelScope, string> = {
  commercial: 'RUC comercial',
  artesanal: 'RUC artesanal',
}

export interface StatLinkProps {
  /** Lista o pantalla a la que conduce el indicador. */
  to: string
  label: string
  /** Conteo. Use `amount` cuando el valor sea un importe. */
  value?: number | undefined
  /** Importe decimal exacto que entrega el servidor. */
  amount?: string | undefined
  scope?: ScopeLabelScope | undefined
  /** Dato secundario breve, por ejemplo «2 clientes». */
  detail?: string | undefined
  icon?: ReactNode | undefined
}

/**
 * Indicador con conteo: un valor, su etiqueta y, si es económico, su ámbito fiscal. Es un
 * enlace a la lista que explica el número. Pensado para agruparse en `StatGrid`, dentro de un
 * panel: no lleva sombra ni borde de tarjeta propios.
 */
export function StatLink({
  to,
  label,
  value,
  amount,
  scope,
  detail,
  icon,
}: StatLinkProps) {
  const isZero =
    amount === undefined ? (value ?? 0) === 0 : Number(amount) === 0
  const spoken = [
    `${amount === undefined ? (value ?? 0) : (formatMoney(amount) ?? '—')} ${label}`,
    scope && scopeNames[scope],
    detail,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      aria-label={spoken}
      className="group flex h-full min-h-11 flex-col gap-1.5 px-4 py-3.5 hover:bg-surface-subtle focus-visible:bg-accent-soft"
      to={to}
    >
      <span className="flex min-h-[18px] items-center justify-between gap-2">
        {scope ? <ScopeLabel scope={scope} /> : <span />}
        {icon && (
          <span
            aria-hidden="true"
            className="text-ink-muted group-hover:text-accent"
          >
            {icon}
          </span>
        )}
      </span>
      <span
        className={`text-[26px] leading-8 font-bold tabular-nums ${isZero ? 'text-ink-muted' : 'text-ink'}`}
        data-zero={isZero || undefined}
      >
        {amount === undefined ? (
          (value ?? 0)
        ) : (
          <Money amount={amount} className="!text-left" />
        )}
      </span>
      <span className="text-[13px] font-medium text-ink group-hover:text-accent">
        {label}
      </span>
      {detail && <span className="text-xs text-ink-muted">{detail}</span>}
    </Link>
  )
}

/**
 * Rejilla de indicadores relacionados dentro de un mismo panel: separados por líneas finas y
 * comparables entre sí, sin una tarjeta por dato.
 */
export function StatGrid({
  children,
  label,
  columns = 4,
  stackOnWide = false,
}: {
  children: ReactNode
  label: string
  columns?: 2 | 4
  /** En un panel estrecho de escritorio, apila los indicadores en una columna. */
  stackOnWide?: boolean
}) {
  const items = Array.isArray(children) ? children.flat() : [children]
  return (
    <div className="overflow-hidden">
      <ul
        aria-label={label}
        className={`-mr-px -mb-px grid grid-cols-2 ${columns === 4 ? 'xl:grid-cols-4' : ''} ${stackOnWide ? 'xl:grid-cols-1' : ''}`}
      >
        {items.filter(Boolean).map((child, index) => (
          <li className="border-r border-b border-line" key={index}>
            {child}
          </li>
        ))}
      </ul>
    </div>
  )
}
