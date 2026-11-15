import { Minus, Plus } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

/** Espera tras el último clic antes de guardar: varios clics seguidos se guardan una sola vez. */
export const QUANTITY_SETTLE_MS = 400

/**
 * Cantidad con − y + en una sola pieza de contorno suave. Nunca baja de 1: para quitar una línea
 * está su propio botón. Los clics seguidos se acumulan y se guardan una sola vez, cuando la
 * persona deja de pulsar; si en ese momento todavía se está guardando el cambio anterior, el
 * nuevo espera a que termine. Así cada guardado lleva la versión vigente de la orden. Si el
 * servidor lo rechaza, vuelve a mostrar la cantidad guardada. Sin `onChange` es solo texto.
 */
export function QuantityStepper({
  value,
  name,
  onChange,
}: {
  value: number
  /** Nombre de lo que se cuenta, para los nombres accesibles de los botones. */
  name: string
  /** Guarda la cantidad final; debe rechazar si el servidor no la acepta. */
  onChange?: ((next: number) => Promise<void>) | undefined
}) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saving = useRef(false)
  const queued = useRef<number | null>(null)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }

  // Lo guardado manda mientras no haya clics pendientes de guardar.
  useEffect(() => {
    if (!timer.current && !saving.current && queued.current === null)
      setDraft(value)
  }, [value])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  async function commit(next: number) {
    if (saving.current) {
      queued.current = next
      return
    }
    if (next === latest.current.value) return
    saving.current = true
    try {
      await latest.current.onChange?.(next)
    } catch {
      setDraft(latest.current.value)
      queued.current = null
    } finally {
      saving.current = false
    }
    const pending = queued.current
    queued.current = null
    if (pending !== null) await commit(pending)
  }

  if (!onChange) {
    return (
      <span className="inline-flex h-10 items-center text-lead font-semibold text-ink tabular-nums">
        {value}
      </span>
    )
  }

  const step = (delta: 1 | -1) => {
    const next = Math.max(1, draft + delta)
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void commit(next)
    }, QUANTITY_SETTLE_MS)
  }

  const button =
    'grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <span className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-0.5">
      <button
        aria-label={`Uno menos de ${name}`}
        className={button}
        disabled={draft <= 1}
        onClick={() => step(-1)}
        type="button"
      >
        <Minus aria-hidden="true" size={14} weight="bold" />
      </button>
      <span
        aria-live="polite"
        className="min-w-8 text-center text-lead font-semibold text-ink tabular-nums"
      >
        {draft}
      </span>
      <button
        aria-label={`Uno más de ${name}`}
        className={button}
        onClick={() => step(1)}
        type="button"
      >
        <Plus aria-hidden="true" size={14} weight="bold" />
      </button>
    </span>
  )
}
