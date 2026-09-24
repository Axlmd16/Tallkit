import { useEffect, useMemo, useState } from 'react'

import { ToastProvider } from '@/shared/ui'

import { PREVIEWS } from './previews'
import {
  CATALOG,
  FAMILY_LABELS,
  filterCatalog,
  findEntry,
  type CatalogEntry,
  type CatalogFamily,
} from './registry'

const CATALOG_WIDTHS = [360, 768, 1024, 1280, 1440] as const
type CatalogWidth = (typeof CATALOG_WIDTHS)[number]

function parseWidth(value: string | null): CatalogWidth {
  const width = Number(value)
  return CATALOG_WIDTHS.includes(width as CatalogWidth)
    ? (width as CatalogWidth)
    : 1440
}

function readHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return {
    id: params.get('id'),
    isolate: params.get('isolate') === 'true',
    variant: params.get('variant'),
    width: parseWidth(params.get('width')),
  }
}

function sourceLabel(entry: CatalogEntry) {
  return entry.source.kind === 'tablero'
    ? `Tablero «${entry.source.board}»`
    : `Adaptación del proyecto: ${entry.source.reason}`
}

function Preview({
  entry,
  variant,
  width,
}: {
  entry: CatalogEntry
  variant: string
  width: CatalogWidth
}) {
  const Render = PREVIEWS[entry.id]
  return (
    <div
      className="mx-auto w-full"
      data-catalog-variant={variant}
      data-catalog-width={width}
      data-testid="catalog-preview-frame"
      style={{ maxWidth: `${width}px` }}
    >
      <p className="mb-3 text-xs text-ink-muted">
        Variante o estado: <strong className="text-ink">{variant}</strong> ·{' '}
        {width} px
      </p>
      {Render ? <Render /> : <p className="text-ink-muted">Sin ejemplo.</p>}
    </div>
  )
}

/**
 * Catálogo visual Tallkit, exclusivo de desarrollo: muestra los componentes y patrones
 * compartidos con datos de ejemplo fijos. No consulta la API ni navega a rutas funcionales.
 */
export function CatalogApp() {
  const initial = readHash()
  const initialEntry = findEntry(initial.id) ?? CATALOG[0]!
  const [selectedId, setSelectedId] = useState<string>(initialEntry.id)
  const [isolated, setIsolated] = useState(initial.isolate)
  const [selectedVariant, setSelectedVariant] = useState(
    initial.variant && initialEntry.variants.includes(initial.variant)
      ? initial.variant
      : initialEntry.variants[0]!,
  )
  const [previewWidth, setPreviewWidth] = useState<CatalogWidth>(initial.width)
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<CatalogFamily | null>(null)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    function onHash() {
      const next = readHash()
      const nextEntry = findEntry(next.id)
      if (nextEntry) {
        setSelectedId(nextEntry.id)
        setSelectedVariant(
          next.variant && nextEntry.variants.includes(next.variant)
            ? next.variant
            : nextEntry.variants[0]!,
        )
      }
      setPreviewWidth(next.width)
      setIsolated(next.isolate)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const visible = useMemo(() => filterCatalog(query, family), [query, family])
  const entry = findEntry(selectedId) ?? CATALOG[0]!

  if (isolated) {
    return (
      <div
        className="min-h-screen bg-canvas p-6 text-ink"
        data-testid="isolated-view"
        data-visual-catalog
      >
        <p className="mb-4 text-sm font-semibold">
          {entry.id} — {entry.name}
        </p>
        <ToastProvider>
          <Preview
            entry={entry}
            key={resetKey}
            variant={selectedVariant}
            width={previewWidth}
          />
        </ToastProvider>
      </div>
    )
  }

  return (
    <div
      className="grid min-h-screen bg-canvas text-ink md:grid-cols-[17rem_minmax(0,1fr)]"
      data-visual-catalog
    >
      <aside className="border-b border-line bg-surface p-4 md:border-r md:border-b-0">
        <h1 className="text-lg font-semibold">Catálogo visual Tallkit</h1>
        <p className="mt-1 text-xs text-ink-muted">
          Solo desarrollo · datos de ejemplo
        </p>
        <label
          className="mt-4 mb-1.5 block text-xs font-semibold"
          htmlFor="catalog-search"
        >
          Buscar componentes
        </label>
        <input
          className="min-h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px] focus:border-accent focus:outline-none"
          id="catalog-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar componentes"
          type="search"
          value={query}
        />
        <label
          className="mt-3 mb-1.5 block text-xs font-semibold"
          htmlFor="catalog-family"
        >
          Familia
        </label>
        <select
          className="min-h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px]"
          id="catalog-family"
          onChange={(event) =>
            setFamily((event.target.value || null) as CatalogFamily | null)
          }
          value={family ?? ''}
        >
          <option value="">Todas</option>
          {(Object.keys(FAMILY_LABELS) as CatalogFamily[]).map((key) => (
            <option key={key} value={key}>
              {FAMILY_LABELS[key]}
            </option>
          ))}
        </select>
        <nav aria-label="Componentes del catálogo" className="mt-4">
          <ul className="space-y-0.5">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  aria-current={item.id === entry.id ? 'true' : undefined}
                  className={`flex min-h-10 w-full items-center gap-2 rounded-control px-2.5 text-left text-[13px] ${item.id === entry.id ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-ink-muted hover:bg-surface-subtle hover:text-ink'}`}
                  onClick={() => {
                    setSelectedId(item.id)
                    setSelectedVariant(item.variants[0]!)
                    setPreviewWidth(1440)
                  }}
                  type="button"
                >
                  <span className="font-mono text-xs">{item.id}</span>
                  {item.name}
                </button>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-2.5 py-2 text-[13px] text-ink-muted">
                Sin coincidencias.
              </li>
            )}
          </ul>
        </nav>
      </aside>
      <main className="min-w-0 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-ink-muted">
              {entry.id} · {FAMILY_LABELS[entry.family]}
            </p>
            <h2 className="text-[22px] leading-7 font-semibold">
              {entry.name}
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">
              {entry.description}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="min-h-10 rounded-control border border-line-strong bg-surface px-3 text-[13px] font-semibold"
              onClick={() => {
                setSelectedVariant(entry.variants[0]!)
                setPreviewWidth(1440)
                setResetKey((key) => key + 1)
              }}
              type="button"
            >
              Restablecer ejemplo
            </button>
            <a
              className="inline-flex min-h-10 items-center rounded-control px-3 text-[13px] font-semibold text-accent"
              href={`#isolate=true&id=${entry.id}&variant=${encodeURIComponent(selectedVariant)}&width=${previewWidth}`}
            >
              Vista aislada
            </a>
          </div>
        </header>
        <div
          aria-label="Controles de reproducción"
          className="mt-4 grid gap-3 rounded-panel border border-line bg-surface-subtle p-3 sm:grid-cols-2"
          role="group"
        >
          <label className="text-xs font-semibold" htmlFor="catalog-variant">
            Variante o estado
            <select
              className="mt-1 min-h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px]"
              id="catalog-variant"
              onChange={(event) => setSelectedVariant(event.target.value)}
              value={selectedVariant}
            >
              {entry.variants.map((variant) => (
                <option key={variant}>{variant}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold" htmlFor="catalog-width">
            Ancho de revisión
            <select
              className="mt-1 min-h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px]"
              id="catalog-width"
              onChange={(event) =>
                setPreviewWidth(parseWidth(event.target.value))
              }
              value={previewWidth}
            >
              {CATALOG_WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width} px
                </option>
              ))}
            </select>
          </label>
        </div>
        <section
          aria-label={`Ejemplo de ${entry.name}`}
          className="mt-5 rounded-panel border border-line bg-surface p-5"
        >
          <ToastProvider>
            <Preview
              entry={entry}
              key={`${entry.id}-${resetKey}`}
              variant={selectedVariant}
              width={previewWidth}
            />
          </ToastProvider>
        </section>
        <dl className="mt-4 grid gap-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-semibold">Procedencia</dt>
            <dd className="text-ink-muted">{sourceLabel(entry)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Tokens</dt>
            <dd className="font-mono text-ink-muted">
              {entry.tokens.join(' · ')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Variantes y estados</dt>
            <dd className="text-ink-muted">{entry.variants.join(' · ')}</dd>
          </div>
          <div>
            <dt className="font-semibold">Consumidores</dt>
            <dd className="text-ink-muted">{entry.consumers.join(' · ')}</dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 text-[12.5px] lg:grid-cols-2">
          <section aria-labelledby="catalog-acceptance">
            <h3 className="font-semibold" id="catalog-acceptance">
              Criterios de aceptación
            </h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
              {entry.acceptanceCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="catalog-differences">
            <h3 className="font-semibold" id="catalog-differences">
              Diferencias conocidas
            </h3>
            {entry.knownDifferences.length > 0 ? (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
                {entry.knownDifferences.map((difference) => (
                  <li key={difference}>{difference}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-ink-muted">Sin diferencias conocidas.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
