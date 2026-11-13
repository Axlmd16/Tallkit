import {
  ArrowsHorizontal,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CornersOut,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Minus,
  Plus,
  Printer,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'

import { useIssuerBrandStatus } from '@/shared/api/entity-logos'
import { Button, Field, IconButton, Input, Modal } from '@/shared/ui'
import { useSheetBrandReady } from '@/shared/ui/business'

import { Code128EncodingError, encodeCode128 } from './code128'
import { ProductLabelSheet } from './ProductLabelSheet'
import './product-label-print.css'
import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  buildLabelPages,
  calculateLabelGrid,
  type ProductLabelCell,
  type ProductLabelData,
} from './label-layout'

const LABEL_GRID = calculateLabelGrid(LABEL_WIDTH_MM, LABEL_HEIGHT_MM)

// Escala de reserva cuando el visor aún no conoce su tamaño.
const FALLBACK_FIT_SCALE = 0.5
const MIN_PREVIEW_SCALE = 0.3
const MAX_PREVIEW_SCALE = 1.3
const PREVIEW_SCALE_STEP = 0.1
const PX_PER_MM = 96 / 25.4
const PREVIEW_PADDING_PX = 40

export interface ProductLabelPrintModalProps {
  loadError?: string | null | undefined
  loading?: boolean | undefined
  onClose: () => void
  onRetry?: (() => void) | undefined
  open: boolean
  products: ProductLabelData[]
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
}

type SlotState = 'skipped' | 'start' | 'filled' | 'empty'

function validQuantity(value: string): boolean {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0
}

function clampScale(value: number): number {
  return Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, value))
}

type FitMode = 'width' | 'page'

interface FitScales {
  page: number
  width: number
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const schedule =
      window.requestAnimationFrame ??
      ((callback: FrameRequestCallback) => window.setTimeout(callback, 0))
    schedule(() => resolve())
  })
}

async function waitForImage(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      const settle = () => resolve()
      image.addEventListener('load', settle, { once: true })
      image.addEventListener('error', settle, { once: true })
    })
  }
  if (image.naturalWidth > 0 && typeof image.decode === 'function') {
    await image.decode().catch(() => undefined)
  }
}

async function waitForPrintImages(root: HTMLElement | null): Promise<void> {
  if (!root) return
  await Promise.all(Array.from(root.querySelectorAll('img'), waitForImage))
}

/**
 * Escalas con las que la hoja A4 llena el ancho del visor (hasta su tamaño
 * real) o cabe completa en él.
 */
function useFitScales(element: HTMLElement | null): FitScales {
  const [scales, setScales] = useState<FitScales>({
    page: FALLBACK_FIT_SCALE,
    width: FALLBACK_FIT_SCALE,
  })

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return
      const byWidth = (width - PREVIEW_PADDING_PX) / (PAGE_WIDTH_MM * PX_PER_MM)
      const byHeight =
        (height - PREVIEW_PADDING_PX) / (PAGE_HEIGHT_MM * PX_PER_MM)
      const round = (value: number) => clampScale(Math.floor(value * 100) / 100)
      setScales({
        page: round(Math.min(byWidth, byHeight)),
        width: round(Math.min(byWidth, 1)),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return scales
}

function StepHeading({
  children,
  id,
  meta,
  step,
}: {
  children: ReactNode
  id: string
  meta?: ReactNode
  step: number
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line bg-surface-subtle px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-primary text-label font-bold text-white"
        >
          {step}
        </span>
        <h3 className="font-bold" id={id}>
          {children}
        </h3>
      </div>
      {meta}
    </div>
  )
}

function PageThumbnail({ page }: { page: ProductLabelCell[] }) {
  return (
    <span
      aria-hidden="true"
      className="grid aspect-[210/297] w-9 grid-cols-2 gap-px rounded-[2px] border border-line-strong bg-surface p-[3px]"
    >
      {page.map((cell, index) => (
        <span
          className={cell ? 'rounded-[1px] bg-accent' : 'bg-surface-muted'}
          key={index}
        />
      ))}
    </span>
  )
}

function ModalContent(props: ProductLabelPrintModalProps) {
  const {
    loadError,
    loading = false,
    onClose,
    onRetry,
    products,
    returnFocusRef,
  } = props
  const issuer = useIssuerBrandStatus('COMERCIAL')
  const logoReadiness = useSheetBrandReady(5000)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [applyQuantity, setApplyQuantity] = useState('1')
  const [startPosition, setStartPosition] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [fitMode, setFitMode] = useState<FitMode | null>('width')
  const [manualScale, setManualScale] = useState(FALLBACK_FIT_SCALE)
  const [highlightedProductId, setHighlightedProductId] = useState<
    number | null
  >(null)
  const [printSurfaceReady, setPrintSurfaceReady] = useState(false)
  const printSurfaceRef = useRef<HTMLDivElement>(null)
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(
    null,
  )
  const fitScales = useFitScales(previewElement)
  const previewScale = fitMode ? fitScales[fitMode] : manualScale

  useEffect(() => {
    setQuantities((current) => {
      const next: Record<number, string> = {}
      for (const product of products)
        next[product.id] = current[product.id] ?? '1'
      return next
    })
  }, [products])

  useEffect(() => {
    if (!issuer.logoUrl) logoReadiness.onBrandReady(true)
  }, [issuer.logoUrl, logoReadiness.onBrandReady])

  const grid = LABEL_GRID

  const items = useMemo(
    () =>
      products.map((product) => ({
        product,
        quantity: validQuantity(quantities[product.id] ?? '')
          ? Number(quantities[product.id])
          : 0,
      })),
    [products, quantities],
  )
  const invalidQuantities = products.some(
    (product) => !validQuantity(quantities[product.id] ?? ''),
  )
  const layout = buildLabelPages(items, grid, startPosition)
  const incompatibleProducts = products.filter((product) => {
    try {
      encodeCode128(product.code)
      return false
    } catch (error) {
      if (error instanceof Code128EncodingError) return true
      throw error
    }
  })
  const brandFailed =
    issuer.isError || (!issuer.isPending && !issuer.displayName)
  const brandReady = !issuer.isPending && !brandFailed && logoReadiness.ready
  const blocked =
    loading ||
    Boolean(loadError) ||
    products.length === 0 ||
    invalidQuantities ||
    incompatibleProducts.length > 0 ||
    issuer.isPending ||
    brandFailed ||
    !logoReadiness.ready
  const brand = {
    displayName: issuer.displayName ?? issuer.legalName ?? '',
    logoUrl: logoReadiness.timedOut ? null : (issuer.logoUrl ?? null),
  }
  const visiblePage = layout.pages[pageIndex]
  const pageCount = layout.pages.length
  const firstPageLabels = layout.pages[0]?.filter(Boolean).length ?? 0
  const summary = `${layout.totalLabels} ${layout.totalLabels === 1 ? 'etiqueta' : 'etiquetas'} · ${pageCount} ${pageCount === 1 ? 'hoja' : 'hojas'}`

  useEffect(() => {
    if (pageIndex >= pageCount) setPageIndex(Math.max(0, pageCount - 1))
  }, [pageCount, pageIndex])

  function slotState(position: number): SlotState {
    if (position < startPosition) return 'skipped'
    if (position === startPosition) return 'start'
    if (position < startPosition + firstPageLabels) return 'filled'
    return 'empty'
  }

  function setQuantity(productId: number, value: string) {
    setQuantities((current) => ({ ...current, [productId]: value }))
    setPageIndex(0)
  }

  function stepQuantity(productId: number, delta: number) {
    const value = quantities[productId] ?? ''
    const base = validQuantity(value) ? Number(value) : 1
    setQuantity(productId, String(Math.max(1, base + delta)))
  }

  async function printLabels() {
    if (blocked) return
    setPrintSurfaceReady(true)
    await Promise.resolve()
    await nextFrame()
    await waitForPrintImages(printSurfaceRef.current)
    // Un error de imagen cambia cada etiqueta a la reserva textual; se espera
    // un cuadro adicional para que React pinte ese estado antes de imprimir.
    await nextFrame()
    if ('fonts' in document) await document.fonts.ready
    window.print()
  }

  function changePreviewScale(delta: number) {
    setManualScale(Math.round(clampScale(previewScale + delta) * 10) / 10)
    setFitMode(null)
  }

  const actionButtons = (
    <>
      {!loading && !loadError && products.length > 0 && (
        <p className="mr-auto text-body font-semibold tabular-nums text-ink">
          {summary}
        </p>
      )}
      <Button onClick={onClose} variant="secondary">
        Cancelar
      </Button>
      <Button disabled={blocked} onClick={() => void printLabels()}>
        <Printer aria-hidden="true" size={17} weight="bold" />
        Imprimir
      </Button>
    </>
  )

  return (
    <>
      <Modal
        actions={actionButtons}
        className="product-label-print-modal"
        description="Ajusta las copias, elige dónde empezar y revisa la hoja."
        mobileFullWidth
        onClose={onClose}
        open
        returnFocusRef={returnFocusRef}
        size="media"
        title="Imprimir etiquetas"
      >
        {loading ? (
          <p className="py-10 text-center text-ink-muted">
            Cargando productos…
          </p>
        ) : loadError ? (
          <div className="rounded-panel bg-danger-soft p-4" role="alert">
            <p className="font-semibold text-danger">{loadError}</p>
            {onRetry && (
              <Button className="mt-3" onClick={onRetry} variant="secondary">
                Reintentar lote
              </Button>
            )}
          </div>
        ) : (
          <div className="product-label-modal-layout grid h-full min-h-0 min-w-0 gap-5 lg:grid-cols-[minmax(22rem,25rem)_minmax(0,1fr)]">
            <div className="product-label-modal-controls min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1">
              <section
                aria-labelledby="label-copies-heading"
                className="overflow-hidden rounded-panel border border-line"
              >
                <StepHeading
                  id="label-copies-heading"
                  meta={
                    <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-label font-semibold text-accent-strong tabular-nums">
                      {layout.totalLabels} etiquetas
                    </span>
                  }
                  step={1}
                >
                  Copias
                </StepHeading>
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                  <span className="text-label text-ink-muted">
                    {products.length}{' '}
                    {products.length === 1
                      ? 'producto seleccionado'
                      : 'productos seleccionados'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Field hideLabel label="Copias para todos">
                      <Input
                        aria-label="Copias para todos"
                        className="w-16"
                        min="1"
                        onChange={(event) =>
                          setApplyQuantity(event.target.value)
                        }
                        step="1"
                        type="number"
                        value={applyQuantity}
                      />
                    </Field>
                    <Button
                      disabled={!validQuantity(applyQuantity)}
                      onClick={() => {
                        setQuantities(
                          Object.fromEntries(
                            products.map(({ id }) => [id, applyQuantity]),
                          ),
                        )
                        setPageIndex(0)
                      }}
                      variant="soft"
                    >
                      Aplicar a todos
                    </Button>
                  </div>
                </div>
                <ul
                  className="max-h-60 overflow-y-auto"
                  data-testid="product-label-quantity-list"
                >
                  {products.map((product) => {
                    const value = quantities[product.id] ?? ''
                    const valid = validQuantity(value)
                    return (
                      <li
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-2 last:border-0 hover:bg-surface-subtle data-[active=true]:bg-accent-soft/60"
                        data-active={
                          highlightedProductId === product.id || undefined
                        }
                        data-testid={`product-label-quantity-row-${product.id}`}
                        key={product.id}
                        onBlur={() => setHighlightedProductId(null)}
                        onFocus={() => setHighlightedProductId(product.id)}
                        onMouseEnter={() => setHighlightedProductId(product.id)}
                        onMouseLeave={() => setHighlightedProductId(null)}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {product.name}
                          </p>
                          <p className="truncate code text-label text-ink-muted">
                            {product.code}
                          </p>
                        </div>
                        <Field
                          error={
                            valid
                              ? undefined
                              : 'Ingresa un entero mayor que cero.'
                          }
                          hideLabel
                          label={`Copias de ${product.name}`}
                        >
                          <div className="flex w-[7.5rem] items-center rounded-control border border-line-strong bg-surface">
                            <IconButton
                              className="size-9 min-h-9"
                              disabled={valid && Number(value) <= 1}
                              icon={<Minus size={14} weight="bold" />}
                              label={`Quitar una copia de ${product.name}`}
                              onClick={() => stepQuantity(product.id, -1)}
                            />
                            <Input
                              aria-label={`Copias de ${product.name}`}
                              className="product-label-quantity-input h-9 min-h-9 w-full min-w-0 border-0 px-0 text-center font-semibold tabular-nums"
                              min="1"
                              onChange={(event) =>
                                setQuantity(product.id, event.target.value)
                              }
                              step="1"
                              type="number"
                              value={value}
                            />
                            <IconButton
                              className="size-9 min-h-9"
                              icon={<Plus size={14} weight="bold" />}
                              label={`Añadir una copia de ${product.name}`}
                              onClick={() => stepQuantity(product.id, 1)}
                            />
                          </div>
                        </Field>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section
                aria-labelledby="label-size-heading"
                className="overflow-hidden rounded-panel border border-line"
              >
                <StepHeading
                  id="label-size-heading"
                  meta={
                    <span className="rounded-chip bg-surface-muted px-2 py-0.5 text-label font-semibold text-ink-muted">
                      {`${LABEL_WIDTH_MM} × ${LABEL_HEIGHT_MM} mm · ${grid.capacity} por hoja`}
                    </span>
                  }
                  step={2}
                >
                  Tamaño y posición
                </StepHeading>
                <div className="flex items-center gap-4 px-3 py-3">
                  <div
                    aria-label="Posición inicial"
                    className="product-label-slot-sheet"
                    role="group"
                    style={{
                      gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: grid.capacity }, (_, index) => {
                      const position = index + 1
                      const state = slotState(position)
                      return (
                        <button
                          aria-label={`Empezar en posición ${position}`}
                          aria-pressed={state === 'start'}
                          className="product-label-slot"
                          data-state={state}
                          key={position}
                          onClick={() => {
                            setStartPosition(position)
                            setPageIndex(0)
                          }}
                          type="button"
                        >
                          {position}
                        </button>
                      )
                    })}
                  </div>
                  <ul className="space-y-2 text-label text-ink-muted">
                    <li className="flex items-center gap-2">
                      <span
                        className="product-label-slot-key"
                        data-state="skipped"
                      />
                      Ya usada
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="product-label-slot-key"
                        data-state="start"
                      />
                      Inicio
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="product-label-slot-key"
                        data-state="filled"
                      />
                      Se imprime
                    </li>
                    <li className="pt-1 font-semibold text-ink">
                      {`Hoja 1: ${firstPageLabels} de ${grid.capacity - startPosition + 1} libres`}
                    </li>
                  </ul>
                </div>
              </section>

              <section
                aria-labelledby="label-check-heading"
                className="overflow-hidden rounded-panel border border-line"
              >
                <StepHeading id="label-check-heading" step={3}>
                  Antes de imprimir
                </StepHeading>
                <div className="space-y-3 px-3 py-3">
                  <div className="flex flex-wrap gap-2 text-label font-semibold">
                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-warning-soft px-2 py-1 text-warning">
                      <WarningCircle
                        aria-hidden="true"
                        size={14}
                        weight="bold"
                      />
                      Escala 100 %
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-warning-soft px-2 py-1 text-warning">
                      <WarningCircle
                        aria-hidden="true"
                        size={14}
                        weight="bold"
                      />
                      Sin encabezados ni pies
                    </span>
                    {brandReady && (
                      <span className="inline-flex items-center gap-1.5 rounded-chip bg-success-soft px-2 py-1 text-success">
                        <CheckCircle
                          aria-hidden="true"
                          size={14}
                          weight="bold"
                        />
                        Identidad lista
                      </span>
                    )}
                  </div>
                  {issuer.isPending && (
                    <p className="text-label text-ink-muted">
                      Preparando identidad comercial…
                    </p>
                  )}
                  {brandFailed && (
                    <div
                      className="rounded-panel bg-danger-soft p-3"
                      role="alert"
                    >
                      <p className="font-semibold text-danger">
                        No se pudo preparar la identidad comercial.
                      </p>
                      <Button
                        className="mt-2"
                        onClick={issuer.retry}
                        variant="secondary"
                      >
                        Reintentar identidad
                      </Button>
                    </div>
                  )}
                  {incompatibleProducts.length > 0 && (
                    <div
                      className="rounded-panel bg-danger-soft p-3"
                      role="alert"
                    >
                      <p className="font-semibold text-danger">
                        Estos códigos no se pueden representar en Code 128:
                      </p>
                      <ul className="mt-1 list-disc pl-5">
                        {incompatibleProducts.map((product) => (
                          <li key={product.id}>
                            {product.name} — {product.code}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section
              aria-labelledby="label-preview-heading"
              className="product-label-preview-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-canvas"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
                <div>
                  <h3 className="font-bold" id="label-preview-heading">
                    Vista previa
                  </h3>
                  <p className="text-label text-ink-muted">
                    A4 · {grid.capacity} etiquetas por hoja
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div
                    aria-label="Tamaño de la vista previa"
                    className="flex items-center rounded-control border border-line bg-surface p-0.5"
                    role="group"
                  >
                    <IconButton
                      className="size-8 min-h-8"
                      disabled={previewScale <= MIN_PREVIEW_SCALE}
                      icon={<MagnifyingGlassMinus size={17} />}
                      label="Reducir zoom"
                      onClick={() => changePreviewScale(-PREVIEW_SCALE_STEP)}
                    />
                    <output
                      aria-label="Nivel de zoom"
                      aria-live="polite"
                      className="min-w-12 text-center text-label font-semibold tabular-nums"
                      role="status"
                    >
                      {Math.round(previewScale * 100)} %
                    </output>
                    <IconButton
                      className="size-8 min-h-8"
                      disabled={previewScale >= MAX_PREVIEW_SCALE}
                      icon={<MagnifyingGlassPlus size={17} />}
                      label="Aumentar zoom"
                      onClick={() => changePreviewScale(PREVIEW_SCALE_STEP)}
                    />
                    <IconButton
                      aria-pressed={fitMode === 'width'}
                      className="size-8 min-h-8 aria-pressed:bg-accent-soft aria-pressed:text-accent-strong"
                      icon={<ArrowsHorizontal size={17} />}
                      label="Ajustar ancho"
                      onClick={() => setFitMode('width')}
                    />
                    <IconButton
                      aria-pressed={fitMode === 'page'}
                      className="size-8 min-h-8 aria-pressed:bg-accent-soft aria-pressed:text-accent-strong"
                      icon={<CornersOut size={17} />}
                      label="Ver hoja completa"
                      onClick={() => setFitMode('page')}
                    />
                  </div>
                  {pageCount > 0 && (
                    <div className="flex items-center gap-1 rounded-control border border-line bg-surface p-0.5">
                      <IconButton
                        className="size-8 min-h-8"
                        disabled={pageIndex === 0}
                        icon={<CaretLeft size={16} weight="bold" />}
                        label="Página anterior"
                        onClick={() => setPageIndex((current) => current - 1)}
                      />
                      <span
                        aria-live="polite"
                        className="px-1 text-label font-semibold tabular-nums"
                      >
                        Página {pageIndex + 1} de {pageCount}
                      </span>
                      <IconButton
                        className="size-8 min-h-8"
                        disabled={pageIndex >= pageCount - 1}
                        icon={<CaretRight size={16} weight="bold" />}
                        label="Página siguiente"
                        onClick={() => setPageIndex((current) => current + 1)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div
                className="product-label-preview min-h-0 flex-1 overflow-auto"
                ref={setPreviewElement}
              >
                {visiblePage && incompatibleProducts.length === 0 ? (
                  <div className="product-label-preview-stage">
                    <div
                      className="product-label-preview-canvas"
                      data-testid="product-label-preview-canvas"
                      style={
                        {
                          '--product-label-preview-scale': previewScale,
                        } as CSSProperties
                      }
                    >
                      <ProductLabelSheet
                        brand={brand}
                        grid={grid}
                        highlightedProductId={highlightedProductId}
                        onLogoReady={
                          logoReadiness.timedOut
                            ? undefined
                            : () => logoReadiness.onBrandReady(true)
                        }
                        page={visiblePage}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid h-full min-h-56 place-items-center p-6 text-center text-ink-muted">
                    Corrige los datos para ver la hoja.
                  </div>
                )}
              </div>
              {pageCount > 1 && (
                <nav
                  aria-label="Páginas"
                  className="flex gap-2 overflow-x-auto border-t border-line bg-surface px-3 py-2"
                >
                  {layout.pages.map((page, index) => (
                    <button
                      aria-current={index === pageIndex ? 'page' : undefined}
                      aria-label={`Ver página ${index + 1}`}
                      className="product-label-page-thumb"
                      key={index}
                      onClick={() => setPageIndex(index)}
                      type="button"
                    >
                      <PageThumbnail page={page} />
                      <span className="text-micro font-semibold tabular-nums">
                        {index + 1}
                      </span>
                    </button>
                  ))}
                </nav>
              )}
            </section>
          </div>
        )}
      </Modal>

      <div
        aria-hidden="true"
        className="product-label-print-surface"
        ref={printSurfaceRef}
      >
        {printSurfaceReady
          ? layout.pages.map((page, index) => (
              <ProductLabelSheet
                brand={brand}
                grid={grid}
                key={index}
                page={page}
              />
            ))
          : null}
      </div>
    </>
  )
}

export function ProductLabelPrintModal(props: ProductLabelPrintModalProps) {
  if (!props.open) return null
  return <ModalContent {...props} />
}
