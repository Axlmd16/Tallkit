import { useState } from 'react'

import { Button, Dialog, InlineNotice } from '@/shared/ui'

import { describeProblem, type ProblemView } from './problem'
import { useReturnFocus } from './useReturnFocus'

export interface StateChange {
  active: boolean
  name: string
  version: number
  id: number
}

/** Confirma baja o reactivación, evita el doble envío y explica el rechazo sin cerrar. */
export function StateChangeDialog({
  change,
  noun,
  deactivateText,
  activateText,
  onConfirm,
  onClose,
}: {
  change: StateChange | null
  noun: string
  deactivateText: string
  activateText: string
  onConfirm: (change: StateChange) => Promise<void>
  onClose: () => void
}) {
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const returnFocus = useReturnFocus(change !== null)

  function close() {
    if (pending) return
    setProblem(null)
    onClose()
  }

  async function confirm() {
    if (!change || pending) return
    setPending(true)
    setProblem(null)
    try {
      await onConfirm(change)
      onClose()
    } catch (error) {
      setProblem(describeProblem(error))
    } finally {
      setPending(false)
    }
  }

  const activating = change?.active === true
  return (
    <Dialog
      description={change ? (activating ? activateText : deactivateText) : ''}
      onClose={close}
      open={change !== null}
      returnFocusRef={returnFocus}
      title={activating ? `Reactivar ${noun}` : `Desactivar ${noun}`}
    >
      {problem && (
        <div className="mt-4">
          <InlineNotice title="No se pudo completar" tone="danger">
            {problem.message}
          </InlineNotice>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          disabled={pending}
          onClick={close}
          type="button"
          variant="quiet"
        >
          Cancelar
        </Button>
        <Button
          aria-busy={pending}
          disabled={pending}
          onClick={confirm}
          type="button"
          variant={activating ? 'primary' : 'danger'}
        >
          {pending
            ? 'Procesando…'
            : problem?.uncertain
              ? 'Reintentar'
              : activating
                ? 'Confirmar reactivación'
                : 'Confirmar desactivación'}
        </Button>
      </div>
    </Dialog>
  )
}
