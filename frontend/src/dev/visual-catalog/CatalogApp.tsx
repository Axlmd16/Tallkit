import { useState, useEffect, useMemo, type ReactNode } from 'react'

import {
  COMPONENT_REGISTRY,
  findComponentById,
  searchComponents,
  type ComponentCategory,
  type ComponentEntry,
} from './registry'
import { renderComponentPreview } from './previews'

export interface CatalogAppProps {
  children?: ReactNode
}

export function CatalogApp({ children }: CatalogAppProps) {
  const [selectedId, setSelectedId] = useState<string>('C01')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] =
    useState<ComponentCategory | null>(null)
  const [isIsolated, setIsIsolated] = useState<boolean>(false)

  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.replace(/^#/, '')
      const params = new URLSearchParams(hash)
      const isolateParam = params.get('isolate') === 'true'
      const idParam = params.get('id') ?? ''
      setIsIsolated(isolateParam)
      if (idParam) {
        setSelectedId(idParam)
      }
    }

    parseHash()
    window.addEventListener('hashchange', parseHash)
    return () => window.removeEventListener('hashchange', parseHash)
  }, [])

  const filteredComponents = useMemo(() => {
    let list = searchComponents(searchQuery)
    if (selectedCategory) {
      list = list.filter((c) => c.category === selectedCategory)
    }
    return list
  }, [searchQuery, selectedCategory])

  const selectedComponent: ComponentEntry | undefined = useMemo(() => {
    return findComponentById(selectedId) ?? filteredComponents[0]
  }, [selectedId, filteredComponents])

  const handleReset = () => {
    setSearchQuery('')
    setSelectedCategory(null)
    setSelectedId('C01')
  }

  if (isIsolated) {
    return (
      <div
        data-visual-catalog
        className="catalog-isolated p-4 min-h-screen bg-canvas"
      >
        <div
          data-testid="isolated-view"
          className="p-4 border border-dashed border-border rounded-lg bg-surface"
        >
          <div className="mb-2 text-xs font-mono text-ink-muted">
            Vista aislada para captura:{' '}
            {selectedComponent
              ? `${selectedComponent.id} — ${selectedComponent.name}`
              : selectedId}
          </div>
          {children ??
            renderComponentPreview(selectedComponent?.id ?? selectedId) ?? (
              <div data-testid="isolated-content" className="py-6">
                <div className="text-sm text-ink">
                  Ejemplo aislado de {selectedComponent?.name ?? selectedId}
                </div>
              </div>
            )}
        </div>
      </div>
    )
  }

  return (
    <div
      data-visual-catalog
      className="catalog-container min-h-screen bg-surface-muted text-ink flex flex-col font-sans"
    >
      <header className="border-b border-border bg-surface px-6 py-4 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Catálogo Visual Reutilizable
          </h1>
          <p className="text-xs text-ink-muted">
            Sys-Taller — Biblioteca de patrones visuales y componentes aislados
            (C01–C66)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono bg-surface-muted px-2.5 py-1 rounded border border-border text-ink-muted">
            Modo DEV — Sin llamadas API
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar explorer */}
        <aside className="w-80 border-r border-border bg-surface flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar componentes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs px-3 py-1.5 border border-border rounded bg-surface-muted focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleReset}
                className="text-xs px-2.5 py-1.5 border border-border rounded bg-surface hover:bg-surface-muted text-ink-muted"
                title="Limpiar filtros"
              >
                Limpiar
              </button>
            </div>
            <div className="text-xs text-ink-muted font-mono">
              {filteredComponents.length} de {COMPONENT_REGISTRY.length}{' '}
              componentes
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filteredComponents.map((comp) => {
              const isSelected = selectedComponent?.id === comp.id
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => setSelectedId(comp.id)}
                  className={`w-full text-left px-4 py-2.5 text-xs transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-surface-selected border-l-4 border-primary text-primary-strong font-semibold'
                      : 'hover:bg-surface-muted text-ink'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{comp.id}</span>
                    <span>{comp.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-muted text-ink-muted">
                    {comp.category}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main detail area */}
        <main className="flex-1 p-6 overflow-y-auto bg-canvas">
          {selectedComponent ? (
            <div className="max-w-4xl space-y-6">
              <div className="rounded-lg border border-border bg-surface p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      {selectedComponent.id} — {selectedComponent.name}
                    </h2>
                    <p className="text-sm text-ink-muted mt-1">
                      {selectedComponent.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs font-mono px-2 py-1 bg-surface-muted rounded border border-border">
                      {selectedComponent.priority}
                    </span>
                    <span className="text-xs font-mono px-2 py-1 bg-surface-muted rounded border border-border">
                      Clase {selectedComponent.classification}
                    </span>
                    <span className="text-xs font-mono px-2 py-1 bg-surface-muted rounded border border-border">
                      {selectedComponent.kind === 'E'
                        ? 'Figma E'
                        : 'Adaptación A'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border text-xs">
                  <div>
                    <span className="text-ink-muted block">Categoría:</span>
                    <span className="font-semibold">
                      {selectedComponent.category}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Frame de origen:
                    </span>
                    <span className="font-semibold">
                      {selectedComponent.frameRef}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Nodos representativos:
                    </span>
                    <span className="font-mono">
                      {selectedComponent.nodes.length > 0
                        ? selectedComponent.nodes.join(', ')
                        : 'Ninguno (A)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Tokens asociados:
                    </span>
                    <span className="font-mono">
                      {selectedComponent.tokens.join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Estado de evidencia:
                    </span>
                    <span className="font-semibold">
                      {selectedComponent.evidenceStatus === 'verified'
                        ? 'Verificada'
                        : 'En revisión'}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Prueba trazable:
                    </span>
                    <span className="font-mono break-all">
                      {selectedComponent.evidenceRefs.join(', ')}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                    Variantes registradas ({selectedComponent.variants.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedComponent.variants.map((v) => (
                      <span
                        key={v}
                        className="px-2.5 py-1 text-xs rounded-full bg-surface-muted border border-border text-ink"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Component preview / demonstration slot */}
              <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
                <h3 className="text-sm font-bold text-ink mb-4">
                  Demostración interactiva
                </h3>
                <div className="p-8 border border-dashed border-border rounded bg-canvas flex items-center justify-center min-h-[160px]">
                  {children ?? renderComponentPreview(selectedComponent.id) ?? (
                    <div className="text-xs text-ink-muted text-center space-y-1">
                      <p>
                        Muestra del componente{' '}
                        <strong>{selectedComponent.name}</strong>
                      </p>
                      <p className="text-[11px]">
                        Las implementaciones se activarán en sus fases
                        correspondientes.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <p className="text-sm text-ink-muted">
                No se encontró ningún componente que coincida con los criterios
                de búsqueda.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
