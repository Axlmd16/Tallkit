import { useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { Button, InlineNotice, Surface } from '@/shared/ui'

import { useFiscalMutations } from './hooks'
import type { FiscalSourceKind } from './types'

const scopePermission: Record<FiscalSourceKind, string> = {
  COMMERCIAL: 'fiscal.comercial.preparar',
  ARTISAN: 'fiscal.artesanal.preparar',
}

/**
 * Enlace a la preparación fiscal de una operación, disponible solo para el ámbito
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

  if (!session.data?.permissions.includes(scopePermission[sourceKind])) {
    return null
  }

  return (
    <Surface aria-label="Preparación fiscal">
      <h2 className="font-bold text-ink">Preparación fiscal</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Prepare una factura local para esta operación. No se envía al SRI ni obtiene
        autorización; el cobro real se gestiona por separado.
      </p>
      {createPreparation.isError && (
        <div className="mt-3">
          <InlineNotice title="No se pudo iniciar la preparación" tone="warning">
            {createPreparation.error.message}
          </InlineNotice>
        </div>
      )}
      <div className="mt-4">
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
          Preparar factura fiscal
        </Button>
      </div>
    </Surface>
  )
}
