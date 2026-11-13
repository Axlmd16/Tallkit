import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { Button, IconButton } from '../actions'
import { Icon } from '../icons'
import { trapFocus, useModalOpen } from './modal-utils'

/**
 * `docked`: panel fijo junto al contenido, sin fondo ni bloqueo; el contenido sigue usable.
 * `overlay`: panel superpuesto y modal sobre un fondo oscurecido, con foco atrapado.
 */
export type DrawerMode = 'docked' | 'overlay'
export type DrawerWidth = 'default' | 'wide'

export interface DrawerProps {
  children: ReactNode
  title: string
  description?: string | undefined
  /** Ícono de la cabecera, como en los paneles de sección. */
  icon?: ReactNode | undefined
  open: boolean
  onClose: () => void
  mode?: DrawerMode | undefined
  width?: DrawerWidth | undefined
  /** Pie fijo con las acciones del panel. */
  actions?: ReactNode | undefined
  /** Solo en `overlay`: advierte antes de cerrar y perder cambios. */
  hasUnsavedChanges?: boolean | undefined
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
  portalContainer?: HTMLElement | null | undefined
  className?: string | undefined
}

const dockedWidths: Record<DrawerWidth, string> = {
  default: 'lg:w-[24rem]',
  wide: 'lg:w-[32rem]',
}

/** Separación con el borde inferior: el relleno inferior del área principal (`py-5`). */
const DOCKED_BOTTOM_GAP = 20

const overlayWidths: Record<DrawerWidth, string> = {
  default: 'sm:w-[24rem]',
  wide: 'sm:w-[32rem]',
}

export function Drawer(props: DrawerProps) {
  if (props.mode === 'docked')
    return props.open ? <DockedDrawer {...props} /> : null
  // Se mantiene montado al cerrar para que el foco vuelva al disparador.
  return <OverlayDrawer {...props} />
}

function DrawerHeader({
  title,
  titleId,
  description,
  descriptionId,
  icon,
  onClose,
}: {
  title: string
  titleId: string
  description?: string | undefined
  descriptionId: string
  icon?: ReactNode
  onClose: () => void
}) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-control bg-surface text-accent ring-1 ring-line"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2
            className="text-body font-semibold break-words text-ink"
            id={titleId}
          >
            {title}
          </h2>
          {description && (
            <p className="text-label text-ink-muted" id={descriptionId}>
              {description}
            </p>
          )}
        </div>
      </div>
      <IconButton
        icon={<Icon name="x" size={18} />}
        label="Cerrar panel"
        onClick={onClose}
        shape="circle"
      />
    </header>
  )
}

function DrawerBody({
  children,
  actions,
  notice,
}: {
  children: ReactNode
  actions?: ReactNode
  notice?: ReactNode
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-body text-ink">
        {notice}
        {children}
      </div>
      {actions && (
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line p-4">
          {actions}
        </footer>
      )}
    </>
  )
}

/** Panel fijo en la columna derecha; en pantallas estrechas ocupa la pantalla completa. */
function DockedDrawer({
  actions,
  children,
  className = '',
  description,
  icon,
  onClose,
  title,
  width = 'default',
}: DrawerProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)

  // Queda fijo en la posición donde aparece (arriba de la lista) y llega hasta el borde
  // inferior de la ventana; al desplazar la página no se mueve ni cambia de alto. Solo se
  // recalcula si cambia el tamaño de la ventana.
  useLayoutEffect(() => {
    const panel = panelRef.current
    const anchor = panel?.parentElement
    if (!panel || !anchor) return
    const fit = () => {
      const top = anchor.getBoundingClientRect().top + window.scrollY
      panel.style.setProperty('--drawer-top', `${top}px`)
      panel.style.setProperty(
        '--drawer-height',
        `${Math.max(window.innerHeight - top - DOCKED_BOTTOM_GAP, 240)}px`,
      )
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <aside
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={`flex flex-col overflow-hidden bg-surface max-lg:fixed max-lg:inset-0 max-lg:z-40 lg:sticky lg:top-[var(--drawer-top,1rem)] lg:h-[var(--drawer-height,calc(100dvh-2rem))] lg:shrink-0 lg:self-start lg:rounded-panel lg:border lg:border-line ${dockedWidths[width]} ${className}`.trim()}
      onKeyDown={handleKeyDown}
      ref={panelRef}
    >
      <DrawerHeader
        description={description}
        descriptionId={descriptionId}
        icon={icon}
        onClose={onClose}
        title={title}
        titleId={titleId}
      />
      <DrawerBody actions={actions}>{children}</DrawerBody>
    </aside>
  )
}

/** Panel superpuesto y modal que entra desde el borde derecho. */
function OverlayDrawer({
  actions,
  children,
  className = '',
  description,
  hasUnsavedChanges = false,
  icon,
  onClose,
  open,
  portalContainer,
  returnFocusRef,
  title,
  width = 'default',
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useModalOpen({ containerRef: panelRef, open, returnFocusRef })
  // Al cerrarse, la próxima apertura no debe heredar la advertencia anterior.
  if (!open && confirmClose) setConfirmClose(false)

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

  const target =
    portalContainer ?? (typeof document !== 'undefined' ? document.body : null)
  if (!open || !target) return null

  const notice = confirmClose && (
    <div
      className="mb-4 rounded-control bg-warning-soft px-3 py-2.5 text-body text-warning"
      role="alert"
    >
      <p className="font-semibold">Hay cambios sin guardar.</p>
      <p className="mt-0.5 text-label">
        Si cierra ahora, perderá los cambios realizados.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setConfirmClose(false)} variant="secondary">
          Seguir editando
        </Button>
        <Button onClick={onClose} variant="danger">
          Descartar cambios
        </Button>
      </div>
    </div>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-ink/35"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ml-auto flex h-full w-full flex-col overflow-hidden border-l border-line bg-surface shadow-overlay ${overlayWidths[width]} ${className}`.trim()}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <DrawerHeader
          description={description}
          descriptionId={descriptionId}
          icon={icon}
          onClose={requestClose}
          title={title}
          titleId={titleId}
        />
        <DrawerBody actions={actions} notice={notice}>
          {children}
        </DrawerBody>
      </div>
    </div>,
    target,
  )
}
