import { X } from '@phosphor-icons/react'
import {
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { IconButton } from '../controls'
import { trapFocus, useModalOpen } from '../overlays/modal-utils'

export interface NavigationPanelProps {
  children: ReactNode
  title: string
  description: string
  open: boolean
  onClose: () => void
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
}

/**
 * Panel temporal de navegación para anchos de teléfono. No es un formulario: no advierte
 * cambios sin guardar y se cierra con Escape, con su control o al pulsar fuera.
 */
export function NavigationPanel({
  children,
  description,
  onClose,
  open,
  returnFocusRef,
  title,
}: NavigationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useModalOpen({ containerRef: panelRef, open, returnFocusRef })

  if (!open || typeof document === 'undefined') return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    trapFocus(event, panelRef.current)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-ink/35"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="mr-auto flex h-full w-[min(20rem,calc(100%-3rem))] flex-col overflow-y-auto bg-surface text-ink shadow-sheet"
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold" id={titleId}>
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted" id={descriptionId}>
              {description}
            </p>
          </div>
          <IconButton
            icon={<X size={18} />}
            label="Cerrar navegación"
            onClick={onClose}
          />
        </header>
        <div className="flex-1 px-3 py-3">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
