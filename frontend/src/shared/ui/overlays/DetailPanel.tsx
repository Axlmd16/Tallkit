import type { ReactNode } from 'react'

import { IconButton } from '../actions'
import { Icon } from '../icons'

export interface DetailPanelProps {
  children: ReactNode
  label?: string | undefined
  title?: ReactNode | undefined
  description?: ReactNode | undefined
  onClose?: (() => void) | undefined
  className?: string | undefined
  bodyClassName?: string | undefined
}

export function DetailPanel({
  bodyClassName = '',
  children,
  className = '',
  description,
  label,
  onClose,
  title,
}: DetailPanelProps) {
  const accessibleLabel =
    label ||
    (typeof title === 'string' ? title : undefined) ||
    'Panel de detalle'

  return (
    <aside
      aria-label={accessibleLabel}
      className={`w-full md:w-[302px] shrink-0 bg-surface border border-line rounded-group flex flex-col overflow-hidden shadow-card ${className}`.trim()}
      role="complementary"
    >
      {(title || onClose) && (
        <header className="p-4 border-b border-line flex items-start justify-between gap-3 bg-canvas">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-sm font-bold text-ink truncate">{title}</h3>
            )}
            {description && (
              <p className="text-xs text-ink-muted mt-0.5 break-words">
                {description}
              </p>
            )}
          </div>

          {onClose && (
            <IconButton
              icon={<Icon name="x" size={16} />}
              label="Cerrar panel"
              onClick={onClose}
              shape="circle"
            />
          )}
        </header>
      )}

      <div className={`p-4 flex-1 overflow-y-auto ${bodyClassName}`.trim()}>
        {children}
      </div>
    </aside>
  )
}
