import {
  ArrowsHorizontal,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from '@phosphor-icons/react'
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

import { useIssuerBrandStatus } from '@/shared/api/entity-logos'
import { Button, Field, IconButton, Input, Modal } from '@/shared/ui'
import { useSheetBrandReady } from '@/shared/ui/business'

import { Code128EncodingError, encodeCode128 } from './code128'
import { ProductLabelSheet } from './ProductLabelSheet'
import './product-label-print.css'
import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  buildLabelPages,
  calculateLabelGrid,
  validateLabelComposition,
  type ProductLabelData,
} from './label-layout'

const FIT_PREVIEW_SCALE = 0.5
const MIN_PREVIEW_SCALE = 0.3
const MAX_PREVIEW_SCALE = 1.3
const PREVIEW_SCALE_STEP = 0.1

export interface ProductLabelPrintModalProps {
  loadError?: string | null | undefined
  loading?: boolean | undefined
  onClose: () => void
  onRetry?: (() => void) | undefined
  open: boolean
  products: ProductLabelData[]
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
}

function validQuantity(value: string): boolean {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0
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
  const [width, setWidth] = useState(String(DEFAULT_LABEL_WIDTH_MM))
  const [height, setHeight] = useState(String(DEFAULT_LABEL_HEIGHT_MM))
  const [startPosition, setStartPosition] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [previewScale, setPreviewScale] = useState(FIT_PREVIEW_SCALE)
  const [positionAnnouncement, setPositionAnnouncement] = useState('')
  const [printSurfaceReady, setPrintSurfaceReady] = useState(false)

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

  const gridResult = useMemo(() => {
    try {
      return {
        grid: calculateLabelGrid(Number(width), Number(height)),
        error: null,
      }
    } catch (error) {
      return {
        grid: null,
        error:
          error instanceof Error
            ? error.message
            : 'Revisa el tamaño de la etiqueta.',
      }
    }
  }, [height, width])

  useEffect(() => {
    if (gridResult.grid && startPosition > gridResult.grid.capacity) {
      setStartPosition(1)
      setPageIndex(0)
      setPositionAnnouncement(
        'La posición inicial volvió a 1 porque ya no existe.',
      )
    }
  }, [gridResult.grid, startPosition])

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
  const layout = gridResult.grid
    ? buildLabelPages(items, gridResult.grid, startPosition)
    : null
  const composition = gridResult.grid
    ? validateLabelComposition(
        gridResult.grid.labelWidthMm,
        gridResult.grid.labelHeightMm,
      )
    : null
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
  const blocked =
    loading ||
    Boolean(loadError) ||
    products.length === 0 ||
    invalidQuantities ||
    !gridResult.grid ||
    composition?.valid === false ||
    incompatibleProducts.length > 0 ||
    issuer.isPending ||
    brandFailed ||
    !logoReadiness.ready
  const brand = {
    displayName: issuer.displayName ?? issuer.legalName ?? '',
    logoUrl: logoReadiness.timedOut ? null : (issuer.logoUrl ?? null),
  }
  const visiblePage = layout?.pages[pageIndex]
  const pageCount = layout?.pages.length ?? 0

  useEffect(() => {
    if (pageIndex >= pageCount) setPageIndex(Math.max(0, pageCount - 1))
  }, [pageCount, pageIndex])

  async function printLabels() {
    if (blocked) return
    setPrintSurfaceReady(true)
    await Promise.resolve()
    await new Promise<void>((resolve) => {
      const schedule =
        window.requestAnimationFrame ??
        ((callback) => window.setTimeout(callback, 0))
      schedule(() => resolve())
    })
    if ('fonts' in document) await document.fonts.ready
    window.print()
  }

  function changePreviewScale(delta: number) {
    setPreviewScale(
      (current) =>
        Math.round(
          Math.min(
            MAX_PREVIEW_SCALE,
            Math.max(MIN_PREVIEW_SCALE, current + delta),
          ) * 10,
        ) / 10,
    )
  }

  const actionButtons = (
    <>
      <Button onClick={onClose} variant="secondary">
        Cancelar
      </Button>
      <Button disabled={blocked} onClick={() => void printLabels()}>
        Imprimir
      </Button>
    </>
  )

  return (
    <>
      <Modal
        actions={actionButtons}
        className="product-label-print-modal"
        description="Define las copias y revisa la hoja antes de abrir la impresión del navegador."
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
          <div className="rounded-card bg-danger-soft p-4" role="alert">
            <p className="font-semibold text-danger">{loadError}</p>
            {onRetry && (
              <Button className="mt-3" onClick={onRetry} variant="secondary">
                Reintentar lote
              </Button>
            )}
          </div>
        ) : (
          <div className="product-label-modal-layout grid h-full min-h-0 min-w-0 gap-5 lg:grid-cols-[minmax(21rem,24rem)_minmax(0,1fr)]">
            <div className="product-label-modal-controls min-h-0 min-w-0 space-y-5 overflow-y-auto pr-1">
              <section aria-labelledby="label-copies-heading">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="font-bold" id="label-copies-heading">
                      Copias
                    </h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {layout?.totalLabels ?? 0} etiquetas
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <Field hideLabel label="Copias para todos">
                      <Input
                        aria-label="Copias para todos"
                        className="w-20"
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
                <div className="mt-3 overflow-hidden rounded-card border border-line">
                  <div className="flex items-center justify-between gap-3 bg-surface-subtle px-3 py-2 text-xs text-ink-muted">
                    <span className="font-semibold text-ink">
                      {products.length}{' '}
                      {products.length === 1
                        ? 'producto seleccionado'
                        : 'productos seleccionados'}
                    </span>
                    {products.length > 3 && <span>Desplaza para editar</span>}
                  </div>
                  <div
                    className="max-h-36 overflow-y-auto px-3"
                    data-testid="product-label-quantity-list"
                  >
                    {products.map((product) => {
                      const value = quantities[product.id] ?? ''
                      return (
                        <div
                          className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 border-b border-line py-1.5 last:border-0"
                          key={product.id}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {product.name}
                            </p>
                            <p className="truncate font-mono text-xs text-ink-muted">
                              {product.code}
                            </p>
                          </div>
                          <Field
                            error={
                              validQuantity(value)
                                ? undefined
                                : 'Ingresa un entero mayor que cero.'
                            }
                            hideLabel
                            label={`Copias de ${product.name}`}
                          >
                            <Input
                              aria-label={`Copias de ${product.name}`}
                              min="1"
                              onChange={(event) => {
                                setQuantities((current) => ({
                                  ...current,
                                  [product.id]: event.target.value,
                                }))
                                setPageIndex(0)
                              }}
                              step="1"
                              type="number"
                              value={value}
                            />
                          </Field>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              <section aria-labelledby="label-size-heading">
                <h3 className="font-bold" id="label-size-heading">
                  Tamaño y posición
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field
                    error={gridResult.error ?? undefined}
                    label="Ancho (mm)"
                  >
                    <Input
                      min="1"
                      onChange={(event) => setWidth(event.target.value)}
                      step="0.1"
                      type="number"
                      value={width}
                    />
                  </Field>
                  <Field label="Alto (mm)">
                    <Input
                      min="1"
                      onChange={(event) => setHeight(event.target.value)}
                      step="0.1"
                      type="number"
                      value={height}
                    />
                  </Field>
                </div>
                {composition?.valid === false && (
                  <p
                    className="mt-2 text-xs font-semibold text-danger"
                    role="alert"
                  >
                    {composition.message}
                  </p>
                )}
                {gridResult.grid && (
                  <div
                    aria-label="Posición inicial"
                    className="mt-3 grid max-w-xs gap-1.5"
                    role="group"
                    style={{
                      gridTemplateColumns: `repeat(${gridResult.grid.columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from(
                      { length: gridResult.grid.capacity },
                      (_, index) => {
                        const position = index + 1
                        return (
                          <button
                            aria-label={`Empezar en posición ${position}`}
                            aria-pressed={startPosition === position}
                            className="min-h-9 rounded-control border border-line-strong bg-surface text-xs font-semibold text-ink hover:bg-surface-subtle aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-strong"
                            key={position}
                            onClick={() => {
                              setStartPosition(position)
                              setPageIndex(0)
                              setPositionAnnouncement('')
                            }}
                            type="button"
                          >
                            {position}
                          </button>
                        )
                      },
                    )}
                  </div>
                )}
                <p aria-live="polite" className="sr-only" role="status">
                  {positionAnnouncement}
                </p>
              </section>

              {issuer.isPending && (
                <p className="text-xs text-ink-muted">
                  Preparando identidad comercial…
                </p>
              )}
              {brandFailed && (
                <div className="rounded-card bg-danger-soft p-3" role="alert">
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
                <div className="rounded-card bg-danger-soft p-3" role="alert">
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

              <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-card bg-info-soft p-3 text-xs font-semibold text-info-strong">
                <span>Escala 100 %</span>
                <span>Sin encabezados ni pies</span>
              </div>
            </div>

            <section
              aria-labelledby="label-preview-heading"
              className="flex min-h-0 min-w-0 flex-col"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold" id="label-preview-heading">
                    Vista previa
                  </h3>
                  {gridResult.grid && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      A4 · {gridResult.grid.capacity} etiquetas por hoja
                    </p>
                  )}
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
                      className="min-w-12 text-center text-xs font-semibold tabular-nums"
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
                      aria-pressed={previewScale === FIT_PREVIEW_SCALE}
                      className="size-8 min-h-8"
                      icon={<ArrowsHorizontal size={17} />}
                      label="Ajustar hoja"
                      onClick={() => setPreviewScale(FIT_PREVIEW_SCALE)}
                    />
                  </div>
                  {pageCount > 1 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        aria-label="Página anterior"
                        disabled={pageIndex === 0}
                        onClick={() => setPageIndex((current) => current - 1)}
                        variant="ghost"
                      >
                        Anterior
                      </Button>
                      <span
                        aria-live="polite"
                        className="text-xs font-semibold tabular-nums"
                      >
                        Página {pageIndex + 1} de {pageCount}
                      </span>
                      <Button
                        aria-label="Página siguiente"
                        disabled={pageIndex >= pageCount - 1}
                        onClick={() => setPageIndex((current) => current + 1)}
                        variant="ghost"
                      >
                        Siguiente
                      </Button>
                    </div>
                  ) : pageCount === 1 ? (
                    <span className="px-2 text-xs font-semibold tabular-nums">
                      Página 1 de 1
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="product-label-preview mt-3 min-h-0 flex-1 overflow-auto rounded-card border border-line bg-canvas">
                {visiblePage &&
                gridResult.grid &&
                incompatibleProducts.length === 0 ? (
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
                        grid={gridResult.grid}
                        onLogoReady={() => logoReadiness.onBrandReady(true)}
                        page={visiblePage}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-56 place-items-center p-6 text-center text-ink-muted">
                    Corrige los datos para ver la hoja.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </Modal>

      <div aria-hidden="true" className="product-label-print-surface">
        {printSurfaceReady && gridResult.grid && layout
          ? layout.pages.map((page, index) => (
              <ProductLabelSheet
                brand={brand}
                grid={gridResult.grid!}
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
