import { useId, useRef, useState, type ReactNode, type RefObject } from 'react'

import { Button } from '../actions'
import { InlineNotice } from '../states'
import { ConfirmationPanel } from './ConfirmationPanel'
import { Modal, type ModalSize } from './Modal'

type SaveResult = boolean | void
type SaveHandler = () => SaveResult | Promise<SaveResult>

export interface FormModalProps {
  children: ReactNode
  title: string
  open: boolean
  onClose: () => void
  onSave: SaveHandler
  description?: string
  dirty?: boolean
  saveLabel?: string
  /** Impide la acción principal mientras el servidor no la habilite (por ejemplo, una revisión con impedimentos). */
  saveDisabled?: boolean
  /** Salida segura; en flujos de dos pasos nombra lo que ocurre al salir. */
  cancelLabel?: string
  onSaveAndCreateAnother?: SaveHandler
  /** Texto de la acción de crear otro registro; concuerda con el género del sustantivo. */
  createAnotherLabel?: string
  returnFocusRef?: RefObject<HTMLElement | null>
  size?: ModalSize
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'No se pudo guardar. Revise los datos e inténtelo nuevamente.'
}

export function FormModal({
  children,
  description,
  dirty = false,
  onClose,
  onSave,
  onSaveAndCreateAnother,
  createAnotherLabel = 'Guardar y crear otro',
  open,
  returnFocusRef,
  saveLabel = 'Guardar',
  saveDisabled = false,
  cancelLabel = 'Cancelar',
  title,
  size = 'default',
}: FormModalProps) {
  const formId = useId()
  const fieldsRef = useRef<HTMLDivElement>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<'save' | 'another' | null>(
    null,
  )

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  async function runSave(action: 'save' | 'another') {
    const handler = action === 'another' ? onSaveAndCreateAnother : onSave
    if (!handler || pendingAction || saveDisabled) return

    setError('')
    setPendingAction(action)
    try {
      const result = await handler()
      if (result === false) return

      if (action === 'save') {
        onClose()
        return
      }

      requestAnimationFrame(() => {
        const preferred = fieldsRef.current?.querySelector<HTMLElement>(
          '[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        )
        preferred?.focus()
      })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <>
      <Modal
        size={size}
        actions={
          <>
            <Button
              disabled={pendingAction !== null}
              onClick={requestClose}
              variant="secondary"
            >
              {cancelLabel}
            </Button>
            {onSaveAndCreateAnother && (
              <Button
                disabled={pendingAction !== null}
                onClick={() => void runSave('another')}
                pending={pendingAction === 'another'}
                pendingLabel="Guardando…"
                variant="secondary"
              >
                {createAnotherLabel}
              </Button>
            )}
            <Button
              disabled={saveDisabled}
              form={formId}
              pending={pendingAction === 'save'}
              pendingLabel="Guardando…"
              type="submit"
            >
              {saveLabel}
            </Button>
          </>
        }
        className="max-sm:max-w-none max-sm:rounded-none"
        description={description}
        mobileFullWidth
        onClose={requestClose}
        open={open}
        returnFocusRef={returnFocusRef}
        title={title}
      >
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault()
            void runSave('save')
          }}
        >
          {error && (
            <div className="mb-4">
              <InlineNotice title="No se guardaron los cambios" tone="danger">
                {error}
              </InlineNotice>
            </div>
          )}
          <div ref={fieldsRef}>{children}</div>
        </form>
      </Modal>

      <ConfirmationPanel
        cancelLabel="Seguir editando"
        confirmLabel="Descartar"
        description="Los datos que cambió se perderán. Puede seguir editando o descartarlos."
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        open={confirmDiscard}
        title="Hay cambios sin guardar"
        tone="danger"
        width="420"
      />
    </>
  )
}
