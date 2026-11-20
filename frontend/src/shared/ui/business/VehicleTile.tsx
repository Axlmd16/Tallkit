import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { GaugeMotif } from '../brand'
import { PlateTag } from './PlateTag'

export interface VehicleTileProps {
  plate: string
  /** Dato pequeño arriba a la derecha, por ejemplo el número del mantenimiento. */
  corner?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Pie: a la izquierda un dato de contexto y a la derecha un importe o un estado. */
  footer?: ReactNode
  footerEnd?: ReactNode
  to?: string
  className?: string
}

/**
 * Tarjeta grafito de un vehículo: placa invertida, nombre, modelo y un pie corto. Se usa en
 * «En el taller ahora» y en los vehículos de un cliente. Con `to` toda la tarjeta es un enlace.
 */
export function VehicleTile({
  plate,
  corner,
  title,
  subtitle,
  footer,
  footerEnd,
  to,
  className = '',
}: VehicleTileProps) {
  const body = (
    <>
      <GaugeMotif
        className="absolute -right-8 -bottom-6 w-40 opacity-60"
        variant="card"
      />
      <div className="relative flex items-center justify-between gap-2">
        <PlateTag onDark plate={plate} />
        {corner && (
          <span className="code text-label text-graphite-ink">{corner}</span>
        )}
      </div>
      <div className="relative min-w-0 leading-snug">
        <div className="truncate font-bold">{title}</div>
        {subtitle && (
          <div className="truncate text-label text-graphite-ink">
            {subtitle}
          </div>
        )}
      </div>
      {(footer || footerEnd) && (
        <div className="relative mt-auto flex items-center justify-between gap-2 text-label text-graphite-ink">
          <span className="min-w-0 truncate">{footer}</span>
          {footerEnd && (
            <span className="text-body font-semibold text-white">
              {footerEnd}
            </span>
          )}
        </div>
      )}
    </>
  )
  const base = `relative flex min-h-36 flex-col gap-2.5 overflow-hidden rounded-card bg-graphite px-4.5 py-4 text-white ${className}`
  return to ? (
    <Link
      className={`${base} transition-transform duration-150 hover:-translate-y-0.5 hover:text-white motion-reduce:transition-none`}
      to={to}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}
