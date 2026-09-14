import type { ReactNode } from 'react'

export type MediaSlotAspectRatio = '16:9' | '4:3' | '1:1' | '21:9' | 'video'

export interface MediaSlotProps {
  aspectRatio?: MediaSlotAspectRatio
  label?: string
  icon?: ReactNode
  children?: ReactNode
  className?: string
}

const aspectClasses: Record<MediaSlotAspectRatio, string> = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  '21:9': 'aspect-[21/9]',
  video: 'aspect-video',
}

export function MediaSlot({
  aspectRatio = '16:9',
  label,
  icon,
  children,
  className = '',
}: MediaSlotProps) {
  return (
    <div
      aria-label={label}
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-group border border-dashed border-line bg-surface-muted p-4 text-center text-ink-muted ${aspectClasses[aspectRatio]} ${className}`.trim()}
      role="img"
    >
      {children ? (
        children
      ) : (
        <div className="flex flex-col items-center gap-2">
          {icon ? (
            <span className="text-2xl text-ink-muted/70">{icon}</span>
          ) : (
            <svg
              aria-hidden="true"
              className="size-8 text-ink-muted/50"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <rect height="18" rx="2" ry="2" width="18" x="3" y="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}

          {label && (
            <span className="text-xs font-semibold text-ink-muted max-w-[200px] truncate">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
