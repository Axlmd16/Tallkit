import {
  CaretDown,
  CaretUp,
  Minus,
  Plus,
  Tray,
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
  Dialog,
  Field,
  IconButton,
  InlineNotice,
  Input,
  PageHeader,
  Textarea,
  useToast,
} from '@/shared/ui'

const panel = 'rounded-panel border border-line bg-surface'

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

  const supplierHint = draft.supplier ? undefined : 'Opcional'

  return (
    <div className="catalog-page space-y-4">
      <PageHeader
        actions={
          <Button
            onClick={() =>
              dirty ? setDiscardOpen(true) : navigate('/purchases')
            }
            type="button"
            variant="quiet"
          >
            Cancelar
          </Button>
        }
        description="Busque o escanee lo que llegó."
        title="Nueva entrada"
      />

      {problem && (
        <InlineNotice title="No se registró la entrada" tone="danger">
          {problem.message}
        </InlineNotice>
      )}

      <section aria-label="Productos" className={`${panel} p-4`}>
        <ProductSearch
          onChoose={(product) => {
            update({ lines: addProduct(draft.lines, product) })
            setErrors({})
          }}
          ref={searchRef}
        />
        {errors.lines && (
          <p className="mt-1 text-xs font-semibold text-danger" role="alert">
            {errors.lines}
          </p>
        )}
        {draft.lines.length === 0 ? (
          <div className="mt-2 flex flex-col items-center gap-2 rounded-control bg-surface-subtle py-10 text-ink-muted">
            <Tray aria-hidden="true" size={32} />
            <p className="text-sm">Aún no agregó productos</p>
          </div>
        ) : (
          <ul
            aria-label="Productos de la entrada"
            className="mt-2 divide-y divide-line rounded-control border border-line"
          >
            {draft.lines.map((line, index) => (
              <li
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 md:grid-cols-[1fr_auto_auto_auto]"
                key={line.productId}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    <span className="font-mono font-semibold">{line.code}</span>{' '}
                    {line.name}
                  </p>
                  {line.unit && (
                    <p className="text-xs text-ink-muted">{line.unit}</p>
                  )}
                </div>
                {draft.costsOn && (
                  <div className="order-3 col-span-2 md:order-none md:col-span-1 md:w-36">
                    <Field
                      error={errors[`lines.${index}.unit_cost`]}
                      hideLabel
                      id={`cost-${line.productId}`}
                      label={`Costo de ${line.code}`}
                    >
                      <Input
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
                    </Field>
                  </div>
                )}
                <div className="flex items-start gap-1">
                  <IconButton
                    disabled={Number(line.quantity) <= 1}
                    icon={<Minus size={16} />}
                    label={`Quitar una unidad de ${line.code}`}
                    onClick={() =>
                      update({
                        lines: changeQuantity(draft.lines, line.productId, -1),
                      })
                    }
                  />
                  <div className="w-20">
                    <Field
                      error={errors[`lines.${index}.quantity`]}
                      hideLabel
                      id={`qty-${line.productId}`}
                      label={`Cantidad de ${line.code}`}
                    >
                      <Input
                        className="text-center tabular-nums"
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
                        value={line.quantity}
                      />
                    </Field>
                  </div>
                  <IconButton
                    icon={<Plus size={16} />}
                    label={`Agregar una unidad de ${line.code}`}
                    onClick={() =>
                      update({
                        lines: changeQuantity(draft.lines, line.productId, 1),
                      })
                    }
                  />
                </div>
                <IconButton
                  icon={<Trash size={16} />}
                  label={`Quitar ${line.code}`}
                  onClick={() =>
                    update({ lines: removeLine(draft.lines, line.productId) })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Detalles opcionales" className={panel}>
        <button
          aria-controls="entry-details"
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-ink"
          onClick={() => setDetailsOpen((open) => !open)}
          type="button"
        >
          <span>
            Más detalles
            {hidden && (
              <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">
                con datos
              </span>
            )}
          </span>
          {detailsOpen ? (
            <CaretUp aria-hidden="true" size={16} />
          ) : (
            <CaretDown aria-hidden="true" size={16} />
          )}
        </button>
        {detailsOpen && (
          <div
            className="grid gap-3 border-t border-line p-4 md:grid-cols-2"
            id="entry-details"
          >
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-ink"
                htmlFor="entry-supplier"
              >
                Proveedor
              </label>
              <Combobox
                clearable
                error={errors.supplier_id}
                id="entry-supplier"
                inactiveHelp="Proveedor inactivo."
                label="Proveedor"
                onSelect={(supplier) => update({ supplier })}
                placeholder={supplierHint ?? 'Buscar por nombre'}
                selected={draft.supplier}
                useOptions={useSupplierOptions}
              />
            </div>
            <Field
              error={errors.reference}
              id="entry-reference"
              label="Referencia"
            >
              <Input
                className="font-mono"
                maxLength={128}
                onChange={(event) => update({ reference: event.target.value })}
                placeholder="Opcional, p. ej. número de factura"
                value={draft.reference}
              />
            </Field>
            <div className="md:col-span-2">
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
                  rows={2}
                  value={draft.observation}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Checkbox
                checked={draft.costsOn}
                label="Registrar costos"
                onChange={(event) => update({ costsOn: event.target.checked })}
              />
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-accent-soft px-4 py-3">
        <p
          aria-live="polite"
          className="text-sm font-semibold text-accent-strong"
        >
          {totals.products === 0
            ? 'Nada por registrar'
            : `${totals.products} ${totals.products === 1 ? 'producto' : 'productos'} · ${totals.units} ${totals.units === 1 ? 'unidad' : 'unidades'}`}
        </p>
        <Button
          disabled={busy || draft.lines.length === 0}
          onClick={() => void onReview()}
          type="button"
        >
          {busy ? 'Revisando…' : 'Revisar y confirmar'}
        </Button>
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
      <Dialog
        description="Si sale ahora perderá lo que escribió."
        onClose={() => setDiscardOpen(false)}
        open={discardOpen}
        title="¿Descartar la entrada?"
      >
        <div className="flex justify-end gap-3">
          <Button
            onClick={() => setDiscardOpen(false)}
            type="button"
            variant="secondary"
          >
            Seguir editando
          </Button>
          <Button
            onClick={() => navigate('/purchases')}
            type="button"
            variant="danger"
          >
            Descartar y salir
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
