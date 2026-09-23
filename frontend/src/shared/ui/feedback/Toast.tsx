import { CheckCircle, Info, X } from '@phosphor-icons/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'

type ToastTone = 'success' | 'info'

export interface ToastOptions {
  href?: string
  linkLabel?: string
}

interface ToastEntry extends ToastOptions {
  id: number
  message: string
  tone: ToastTone
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)
const TOAST_DURATION_MS = 6_000
const MAX_TOASTS = 3

function ToastItem({
  entry,
  onDismiss,
}: {
  entry: ToastEntry
  onDismiss: (id: number) => void
}) {
  const [paused, setPaused] = useState(false)
  const remainingMs = useRef(TOAST_DURATION_MS)
  const startedAt = useRef(0)
  const Icon = entry.tone === 'success' ? CheckCircle : Info

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const timer = window.setTimeout(
      () => onDismiss(entry.id),
      remainingMs.current,
    )

    return () => {
      window.clearTimeout(timer)
      remainingMs.current = Math.max(
        0,
        remainingMs.current - (Date.now() - startedAt.current),
      )
    }
  }, [entry.id, onDismiss, paused])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    onDismiss(entry.id)
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return
    }
    setPaused(false)
  }

  return (
    <div
      className="flex min-h-12 w-full items-start gap-2.5 rounded-dialog border border-line bg-ink px-3 py-2.5 text-sm text-white shadow-toast transition duration-150 motion-reduce:animate-none motion-reduce:transition-none sm:w-[23rem]"
      data-toast=""
      onBlurCapture={handleBlur}
      onFocusCapture={() => setPaused(true)}
      onKeyDown={handleKeyDown}
      onMouseEnter={(_event: MouseEvent<HTMLDivElement>) => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
      <p className="min-w-0 flex-1 leading-5">{entry.message}</p>
      {entry.href && (
        <a
          className="shrink-0 font-semibold text-white underline decoration-white/60 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft"
          href={entry.href}
        >
          {entry.linkLabel ?? 'Ver'}
        </a>
      )}
      <button
        aria-label="Cerrar notificación"
        className="grid size-6 shrink-0 place-items-center rounded-control text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft"
        onClick={() => onDismiss(entry.id)}
        type="button"
      >
        <X aria-hidden="true" size={15} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const add = useCallback(
    (tone: ToastTone, message: string, options: ToastOptions = {}) => {
      const entry: ToastEntry = {
        id: nextId.current++,
        message,
        tone,
        ...options,
      }
      setEntries((current) => [...current, entry].slice(-MAX_TOASTS))
    },
    [],
  )

  const api = useMemo<ToastApi>(
    () => ({
      info: (message, options) => add('info', message, options),
      success: (message, options) => add('success', message, options),
    }),
    [add],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label="Notificaciones"
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-[70] flex flex-col gap-2 sm:right-6 sm:bottom-6 sm:left-auto"
        role="status"
      >
        {entries.map((entry) => (
          <ToastItem entry={entry} key={entry.id} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider')
  return value
}
