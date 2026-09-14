import {
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { IconButton } from '../actions'
import { Icon } from '../icons'
import { trapFocus, useModalOpen } from './modal-utils'

export interface ModalProps {
  children: ReactNode
  title: string
  description?: string | undefined
  open: boolean
  onClose: () => void
  actions?: ReactNode | undefined
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
  className?: string | undefined
  portalContainer?: HTMLElement | null | undefined
}

export function Modal({
  actions,
  children,
  className = '',
  description,
  onClose,
  open,
  portalContainer,
  returnFocusRef,
  title,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useModalOpen({
    containerRef: modalRef,
    open,
    returnFocusRef,
  })

  if (!open) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    trapFocus(event, modalRef.current)
  }

  const target =
    portalContainer ?? (typeof document !== 'undefined' ? document.body : null)
  if (!target) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`w-full max-w-[466px] rounded-dialog bg-surface p-5 sm:p-6 text-ink shadow-overlay overflow-y-auto max-h-[min(90vh,45rem)] ${className}`.trim()}
        onKeyDown={handleKeyDown}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line pb-3 mb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-ink" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-ink-muted" id={descriptionId}>
                {description}
              </p>
            )}
          </div>

          <IconButton
            icon={<Icon name="x" size={18} />}
            label="Cerrar modal"
            onClick={onClose}
            shape="circle"
          />
        </header>

        <div className="modal-content text-sm text-ink mb-6">{children}</div>

        {actions && (
          <footer className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-line">
            {actions}
          </footer>
        )}
      </div>
    </div>,
    target,
  )
}
