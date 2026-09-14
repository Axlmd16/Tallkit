import type { ReactNode } from 'react'

export interface AppFrameProps {
  children: ReactNode
  sidebar?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  className?: string
  mainClassName?: string
}

export function AppFrame({
  children,
  sidebar,
  header,
  footer,
  className = '',
  mainClassName = '',
}: AppFrameProps) {
  return (
    <div
      className={`flex min-h-screen w-full bg-surface-ground text-ink ${className}`.trim()}
    >
      {sidebar && <div className="shrink-0 flex">{sidebar}</div>}

      <div className="flex min-w-0 flex-1 flex-col">
        {header && (
          <header className="border-b border-border-subtle bg-surface px-4 py-3 sm:px-6">
            {header}
          </header>
        )}

        <main
          className={`flex-1 p-4 md:p-6 overflow-auto ${mainClassName}`.trim()}
          tabIndex={0}
        >
          {children}
        </main>

        {footer && (
          <footer className="border-t border-border-subtle bg-surface px-4 py-3 sm:px-6 text-xs text-ink-muted">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
