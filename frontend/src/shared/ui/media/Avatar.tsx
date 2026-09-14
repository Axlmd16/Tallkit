import type { ReactNode } from 'react'

import { Icon } from '@/shared/ui/icons'

export type AvatarSize = '36' | '70' | '134' | '45x43'
export type AvatarShape = 'circle' | 'square'

export interface AvatarProps {
  name?: string | undefined
  initials?: string | undefined
  label?: string | undefined
  size?: AvatarSize | undefined
  shape?: AvatarShape | undefined
  className?: string | undefined
  children?: ReactNode | undefined
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return ''
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1] ?? ''
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase()
}

const sizeClasses: Record<AvatarSize, string> = {
  '36': 'size-9 text-xs',
  '70': 'size-[70px] text-xl font-bold',
  '134': 'size-[134px] text-4xl font-extrabold',
  '45x43': 'w-[45px] h-[43px] text-sm font-semibold',
}

const iconSizes: Record<AvatarSize, number> = {
  '36': 18,
  '70': 32,
  '134': 64,
  '45x43': 22,
}

export function Avatar({
  name,
  initials: providedInitials,
  label,
  size = '36',
  shape = size === '45x43' ? 'square' : 'circle',
  className = '',
  children,
}: AvatarProps) {
  const computedInitials = providedInitials ?? (name ? getInitials(name) : '')
  const accessibleLabel =
    label ??
    name ??
    (computedInitials ? `Avatar ${computedInitials}` : 'Avatar de usuario')
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-group'
  const sizeClass = sizeClasses[size]

  return (
    <div
      aria-label={accessibleLabel}
      className={`inline-flex shrink-0 items-center justify-center select-none bg-primary-soft text-primary-strong font-semibold overflow-hidden border border-primary/10 ${sizeClass} ${shapeClass} ${className}`}
      role="img"
    >
      {children ??
        (computedInitials ? (
          <span>{computedInitials}</span>
        ) : (
          <Icon aria-hidden name="user" size={iconSizes[size]} />
        ))}
    </div>
  )
}
