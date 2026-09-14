import { X } from '@phosphor-icons/react'
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { Button, IconButton } from './controls'
import { trapFocus, useModalOpen } from './overlays/modal-utils'

export type DrawerWidth = 'default' | '409' | '369'
export type DrawerOverlay = 'default' | '30' | 'none'

export interface DrawerProps {
  children: ReactNode
  description: string
  title: string
  open: boolean
  onClose: () => void
  hasUnsavedChanges?: boolean | undefined
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
  width?: DrawerWidth | undefined
  overlay?: DrawerOverlay | undefined
  portalContainer?: HTMLElement | null | undefined
  tokenScope?: string | undefined
  className?: string | undefined
}

const widthClasses: Record<DrawerWidth, string> = {
  default: 'md:w-[30rem]',
  409: 'md:w-[409px]',
  369: 'md:w-[369px]',
}

const overlayClasses: Record<DrawerOverlay, string> = {
  default: 'bg-ink/35',
  30: 'bg-ink/30',
  none: 'bg-transparent pointer-events-none',
}

export function Drawer({
  children,
  className = '',
  description,
  hasUnsavedChanges = false,
  onClose,
  open,
  overlay = 'default',
  portalContainer,
  returnFocusRef,
  title,
  tokenScope = '',
  width = 'default',
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useModalOpen({
    containerRef: panelRef,
    open,
    returnFocusRef,
  })

  if (!open) return null

  function requestClose() {
    if (hasUnsavedChanges) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      requestClose()
      return
    }
    trapFocus(event, panelRef.current)
  }

  const targetContainer =
    portalContainer ?? (typeof document !== 'undefined' ? document.body : null)

  if (!targetContainer) return null

  const backdropClass = overlayClasses[overlay]
  const panelWidthClass = widthClasses[width]

  return createPortal(
    <div
      className={`drawer-backdrop fixed inset-0 z-50 ${backdropClass} ${tokenScope}`.trim()}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`drawer-panel ml-auto flex h-full w-full flex-col overflow-y-auto bg-surface p-5 text-ink shadow-overlay md:p-8 pointer-events-auto ${panelWidthClass} ${className}`.trim()}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold" id={titleId}>
              {title}
            </h2>
            <p className="mt-1 text-sm text-ink-muted" id={descriptionId}>
              {description}
            </p>
          </div>
          <IconButton
            icon={<X size={20} />}
            label="Cerrar panel"
            onClick={requestClose}
          />
        </header>

        {confirmClose && (
          <div
            className="mt-5 rounded-group bg-warning-soft p-4 text-warning"
            role="alert"
          >
            <p className="font-bold">Hay cambios sin guardar.</p>
            <p className="mt-1 text-sm">
              Si cierra ahora, perderá los cambios realizados.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={onClose} variant="danger">
                Descartar cambios
              </Button>
              <Button
                onClick={() => setConfirmClose(false)}
                variant="secondary"
              >
                Seguir editando
              </Button>
            </div>
          </div>
        )}

        <div className="drawer-content mt-7 flex-1">{children}</div>
      </div>
    </div>,
    targetContainer,
  )
}
