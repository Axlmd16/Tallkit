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
  mobileFullWidth?: boolean | undefined
  /** Ancho máximo: `default` 466 px, `wide` 600 px para formularios con nombres largos, `media` para imágenes. */
  size?: ModalSize | undefined
}

export type ModalSize = 'default' | 'wide' | 'media'

const sizeClasses: Record<ModalSize, string> = {
  default: 'max-w-[466px]',
  wide: 'max-w-[600px]',
  media: 'max-w-[min(90vw,1100px)]',
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
  mobileFullWidth = false,
  size = 'default',
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
      className={`fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 sm:p-6 ${mobileFullWidth ? 'max-sm:place-items-stretch max-sm:p-0' : 'p-4'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`max-h-[min(90vh,45rem)] w-full ${sizeClasses[size]} overflow-y-auto rounded-dialog bg-surface p-5 text-ink shadow-overlay sm:p-6 ${mobileFullWidth ? 'max-sm:flex max-sm:min-h-dvh max-sm:max-w-none max-sm:flex-col max-sm:rounded-none' : ''} ${className}`.trim()}
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

        <div
          className={`modal-content mb-6 text-sm text-ink ${mobileFullWidth ? 'max-sm:min-h-0 max-sm:flex-1 max-sm:overflow-y-auto' : ''}`}
        >
          {children}
        </div>

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
