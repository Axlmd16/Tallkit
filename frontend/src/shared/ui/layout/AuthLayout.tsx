import type { ReactNode } from 'react'

export type AuthLayoutVariant = 'short' | 'extended'

export interface AuthLayoutProps {
  children: ReactNode
  header?: ReactNode | undefined
  footer?: ReactNode | undefined
  hero?: ReactNode | undefined
  variant?: AuthLayoutVariant | undefined
  className?: string | undefined
}

export function AuthLayout({
  children,
  header,
  footer,
  hero,
  variant = 'short',
  className = '',
}: AuthLayoutProps) {
  const isExtended = variant === 'extended'

  return (
    <div className="min-h-screen w-full bg-canvas flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        className={`w-full flex flex-col lg:flex-row items-center justify-center gap-8 ${
          hero ? 'max-w-5xl' : 'max-w-lg'
        }`}
      >
        {hero && (
          <div className="hidden lg:flex flex-1 flex-col justify-center items-start p-8 rounded-panel bg-surface-ground border border-border-subtle">
            {hero}
          </div>
        )}

        <main
          className={`w-full max-w-[448px] bg-surface border border-border-subtle rounded-panel shadow-card flex flex-col justify-center ${
            isExtended ? 'py-12 px-6 sm:px-10' : 'py-8 px-6 sm:px-8'
          } ${className}`.trim()}
          role="main"
        >
          {header && (
            <header className="mb-6 flex flex-col items-center text-center">
              {header}
            </header>
          )}

          <div
            className="w-full max-w-[348px] mx-auto flex flex-col"
            data-testid="auth-form-container"
          >
            {children}
          </div>

          {footer && (
            <footer className="mt-8 text-center text-xs text-ink-muted">
              {footer}
            </footer>
          )}
        </main>
      </div>
    </div>
  )
}
