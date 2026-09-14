import { PaperPlaneRight } from '@phosphor-icons/react'
import type { FormEvent, KeyboardEvent } from 'react'

import { IconButton } from '../actions'
import { Textarea } from '../forms'

export interface MessageComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  pending?: boolean | undefined
  placeholder?: string | undefined
  className?: string | undefined
}

export function MessageComposer({
  className = '',
  onChange,
  onSubmit,
  pending = false,
  placeholder = 'Escriba un ejemplo neutral…',
  value,
}: MessageComposerProps) {
  const normalizedValue = value.trim()
  const disabled = pending || normalizedValue.length === 0

  function submit() {
    if (disabled) return
    onSubmit(normalizedValue)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      aria-label="Compositor de demostración"
      className={`flex items-end gap-2 rounded-group bg-surface p-3 ${className}`.trim()}
      onSubmit={handleSubmit}
    >
      <Textarea
        aria-label="Mensaje neutral"
        className="min-h-[72px] flex-1"
        disabled={pending}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        resize="vertical"
        rows={2}
        value={value}
      />
      <IconButton
        disabled={disabled}
        icon={<PaperPlaneRight size={20} weight="bold" />}
        label={pending ? 'Enviando mensaje' : 'Enviar mensaje'}
        pending={pending}
        shape="circle"
        targetSize="touch44"
        type="submit"
      />
    </form>
  )
}
