import type { ReactNode } from 'react'

export type PreviewMobileView = 'editor' | 'preview'

export interface PreviewLayoutProps {
  editor: ReactNode
  preview: ReactNode
  toolbar?: ReactNode | undefined
  activeMobileView?: PreviewMobileView | undefined
  editorLabel?: string | undefined
  previewLabel?: string | undefined
  className?: string | undefined
}

export function PreviewLayout({
  activeMobileView = 'editor',
  className = '',
  editor,
  editorLabel = 'Editor de configuración',
  preview,
  previewLabel = 'Vista previa del documento',
  toolbar,
}: PreviewLayoutProps) {
  const isPreviewHiddenOnMobile = activeMobileView === 'editor'
  const isEditorHiddenOnMobile = activeMobileView === 'preview'

  return (
    <div
      className={`w-full flex flex-col gap-4 text-sm text-ink ${className}`.trim()}
      data-testid="preview-layout-root"
    >
      {toolbar && (
        <header className="w-full flex items-center justify-between gap-3 pb-2 border-b border-border-subtle">
          {toolbar}
        </header>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-h-[480px]">
        {/* Panel de edición / parámetros */}
        <section
          aria-label={editorLabel}
          className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 bg-surface border border-border-subtle rounded-panel p-5 shadow-card ${
            isEditorHiddenOnMobile ? 'max-lg:hidden' : ''
          }`.trim()}
          role="region"
        >
          {editor}
        </section>

        {/* Panel de visualización / documento previo (con escala accesible, mínimo text-xs) */}
        <section
          aria-label={previewLabel}
          className={`flex-1 w-full bg-surface border border-border-subtle rounded-panel p-6 shadow-card overflow-x-auto ${
            isPreviewHiddenOnMobile ? 'max-lg:hidden' : ''
          }`.trim()}
          role="region"
        >
          {preview}
        </section>
      </div>
    </div>
  )
}
