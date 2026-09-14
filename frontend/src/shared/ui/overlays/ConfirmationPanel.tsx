import {
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { Button } from '../controls'
import { trapFocus, useModalOpen } from './modal-utils'

export type ConfirmationWidth = '658' | '726'
export type ConfirmationTone = 'primary' | 'danger' | 'warning'

export interface ConfirmationPanelProps {
  title: string
  description: string
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string | undefined
  cancelLabel?: string | undefined
  tone?: ConfirmationTone | undefined
  width?: ConfirmationWidth | undefined
  children?: ReactNode | undefined
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
  className?: string | undefined
}

const widthClasses: Record<ConfirmationWidth, string> = {
  '658': 'max-w-[658px]',
  '726': 'max-w-[726px]',
}

export function ConfirmationPanel({
  cancelLabel = 'Cancelar',
  children,
  className = '',
  confirmLabel = 'Confirmar',
  description,
  onCancel,
  onConfirm,
  open,
  returnFocusRef,
  title,
  tone = 'primary',
  width = '658',
}: ConfirmationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useModalOpen({
    containerRef: panelRef,
    open,
    returnFocusRef,
  })

  if (!open) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
      return
    }
    trapFocus(event, panelRef.current)
  }

  const target = typeof document !== 'undefined' ? document.body : null
  if (!target) return null

  const widthClass = widthClasses[width]

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`w-full ${widthClass} rounded-dialog bg-surface p-6 sm:p-8 text-ink shadow-overlay overflow-y-auto max-h-[min(90vh,45rem)] ${className}`.trim()}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="mb-4">
          <h2 className="text-xl font-bold text-ink" id={titleId}>
            {title}
          </h2>
          <p className="mt-2 text-sm text-ink-muted" id={descriptionId}>
            {description}
          </p>
        </header>

        {children && <div className="mb-6 text-sm text-ink">{children}</div>}

        <footer className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-line">
          <Button onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            variant={tone === 'danger' ? 'danger' : 'primary'}
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>,
    target,
  )
}
