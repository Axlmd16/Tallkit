import { useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { Button, InlineNotice, StatusBadge, Surface } from '@/shared/ui'

import { useActivePreparation, useFiscalMutations } from './hooks'
import type { FiscalSourceKind } from './types'

const scopePermission: Record<FiscalSourceKind, string> = {
  COMMERCIAL: 'fiscal.comercial.preparar',
  ARTISAN: 'fiscal.artesanal.preparar',
}

const STATE_LABELS = {
  DRAFT: 'Borrador fiscal',
  PREPARED: 'Preparación local · Pendiente de emisión',
} as const

/**
 * Acceso a los datos fiscales de una operación, disponible solo para el ámbito
 * autorizado. El resumen de repuestos de una orden no habilita el expediente fiscal
 * comercial al Encargado: sin `fiscal.comercial.preparar` no se muestra la acción.
 */
export function FiscalPreparationLink({
  sourceKind,
  sourceId,
}: {
  sourceKind: FiscalSourceKind
  sourceId: number
}) {
  const session = useSession()
  const navigate = useNavigate()
  const { createPreparation } = useFiscalMutations()
  const allowed = Boolean(
    session.data?.permissions.includes(scopePermission[sourceKind]),
  )
  const active = useActivePreparation(sourceKind, sourceId, allowed)

  if (!allowed) return null
  const current = active.data?.preparation_id ? active.data : null

  return (
    <Surface aria-label="Datos fiscales">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-ink">Datos fiscales</h2>
        {current?.state && (
          <StatusBadge
            label={STATE_LABELS[current.state]}
            shape="pill"
            tone="info"
          />
        )}
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Esta preparación todavía no es una factura electrónica. No ha sido
        firmada ni enviada al SRI. El cobro real se gestiona por separado.
      </p>
      {createPreparation.isError && (
        <div className="mt-3">
          <InlineNotice
            title="No se pudieron preparar los datos fiscales"
            tone="warning"
          >
            {createPreparation.error.message}
          </InlineNotice>
        </div>
      )}
      <div className="mt-4">
        {current ? (
          <Button
            onClick={() =>
              navigate(`/fiscal/preparations/${current.preparation_id}`)
            }
            variant="secondary"
          >
            {current.state === 'DRAFT'
              ? 'Revisar datos para facturación'
              : 'Ver preparación local'}
          </Button>
        ) : (
          <Button
            pending={createPreparation.isPending}
            onClick={() =>
              createPreparation.mutate(
                { sourceKind, sourceId, attemptKey: crypto.randomUUID() },
                {
                  onSuccess: (result) =>
                    navigate(`/fiscal/preparations/${result.preparation_id}`),
                },
              )
            }
          >
            Preparar datos fiscales
          </Button>
        )}
      </div>
    </Surface>
  )
}
