import { Calculator, Receipt } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import {
  draftFromPurchase,
  emptyDraft,
  toInput,
  validateDraft,
  type PurchaseDraft,
} from '@/features/purchases/draft'
import { usd } from '@/features/purchases/format'
import {
  usePurchase,
  usePurchaseMutations,
  usePurchaseTaxOptions,
} from '@/features/purchases/hooks'
import { LinesEditor } from '@/features/purchases/LinesEditor'
import { useSupplierOptions } from '@/features/purchases/pickers'
import { PurchaseDocument } from '@/features/purchases/PurchaseDocument'
import { ReviewDialog } from '@/features/purchases/ReviewDialog'
import {
  documentTypeLabels,
  type DocumentType,
  type PurchaseReview,
} from '@/features/purchases/types'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import { SaleViewer } from '@/features/sales/SaleViewer'
import '@/features/sales/sales.css'
import {
  Button,
  Combobox,
  Dialog,
  Field,
  FiscalScopeBadge,
  InlineNotice,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from '@/shared/ui'

const snapshot = (draft: PurchaseDraft) =>
  JSON.stringify({
    ...draft,
    lines: draft.lines.map(({ key: _key, ...line }) => line),
  })

export function PurchaseEditorPage() {
  const params = useParams()
  const purchaseId = params.id ? Number(params.id) : null
  const navigate = useNavigate()
  const query = usePurchase(purchaseId)
  const mutations = usePurchaseMutations()
  const saveTracker = useIntentTracker()
  const confirmTracker = useIntentTracker()
  const latest = useLatestReview<PurchaseReview>()

  const [draft, setDraftState] = useState<PurchaseDraft>(emptyDraft)
  const [baseline, setBaseline] = useState(() => snapshot(emptyDraft()))
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const reviewTrigger = useRef<HTMLButtonElement>(null)

  const purchase = query.data
  const dirty = snapshot(draft) !== baseline
  const taxOptions = usePurchaseTaxOptions(draft.documentDate || null)

  useEffect(() => {
    if (!purchase || purchase.version === loadedVersion) return
    const next = draftFromPurchase(purchase)
    setDraftState(next)
    setBaseline(snapshot(next))
    setLoadedVersion(purchase.version)
  }, [purchase, loadedVersion])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function setDraft(changes: Partial<PurchaseDraft>) {
    setDraftState((prev) => ({ ...prev, ...changes }))
    latest.invalidate()
    setReviewOpen(false)
    setProblem(null)
  }

  const amounts = useMemo(
    () =>
      dirty || !purchase
        ? draft.lines.map(() => null)
        : purchase.lines.map((line) => line.amounts),
    [dirty, purchase, draft.lines],
  )

  function showProblem(error: unknown) {
    const view = describeProblem(error)
    setProblem(view)
    setErrors((prev) => ({ ...prev, ...view.fields }))
    return view
  }

  async function save(): Promise<number | null> {
    const local = validateDraft(draft)
    setErrors(local)
    if (Object.keys(local).length > 0) {
      setProblem({
        message: 'Corrija los campos marcados antes de guardar.',
        fields: local,
        uncertain: false,
        staleRecord: false,
      })
      return null
    }
    const input = toInput(draft)
    try {
      if (purchaseId === null) {
        const created = await saveTracker.run(input, (key) =>
          mutations.create.mutateAsync({ data: input, key }),
        )
        navigate(`/purchases/${created.id}/edit`, { replace: true })
        return created.id
      }
      const version = purchase?.version ?? 1
      await saveTracker.run({ input, version }, (key) =>
        mutations.update.mutateAsync({
          id: purchaseId,
          data: input,
          expectedVersion: version,
          key,
        }),
      )
      return purchaseId
    } catch (error) {
      showProblem(error)
      return null
    }
  }

  async function onSave() {
    if (busy) return
    setBusy(true)
    try {
      await save()
    } finally {
      setBusy(false)
    }
  }

  async function requestReview(id: number) {
    const result = await latest.request(() => mutations.preview.mutateAsync(id))
    if (result) setReviewOpen(true)
    else if (latest.error) showProblem(latest.error)
  }

  async function onReview() {
    if (busy) return
    setBusy(true)
    try {
      const id = dirty || purchaseId === null ? await save() : purchaseId
      if (id !== null) await requestReview(id)
    } finally {
      setBusy(false)
    }
  }

  async function onConfirm(acknowledged: number[]) {
    const review = latest.review
    if (!review || purchaseId === null || !review.review_token) return
    const payload = {
      id: purchaseId,
      expectedVersion: review.version,
      reviewToken: review.review_token,
      ...(acknowledged.length > 0 ? { acknowledgedMatches: acknowledged } : {}),
    }
    setBusy(true)
    try {
      await confirmTracker.run(payload, (key) =>
        mutations.confirm.mutateAsync({ ...payload, key }),
      )
      navigate(`/purchases/${purchaseId}`)
    } catch (error) {
      if (error instanceof ProblemError && error.code === 'review_required') {
        setReviewMessage(
          'Los importes o datos relevantes cambiaron desde la revisión. Se solicitó una revisión actualizada.',
        )
        await requestReview(purchaseId)
      } else if (
        error instanceof ProblemError &&
        error.code === 'stale_record'
      ) {
        setReviewOpen(false)
        showProblem(error)
      } else {
        showProblem(error)
      }
    } finally {
      setBusy(false)
    }
  }

  if (purchaseId !== null && query.isPending) {
    return <LoadingState label="Cargando ingreso…" />
  }
  if (purchaseId !== null && (query.isError || !purchase)) {
    return (
      <InlineNotice title="No se pudo cargar el ingreso" tone="danger">
        <Button
          onClick={() => void query.refetch()}
          type="button"
          variant="secondary"
        >
          Reintentar
        </Button>
      </InlineNotice>
    )
  }
  if (purchase && purchase.state !== 'DRAFT') {
    return (
      <InlineNotice title="Este ingreso ya no es un borrador" tone="warning">
        Un ingreso confirmado o anulado no admite edición.{' '}
        <Button
          onClick={() => navigate(`/purchases/${purchase.id}`)}
          type="button"
          variant="secondary"
        >
          Ver detalle
        </Button>
      </InlineNotice>
    )
  }

  const documentLines = draft.lines.map((line, index) => {
    const [code = null, name = null] = (line.product?.label ?? '').split(' — ')
    const persisted = !dirty ? purchase?.lines[index] : undefined
    return {
      key: line.key,
      code,
      name,
      quantity: line.quantity,
      unitCost: persisted?.unit_cost ?? null,
      tax: persisted?.amounts?.tax ?? null,
      total: persisted?.amounts?.total ?? null,
    }
  })

  return (
    <div className="sale-screen">
      <PageHeader
        description="Complete el documento del proveedor y las líneas. Los importes los calcula el sistema; confirme solo después de revisarlos."
        title={
          purchaseId === null
            ? 'Nuevo ingreso de mercadería'
            : 'Editar ingreso de mercadería'
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiscalScopeBadge scope="commercial" />
        {dirty && <span className="sale-unsaved">Cambios sin guardar</span>}
      </div>
      <div aria-label="Vista" className="sale-view-switch" role="group">
        {(['edit', 'preview'] as const).map((value) => (
          <button
            aria-pressed={view === value}
            key={value}
            onClick={() => setView(value)}
            type="button"
          >
            {value === 'edit' ? 'Editar' : 'Vista previa'}
          </button>
        ))}
      </div>
      <div className="sale-workspace" data-view={view}>
        <section aria-label="Captura del ingreso" className="sale-editor-panel">
          <div className="sale-editor-scroll">
      {problem && (
        <InlineNotice
          title={
            problem.staleRecord
              ? 'El ingreso cambió'
              : 'No se guardó el ingreso'
          }
          tone="danger"
        >
          {problem.message}
          {problem.staleRecord && (
            <div className="mt-3">
              <Button
                onClick={() => {
                  setLoadedVersion(null)
                  setProblem(null)
                  void query.refetch()
                }}
                type="button"
                variant="secondary"
              >
                Recargar el ingreso
              </Button>
            </div>
          )}
        </InlineNotice>
      )}
      <form
        className="catalog-editor-form space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave()
        }}
      >
        <section
          aria-label="Documento"
          className="form-section grid gap-4 rounded-group border border-line bg-surface-subtle/60 p-5 md:grid-cols-2"
        >
          <div className="flex items-start gap-3 md:col-span-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-group bg-primary-soft text-primary">
              <Receipt aria-hidden="true" size={22} />
            </span>
            <div>
              <h2 className="font-bold text-ink">Datos del documento</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Identifique al proveedor y el comprobante recibido.
              </p>
            </div>
          </div>
          <div className="md:col-span-2">
            <Combobox
              clearable
              error={errors.supplier_id}
              id="purchase-supplier"
              inactiveHelp="Proveedor inactivo: se conserva legible, pero impide confirmar mientras siga inactivo."
              label="Proveedor"
              onSelect={(supplier) => setDraft({ supplier })}
              selected={draft.supplier}
              useOptions={useSupplierOptions}
            />
          </div>
          <Field id="purchase-type" label="Tipo de documento">
            <Select
              id="purchase-type"
              onChange={(event) =>
                setDraft({ documentType: event.target.value as DocumentType })
              }
              value={draft.documentType}
            >
              {(Object.keys(documentTypeLabels) as DocumentType[]).map(
                (type) => (
                  <option key={type} value={type}>
                    {documentTypeLabels[type]}
                  </option>
                ),
              )}
            </Select>
          </Field>
          {draft.documentType === 'SIN_DOCUMENTO' ? (
            <Field
              error={errors.no_document_reason}
              id="purchase-reason"
              label="Explicación de la compra sin documento"
            >
              <Textarea
                id="purchase-reason"
                onChange={(event) => setDraft({ reason: event.target.value })}
                value={draft.reason}
              />
            </Field>
          ) : (
            <Field
              error={errors.supplier_reference}
              hint="Se compara sin distinguir mayúsculas ni espacios exteriores."
              id="purchase-reference"
              label="Referencia del proveedor"
            >
              <Input
                id="purchase-reference"
                maxLength={128}
                onChange={(event) =>
                  setDraft({ reference: event.target.value })
                }
                value={draft.reference}
              />
            </Field>
          )}
          <Field
            error={errors.document_date}
            id="purchase-date"
            label="Fecha del documento"
          >
            <Input
              id="purchase-date"
              onChange={(event) =>
                setDraft({ documentDate: event.target.value })
              }
              type="date"
              value={draft.documentDate}
            />
          </Field>
          <Field error={errors.notes} id="purchase-notes" label="Observación">
            <Textarea
              id="purchase-notes"
              maxLength={2000}
              onChange={(event) => setDraft({ notes: event.target.value })}
              value={draft.notes}
            />
          </Field>
        </section>
        <LinesEditor
          amounts={amounts}
          errors={errors}
          lines={draft.lines}
          onChange={(lines) => setDraft({ lines })}
          taxOptions={taxOptions.data?.results ?? []}
        />
        <section
          aria-label="Totales"
          className="flex items-start gap-3 rounded-group bg-primary-soft/45 p-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-primary">
            <Calculator aria-hidden="true" size={21} />
          </span>
          <div>
            <h2 className="font-bold text-ink">Totales del documento</h2>
            {!dirty && purchase?.totals ? (
              <p className="mt-2 text-ink">
                Base {usd(purchase.totals.base)} · Impuesto{' '}
                {usd(purchase.totals.tax)} · Total{' '}
                <strong>{usd(purchase.totals.total)}</strong>
              </p>
            ) : (
              <p className="mt-2 text-ink-muted">
                {purchase?.totals_status === 'not_calculable' && !dirty
                  ? 'Totales no calculables: falta una tarifa vigente única para la fecha.'
                  : 'Los totales se calculan en el servidor al guardar.'}
              </p>
            )}
          </div>
        </section>
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} type="submit">
            {busy ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          <Button
            disabled={busy}
            onClick={() => void onReview()}
            ref={reviewTrigger}
            type="button"
            variant="secondary"
          >
            Revisar y confirmar
          </Button>
          <Button
            onClick={() =>
              dirty ? setDiscardOpen(true) : navigate('/purchases')
            }
            type="button"
            variant="quiet"
          >
            Cancelar
          </Button>
        </div>
        {dirty && (
          <p className="text-sm text-warning" role="status">
            Hay cambios sin guardar.
          </p>
        )}
      </form>
          </div>
        </section>
        <section aria-label="Vista previa" className="sale-viewer">
          <SaleViewer
            failed={false}
            issues={[]}
            phase={!dirty && purchase ? 'fresh' : 'incomplete'}
          >
            <PurchaseDocument
              documentDateValue={draft.documentDate}
              documentReference={
                draft.documentType === 'SIN_DOCUMENTO'
                  ? draft.reason
                  : draft.reference
              }
              documentType={draft.documentType}
              lines={documentLines}
              number={purchase?.internal_number ?? null}
              stale={dirty || !purchase}
              supplier={draft.supplier?.label ?? ''}
              totals={!dirty ? (purchase?.totals ?? null) : null}
            />
          </SaleViewer>
        </section>
      </div>
      <ReviewDialog
        documentType={draft.documentType}
        message={reviewMessage}
        onClose={() => {
          setReviewOpen(false)
          setReviewMessage(null)
        }}
        onConfirm={(matches) => void onConfirm(matches)}
        onReview={() => purchaseId !== null && void requestReview(purchaseId)}
        pending={busy}
        returnFocusRef={reviewTrigger}
        review={reviewOpen ? latest.review : null}
        supplierName={draft.supplier?.label ?? ''}
      />
      <Dialog
        description="Si sale ahora perderá los cambios que no guardó."
        onClose={() => setDiscardOpen(false)}
        open={discardOpen}
        title="¿Descartar los cambios?"
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
