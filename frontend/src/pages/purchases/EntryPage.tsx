import {
  CaretDown,
  CaretUp,
  Info,
  Minus,
  Package,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import {
  addProduct,
  changeQuantity,
  emptyDraft,
  hasOptionalDetails,
  isDirty,
  removeLine,
  setCost,
  setQuantity,
  summarize,
  toInput,
  validateDraft,
  type EntryDraft,
} from '@/features/purchases/entry'
import { EntryReviewDialog } from '@/features/purchases/EntryReviewDialog'
import { usePurchaseMutations } from '@/features/purchases/hooks'
import { useSupplierOptions } from '@/features/purchases/pickers'
import { ProductSearch } from '@/features/purchases/ProductSearch'
import type { EntryReview } from '@/features/purchases/types'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import {
  Button,
  Checkbox,
  Combobox,
  ConfirmationPanel,
  Field,
  getControlClasses,
  InlineNotice,
  Input,
  StatusBadge,
  Textarea,
  Tooltip,
  useToast,
} from '@/shared/ui'

import '@/features/sales/sales.css'
import '@/features/purchases/entry.css'

const plural = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`

/**
 * Registro de una entrada de stock en un paso: buscar, ajustar la cantidad y confirmar.
 * Proveedor, referencia, observación y costos son opcionales y permanecen plegados.
 */
export function EntryPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const mutations = usePurchaseMutations()
  const tracker = useIntentTracker()
  const latest = useLatestReview<EntryReview>()
  const searchRef = useRef<HTMLInputElement>(null)

  const [draft, setDraftState] = useState<EntryDraft>(emptyDraft)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const dirty = isDirty(draft)
  const totals = useMemo(() => summarize(draft.lines), [draft.lines])
  const hidden = hasOptionalDetails(draft) && !detailsOpen

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update(next: Partial<EntryDraft>) {
    setDraftState((prev) => ({ ...prev, ...next }))
    latest.invalidate()
    setDialogOpen(false)
    setProblem(null)
  }

  function showProblem(error: unknown): ProblemView {
    const view = describeProblem(error)
    setProblem(view)
    setErrors((prev) => ({ ...prev, ...view.fields }))
    return view
  }

  async function requestReview(): Promise<boolean> {
    const result = await latest.request(() =>
      mutations.review.mutateAsync(toInput(draft)),
    )
    if (result) {
      setDialogOpen(true)
      return true
    }
    return false
  }

  async function onReview() {
    if (busy) return
    const local = validateDraft(draft)
    setErrors(local)
    if (Object.keys(local).length > 0) {
      setProblem({
        message: 'Corrija los campos marcados antes de continuar.',
        fields: local,
        uncertain: false,
        staleRecord: false,
      })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      if (!(await requestReview())) {
        // El error de la revisión queda en `latest.error`; se muestra en el siguiente render.
        setProblem({
          message: 'No se pudo revisar la entrada. Reintente.',
          fields: {},
          uncertain: true,
          staleRecord: false,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function onConfirm(acknowledged: number[]) {
    if (busy) return
    const input = toInput(draft, acknowledged)
    setBusy(true)
    try {
      const registered = await tracker.run(input, (key) =>
        mutations.register.mutateAsync({ input, key }),
      )
      toast.success(
        registered.internal_number
          ? `Entrada ${registered.internal_number} registrada.`
          : 'Entrada registrada.',
        { href: `/purchases/${registered.id}`, linkLabel: 'Ver entrada' },
      )
      setDraftState(emptyDraft())
      setErrors({})
      setProblem(null)
      setDetailsOpen(false)
      setDialogOpen(false)
      latest.invalidate()
      searchRef.current?.focus()
    } catch (error) {
      if (
        error instanceof ProblemError &&
        (error.code === 'possible_duplicate' ||
          error.code === 'review_required')
      ) {
        setNotice(
          error.code === 'possible_duplicate'
            ? 'Mientras revisaba se registró una entrada igual. Revise de nuevo.'
            : 'Algo cambió desde la revisión. Revise de nuevo.',
        )
        await requestReview()
      } else {
        setDialogOpen(false)
        showProblem(error)
      }
    } finally {
      setBusy(false)
    }
  }

  const costed = draft.lines.filter((line) => line.cost.trim() !== '').length
  const hasLines = draft.lines.length > 0

  return (
    <div className="catalog-page sale-screen">
      <header className="sale-topbar">
        <div className="sale-topbar-title">
          <h1>Nueva entrada</h1>
          <p>Registre la mercadería que llegó a la bodega</p>
        </div>
        <div className="sale-topbar-status">
          <StatusBadge label="Nueva" tone="neutral" />
          {dirty && <span className="sale-unsaved">Sin confirmar</span>}
        </div>
      </header>

      <div className="entry-workspace">
        <section
          aria-label="Captura de la entrada"
          className="sale-editor-panel"
        >
          <div className="sale-editor-scroll">
            {problem && (
              <InlineNotice title="No se registró la entrada" tone="danger">
                {problem.message}
              </InlineNotice>
            )}
            <section aria-label="Productos" className="sale-section">
              <div className="sale-section-head">
                <h2>Productos</h2>
                <span className="sale-section-hint">
                  Escanee o escriba el código y pulse Enter
                </span>
              </div>
              <div className="entry-search">
                <ProductSearch
                  onChoose={(product) => {
                    update({ lines: addProduct(draft.lines, product) })
                    setErrors({})
                  }}
                  ref={searchRef}
                />
                {errors.lines && (
                  <p
                    className="pb-1 text-label font-semibold text-danger"
                    role="alert"
                  >
                    {errors.lines}
                  </p>
                )}
              </div>
              <div className="entry-lines-wrap">
                <table className="entry-lines">
                  <caption className="sr-only">
                    Productos de la entrada: producto, cantidad
                    {draft.costsOn ? ' y costo unitario' : ''}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      {draft.costsOn && (
                        <th className="cost" scope="col">
                          Costo unitario (USD)
                        </th>
                      )}
                      <th className="qty" scope="col">
                        Cantidad
                      </th>
                      <th className="action" scope="col">
                        <span className="sr-only">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasLines && (
                      <tr className="entry-empty">
                        <td colSpan={draft.costsOn ? 4 : 3}>
                          <span className="entry-empty-icon">
                            <Package aria-hidden="true" size={22} />
                          </span>
                          <p>Aún no agregó productos</p>
                          <small>Use el buscador para empezar.</small>
                        </td>
                      </tr>
                    )}
                    {draft.lines.map((line, index) => {
                      const quantityError = errors[`lines.${index}.quantity`]
                      const costError = errors[`lines.${index}.unit_cost`]
                      const quantityErrorId = `qty-${line.productId}-error`
                      const costErrorId = `cost-${line.productId}-error`
                      return (
                        <tr
                          className="entry-line"
                          data-error={Boolean(quantityError || costError)}
                          key={line.productId}
                        >
                          <td className="product">
                            <span className="entry-product-code">
                              {line.code}
                            </span>
                            {line.unit && (
                              <span className="entry-product-unit">
                                {' '}
                                · {line.unit}
                              </span>
                            )}
                            <span className="entry-product-name">
                              {line.name}
                            </span>
                          </td>
                          {draft.costsOn && (
                            <td className="cost">
                              <input
                                aria-describedby={
                                  costError ? costErrorId : undefined
                                }
                                aria-invalid={costError ? true : undefined}
                                aria-label={`Costo de ${line.code}`}
                                className={`${getControlClasses({ density: 'compact42' })} entry-cost w-full`}
                                id={`cost-${line.productId}`}
                                inputMode="decimal"
                                onChange={(event) =>
                                  update({
                                    lines: setCost(
                                      draft.lines,
                                      line.productId,
                                      event.target.value,
                                    ),
                                  })
                                }
                                placeholder="Sin costo"
                                value={line.cost}
                              />
                              {costError && (
                                <p
                                  className="sale-field-note font-semibold text-danger"
                                  id={costErrorId}
                                  role="alert"
                                >
                                  {costError}
                                </p>
                              )}
                            </td>
                          )}
                          <td className="qty">
                            <span
                              className="entry-stepper"
                              data-error={Boolean(quantityError)}
                            >
                              <button
                                aria-label={`Quitar una unidad de ${line.code}`}
                                disabled={Number(line.quantity) <= 1}
                                onClick={() =>
                                  update({
                                    lines: changeQuantity(
                                      draft.lines,
                                      line.productId,
                                      -1,
                                    ),
                                  })
                                }
                                type="button"
                              >
                                <Minus aria-hidden="true" size={16} />
                              </button>
                              <input
                                aria-describedby={
                                  quantityError ? quantityErrorId : undefined
                                }
                                aria-invalid={quantityError ? true : undefined}
                                aria-label={`Cantidad de ${line.code}`}
                                id={`qty-${line.productId}`}
                                inputMode="numeric"
                                onChange={(event) =>
                                  update({
                                    lines: setQuantity(
                                      draft.lines,
                                      line.productId,
                                      event.target.value,
                                    ),
                                  })
                                }
                                onFocus={(event) => event.target.select()}
                                value={line.quantity}
                              />
                              <button
                                aria-label={`Agregar una unidad de ${line.code}`}
                                onClick={() =>
                                  update({
                                    lines: changeQuantity(
                                      draft.lines,
                                      line.productId,
                                      1,
                                    ),
                                  })
                                }
                                type="button"
                              >
                                <Plus aria-hidden="true" size={16} />
                              </button>
                            </span>
                            {quantityError && (
                              <p
                                className="sale-field-note font-semibold text-danger"
                                id={quantityErrorId}
                                role="alert"
                              >
                                {quantityError}
                              </p>
                            )}
                          </td>
                          <td className="action">
                            <Tooltip
                              content={`Quitar ${line.code}`}
                              position="left"
                            >
                              <button
                                aria-label={`Quitar ${line.code}`}
                                className="sale-icon-button danger"
                                onClick={() =>
                                  update({
                                    lines: removeLine(
                                      draft.lines,
                                      line.productId,
                                    ),
                                  })
                                }
                                type="button"
                              >
                                <Trash aria-hidden="true" size={18} />
                              </button>
                            </Tooltip>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-label="Detalles opcionales" className="sale-section">
              <button
                aria-controls="entry-details"
                aria-expanded={detailsOpen}
                className="sale-section-head entry-details-toggle"
                onClick={() => setDetailsOpen((open) => !open)}
                type="button"
              >
                <span className="entry-details-title">Más detalles</span>
                <span className="sale-section-hint">
                  Proveedor, referencia y costos
                </span>
                <span className="entry-details-end">
                  {hidden ? (
                    <span className="entry-chip" data-tone="accent">
                      Con datos
                    </span>
                  ) : (
                    <span className="entry-chip">Opcional</span>
                  )}
                  {detailsOpen ? (
                    <CaretUp aria-hidden="true" size={16} />
                  ) : (
                    <CaretDown aria-hidden="true" size={16} />
                  )}
                </span>
              </button>
              {detailsOpen && (
                <div className="entry-details-grid" id="entry-details">
                  <div className="sale-field">
                    <label htmlFor="entry-supplier">Proveedor</label>
                    <Combobox
                      clearable
                      error={errors.supplier_id}
                      id="entry-supplier"
                      inactiveHelp="Proveedor inactivo."
                      label="Proveedor"
                      onSelect={(supplier) => update({ supplier })}
                      placeholder="Buscar por nombre"
                      selected={draft.supplier}
                      useOptions={useSupplierOptions}
                    />
                  </div>
                  <Field
                    error={errors.reference}
                    hint="Por ejemplo, el número de la factura."
                    id="entry-reference"
                    label="Referencia"
                  >
                    <Input
                      className="code"
                      maxLength={128}
                      onChange={(event) =>
                        update({ reference: event.target.value })
                      }
                      value={draft.reference}
                    />
                  </Field>
                  <div className="span-2">
                    <Field
                      error={errors.observation}
                      id="entry-observation"
                      label="Observación"
                    >
                      <Textarea
                        maxLength={2000}
                        onChange={(event) =>
                          update({ observation: event.target.value })
                        }
                        resize="none"
                        rows={2}
                        value={draft.observation}
                      />
                    </Field>
                  </div>
                  <div className="span-2">
                    <Checkbox
                      checked={draft.costsOn}
                      label="Registrar costos"
                      onChange={(event) =>
                        update({ costsOn: event.target.checked })
                      }
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
          <div className="sale-actions entry-actions">
            <div className="sale-actions-total">
              <span>Entran</span>
              <strong
                aria-live="polite"
                className="entry-total"
                data-empty={!hasLines}
              >
                {hasLines
                  ? `${plural(totals.products, 'producto', 'productos')} · ${plural(totals.units, 'unidad', 'unidades')}`
                  : 'Nada por registrar'}
              </strong>
            </div>
            <Button
              onClick={() =>
                dirty ? setDiscardOpen(true) : navigate('/purchases')
              }
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !hasLines}
              onClick={() => void onReview()}
              type="button"
            >
              {busy ? 'Revisando…' : 'Revisar y confirmar'}
            </Button>
          </div>
        </section>

        <aside
          aria-label="Resumen de la entrada"
          className="entry-summary sale-section"
        >
          <div className="sale-section-head">
            <h2>Resumen</h2>
          </div>
          <div className="entry-tiles">
            <div className="entry-tile">
              <strong>{totals.products}</strong>
              <span>{totals.products === 1 ? 'Producto' : 'Productos'}</span>
            </div>
            <div className="entry-tile units">
              <strong>{totals.units}</strong>
              <span>{totals.units === 1 ? 'Unidad' : 'Unidades'}</span>
            </div>
          </div>
          <dl className="entry-facts">
            <div>
              <dt>Proveedor</dt>
              <dd data-empty={!draft.supplier}>
                {draft.supplier?.label ?? 'Sin indicar'}
              </dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd
                className={draft.reference.trim() ? 'code' : undefined}
                data-empty={!draft.reference.trim()}
              >
                {draft.reference.trim() || 'Sin indicar'}
              </dd>
            </div>
            <div>
              <dt>Costos</dt>
              <dd>
                {!draft.costsOn ? (
                  <span className="entry-chip">No se registran</span>
                ) : (
                  <span
                    className="entry-chip"
                    data-tone={
                      hasLines && costed === totals.products
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {costed} de {totals.products} con costo
                  </span>
                )}
              </dd>
            </div>
          </dl>
          <p className="entry-hint">
            <Info aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            Al confirmar, las unidades se suman a la existencia.
          </p>
        </aside>
      </div>

      <EntryReviewDialog
        message={notice}
        onClose={() => {
          setDialogOpen(false)
          setNotice(null)
        }}
        onConfirm={(ack) => void onConfirm(ack)}
        pending={busy}
        returnFocusRef={searchRef}
        review={dialogOpen ? latest.review : null}
      />
      <ConfirmationPanel
        cancelLabel="Seguir editando"
        confirmLabel="Descartar y salir"
        description="Si sale ahora perderá lo que escribió."
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => navigate('/purchases')}
        open={discardOpen}
        title="¿Descartar la entrada?"
        tone="danger"
        width="420"
      />
    </div>
  )
}
