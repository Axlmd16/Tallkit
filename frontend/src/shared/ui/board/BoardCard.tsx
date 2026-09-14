import type { ReactNode } from 'react'

import { Surface } from '../layout'
import { AvatarGroup, MediaSlot, type AvatarGroupItem } from '../media'

export interface BoardCardProps {
  id: string
  title: string
  description?: string | undefined
  avatars?: AvatarGroupItem[] | undefined
  media?: boolean | undefined
  indicators?: ReactNode | undefined
  actions?: ReactNode | undefined
  selected?: boolean | undefined
  onSelect?: (() => void) | undefined
  className?: string | undefined
}

export function BoardCard({
  actions,
  avatars = [],
  className = '',
  description,
  indicators,
  media = false,
  onSelect,
  selected = false,
  title,
}: BoardCardProps) {
  return (
    <Surface
      className={`border p-4 transition-colors ${
        selected
          ? 'border-primary bg-primary-soft'
          : 'border-line bg-surface hover:border-primary/40'
      } ${className}`.trim()}
      role="listitem"
    >
      <button
        aria-pressed={selected}
        className="block w-full cursor-pointer rounded-control text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        onClick={onSelect}
        type="button"
      >
        {media && (
          <MediaSlot
            aspectRatio="16:9"
            className="mb-3"
            label={`Medio neutral de ${title}`}
          />
        )}
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="break-words text-sm font-extrabold text-ink">
              {title}
            </h4>
            {description && (
              <p className="mt-1 break-words text-xs leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {indicators && <div className="shrink-0">{indicators}</div>}
        </div>
        {avatars.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <AvatarGroup
              aria-label={`Participantes sintéticos de ${title}`}
              items={avatars}
            />
          </div>
        )}
      </button>
      {actions && (
        <footer className="mt-3 flex min-h-11 items-center justify-end gap-3 border-t border-line pt-3">
          <div className="flex items-center gap-2">{actions}</div>
        </footer>
      )}
    </Surface>
  )
}
