import { Link } from 'react-router'

import { qualificationTarget } from '@/features/home/pendingTargets'
import type { HomePending } from '@/features/home/types'
import { InlineNotice } from '@/shared/ui'

import type { BlockQuery } from './BlockStates'

const longDate = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDay(date: string): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  return longDate.format(new Date(year, month - 1, day))
}

function remaining(days: number): string {
  if (days === 0) return 'Vence hoy'
  return days === 1 ? 'Falta 1 día' : `Faltan ${days} días`
}

/**
 * Aviso de la calificación artesanal por vencer o vencida. No está en el prototipo, pero es un
 * aviso fiscal que el servidor solo entrega al Administrador: se conserva como una franja y
 * desaparece cuando no hay nada que avisar.
 */
export function QualificationBanner({
  query,
}: {
  query: BlockQuery<HomePending>
}) {
  const notice = query.data?.qualification
  if (!notice) return null
  const day = formatDay(notice.expires_on)
  return (
    <InlineNotice
      title={
        notice.expired
          ? `La calificación artesanal venció el ${day}`
          : `La calificación artesanal vence el ${day}`
      }
      tone={notice.expired ? 'danger' : 'warning'}
    >
      <p>
        {notice.expired
          ? 'El taller no puede preparar facturas hasta renovarla.'
          : `${remaining(notice.days_left)}. Renuévela para seguir preparando facturas con IVA 0 %.`}{' '}
        <Link
          className="font-semibold underline"
          to={qualificationTarget(notice.entity_id)}
        >
          Revisar la calificación
        </Link>
      </p>
    </InlineNotice>
  )
}
