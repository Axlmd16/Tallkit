import { X } from '@phosphor-icons/react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { Button, IconButton } from './controls'

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function Drawer({
  children,
  description,
  hasUnsavedChanges = false,
  onClose,
  open,
  returnFocusRef,
  title,
}: {
  children: ReactNode
  description: string
  hasUnsavedChanges?: boolean
  onClose: () => void
  open: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
  title: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      const frame = requestAnimationFrame(() => {
        const preferred =
          panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
        const first =
          preferred ??
          panelRef.current?.querySelector<HTMLElement>(focusableSelector)
        first?.focus()
      })
      return () => {
        cancelAnimationFrame(frame)
        document.body.style.overflow = previousOverflow
      }
    }

    if (wasOpen.current) {
      wasOpen.current = false
      setConfirmClose(false)
      returnFocusRef?.current?.focus()
    }
  }, [open, returnFocusRef])

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
      requestClose()
      return
    }
    if (event.key !== 'Tab') return

    const controls = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    )
    if (controls.length === 0) {
      event.preventDefault()
      return
    }
    const first = controls[0]!
    const last = controls.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop fixed inset-0 z-50 bg-ink/35"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="drawer-panel ml-auto flex h-full w-full flex-col overflow-y-auto bg-surface p-5 text-ink shadow-overlay md:w-[30rem] md:p-8"
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
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
    document.body,
  )
}
