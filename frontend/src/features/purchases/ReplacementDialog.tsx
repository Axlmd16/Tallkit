import { useState, type RefObject } from 'react'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import { Button, Dialog, InlineNotice } from '@/shared/ui'

import { usePurchaseMutations } from './hooks'
import type { Purchase } from './types'

/** Crea un borrador de reemplazo que reutiliza la identidad del documento anulado. */
export function ReplacementDialog({
  purchase,
  open,
  onClose,
  onCreated,
  returnFocusRef,
}: {
  purchase: Purchase
  open: boolean
  onClose: () => void
  onCreated: (id: number) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = usePurchaseMutations()
  const tracker = useIntentTracker()
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    if (pending) return
    setPending(true)
    setProblem(null)
    try {
      const created = await tracker.run({ id: purchase.id }, (key) =>
        mutations.replacement.mutateAsync({ id: purchase.id, key }),
      )
      onCreated(created.id)
    } catch (error) {
      setProblem(describeProblem(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      description="El reemplazo conserva el documento externo, recibe un número interno nuevo al confirmarse y solo puede confirmarse si el antecedente está anulado."
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Crear ingreso de reemplazo"
    >
      <div className="space-y-4">
        <p className="text-ink">
          Se copiarán las líneas del ingreso{' '}
          <strong>{purchase.internal_number ?? `#${purchase.id}`}</strong> a un
          borrador nuevo vinculado a él.
        </p>
        {purchase.state !== 'VOIDED' && (
          <InlineNotice title="El antecedente sigue vigente" tone="warning">
            Podrá preparar el borrador, pero no confirmarlo mientras este
            ingreso no esté anulado.
          </InlineNotice>
        )}
        {problem && (
          <InlineNotice title="No se creó el reemplazo" tone="danger">
            {problem.message}
          </InlineNotice>
        )}
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() => void submit()}
            type="button"
          >
            {pending ? 'Creando…' : 'Crear borrador de reemplazo'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
