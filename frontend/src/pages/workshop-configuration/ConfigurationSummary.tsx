import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router'

import {
  destinationHref,
  type ConfigurationReadiness,
} from '@/features/fiscal/configuration/readiness'

/** Resumen del encabezado: pendientes de configuración y enlace a su subsección. */
export function ConfigurationSummary({
  readiness,
}: {
  readiness: ConfigurationReadiness
}) {
  const box = 'text-body leading-relaxed sm:text-right'

  if (readiness.isLoading) {
    return (
      <p aria-live="polite" className={`${box} text-ink-muted`}>
        Evaluando configuración…
      </p>
    )
  }

  if (readiness.isError) {
    return (
      <p className={`${box} flex items-center gap-1.5 text-danger`}>
        <WarningCircle aria-hidden="true" size={16} weight="bold" />
        No se pudo evaluar el estado de la configuración
      </p>
    )
  }

  if (readiness.pending === 0 || !readiness.firstDestination) {
    return (
      <p className={`${box} flex items-center gap-1.5 font-semibold text-ink`}>
        <CheckCircle
          aria-hidden="true"
          className="text-success"
          size={16}
          weight="bold"
        />
        Sin pendientes de configuración
      </p>
    )
  }

  const count = readiness.pending
  return (
    <div className={box}>
      <p className="font-semibold text-ink">Configuración con pendientes</p>
      <Link
        className="font-medium text-accent hover:text-accent-strong hover:underline"
        replace
        to={destinationHref(readiness.firstDestination)}
      >
        {count === 1 ? '1 pendiente' : `${count} pendientes`} en Facturación
        electrónica
      </Link>
    </div>
  )
}
