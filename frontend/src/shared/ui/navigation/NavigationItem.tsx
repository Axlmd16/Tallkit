import type { ReactNode } from 'react'

export interface NavigationItemProps {
  id: string
  label: string
  icon: ReactNode
  active?: boolean
  collapsed?: boolean
  badge?: string | number
  disabled?: boolean
  onClick?: () => void
  className?: string
}

export function NavigationItem({
  id,
  label,
  icon,
  active = false,
  collapsed = false,
  badge,
  disabled = false,
  onClick,
  className = '',
}: NavigationItemProps) {
  const activeClasses = active
    ? 'bg-[linear-gradient(90deg,rgb(172_169_255_/_0.2),transparent)] text-primary font-semibold'
    : 'text-ink-muted hover:bg-surface-selected/50 hover:text-ink'

  const sizeClasses = collapsed
    ? 'size-11 justify-center mx-auto'
    : 'w-full px-3 py-2.5 justify-start gap-3'

  return (
    <button
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className={`min-h-[44px] flex items-center rounded-control text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${sizeClasses} ${activeClasses} ${className}`.trim()}
      data-item-id={id}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className="shrink-0 text-current flex items-center justify-center size-5">
        {icon}
      </span>

      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {badge !== undefined && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-surface-selected text-ink'
              }`}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  )
}
