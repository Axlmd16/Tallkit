import { Avatar, type AvatarSize } from './Avatar'

export interface AvatarGroupItem {
  name?: string
  label?: string
}

export interface AvatarGroupProps {
  items: AvatarGroupItem[]
  max?: number
  size?: Extract<AvatarSize, '36' | '70'>
  'aria-label'?: string
  className?: string
}

export function AvatarGroup({
  items,
  max = 3,
  size = '36',
  'aria-label': ariaLabel = 'Grupo de avatares',
  className = '',
}: AvatarGroupProps) {
  const visibleItems = items.slice(0, max)
  const extraCount = Math.max(0, items.length - max)

  const extraSizeClasses =
    size === '70' ? 'size-[70px] text-lg' : 'size-9 text-xs'

  return (
    <div
      aria-label={ariaLabel}
      className={`flex items-center -space-x-2 ${className}`.trim()}
      role="group"
    >
      {visibleItems.map((item, index) => (
        <div
          className="rounded-full ring-2 ring-surface"
          key={`${item.name ?? item.label ?? 'avatar'}-${index}`}
        >
          <Avatar label={item.label} name={item.name} size={size} />
        </div>
      ))}

      {extraCount > 0 && (
        <span
          aria-label={`${extraCount} más`}
          className={`grid place-items-center rounded-full bg-surface-selected font-bold text-ink ring-2 ring-surface ${extraSizeClasses}`}
        >
          +{extraCount}
        </span>
      )}
    </div>
  )
}
