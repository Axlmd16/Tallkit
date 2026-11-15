import { useEffect, useState } from 'react'

/**
 * Campo de una línea que se guarda al salir de él (o con Intro) solo si cambió. Si el servidor
 * lo rechaza, vuelve al valor guardado y el motivo se informa por `onError`. Es de lectura
 * cuando `readOnly`: el valor se ve igual, pero no se edita.
 */
export function InlineField({
  value,
  onCommit,
  label,
  placeholder,
  readOnly = false,
  className = '',
  inputMode,
  align = 'left',
  autoFocus = false,
  onUnchanged,
}: {
  value: string
  /** Guarda el valor; debe lanzar si el servidor lo rechaza. */
  onCommit: (next: string) => Promise<void>
  label: string
  placeholder?: string
  readOnly?: boolean
  className?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  align?: 'left' | 'right'
  autoFocus?: boolean
  /** Se llama al salir sin haber cambiado nada. */
  onUnchanged?: () => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  async function commit() {
    const next = text.trim()
    if (next === value.trim()) {
      setText(value)
      onUnchanged?.()
      return
    }
    try {
      await onCommit(next)
    } catch {
      setText(value)
    }
  }

  return (
    <input
      aria-label={label}
      autoFocus={autoFocus}
      className={`w-full border-0 bg-transparent outline-none placeholder:text-ink-muted read-only:cursor-default ${align === 'right' ? 'text-right' : ''} ${className}`}
      inputMode={inputMode}
      onBlur={() => void commit()}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{ outline: 'none' }}
      value={text}
    />
  )
}
