import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export interface HintPopoverProps {
  /** Contenido visible del disparador (icono, número o texto breve). */
  trigger: ReactNode
  /** Nombre accesible del disparador. */
  label: string
  /** Detalle que se muestra al pasar el puntero, enfocar o tocar el disparador. */
  children: ReactNode
  /** Clases del disparador; definen su tono. */
  triggerClassName?: string
  align?: 'start' | 'end'
  /** Texto que siempre describe el disparador para tecnologías de asistencia. */
  description?: string
  size?: 'sm' | 'md'
}

/**
 * Detalle breve que se despliega con puntero, foco o toque, sin depender solo
 * del hover. El panel se cierra con Escape o al salir.
 */
export function HintPopover({
  trigger,
  label,
  children,
  triggerClassName = '',
  align = 'start',
  description,
  size = 'md',
}: HintPopoverProps) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const panelId = useId()
  const descriptionId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const visible = open || pinned

  useEffect(() => {
    if (!pinned) return
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [pinned])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false)
      setPinned(false)
    }
  }

  return (
    <span
      className="relative inline-flex"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      ref={rootRef}
    >
      <button
        aria-controls={visible ? panelId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-expanded={visible}
        aria-label={label}
        className={`ui-button inline-flex items-center rounded-full font-semibold whitespace-nowrap pointer-coarse:min-h-11 outline-none ${size === 'sm' ? 'min-h-6 gap-1 px-2 text-[11px]' : 'min-h-8 gap-1.5 px-2.5 text-xs'} focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${triggerClassName}`}
        onBlur={() => setOpen(false)}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setOpen(true)}
        type="button"
      >
        {trigger}
      </button>
      {description && (
        <span className="sr-only" id={descriptionId}>
          {description}
        </span>
      )}
      {visible && (
        <span
          className={`absolute top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-control border border-line bg-surface p-3 text-left text-[13px] font-normal text-ink shadow-menu ${align === 'end' ? 'right-0' : 'left-0'}`}
          id={panelId}
          role="note"
        >
          {children}
        </span>
      )}
    </span>
  )
}
