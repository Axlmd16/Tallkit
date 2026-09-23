import { WarningCircle } from '@phosphor-icons/react'
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import { trapFocus, useModalOpen } from './overlays/modal-utils'

export function Dialog({
  children,
  description,
  onClose,
  open,
  returnFocusRef,
  title,
  tone = 'default',
}: {
  children: ReactNode
  description: string
  onClose: () => void
  open: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
  title: string
  /** `danger` para acciones destructivas: anular, desactivar, eliminar. */
  tone?: 'default' | 'danger'
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useModalOpen({
    containerRef: dialogRef,
    open,
    returnFocusRef,
  })

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Escape cierra aunque el foco todavía no haya entrado al panel (por ejemplo, al abrir
  // con Enter); si el panel ya lo atendió, el evento no llega hasta aquí.
  useEffect(() => {
    if (!open) return
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    trapFocus(event, dialogRef.current)
  }

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/45 p-4 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="dialog-panel max-h-[min(90vh,50rem)] w-full max-w-[460px] overflow-y-auto rounded-dialog bg-surface px-5 pt-5 pb-4 text-ink shadow-dialog"
        data-tone={tone}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2
          className="flex items-center gap-2 text-base leading-[22px] font-semibold"
          id={titleId}
        >
          {tone === 'danger' && (
            <WarningCircle
              aria-hidden="true"
              className="shrink-0 text-danger"
              size={20}
            />
          )}
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted" id={descriptionId}>
          {description}
        </p>
        <div className="dialog-actions mt-5 flex flex-wrap justify-end gap-2">
          {children}
        </div>
      </div>
    </div>
  )
}
