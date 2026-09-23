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
  InlineNotice,
  Input,
  LoadingState,
  Money,
  Select,
  StatusBadge,
  Textarea,
  useToast,
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
  const toast = useToast()

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
  // La navegación a /edit llega como transición: hasta que se aplica, `purchaseId` sigue
  // en null. El borrador ya creado se reutiliza para no crear un segundo ingreso.
  const createdId = useRef<number | null>(null)

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
      if (purchaseId === null && createdId.current !== null) {
        return createdId.current
      }
      if (purchaseId === null) {
        const created = await saveTracker.run(input, (key) =>
          mutations.create.mutateAsync({ data: input, key }),
        )
        createdId.current = created.id
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
      const confirmed = await confirmTracker.run(payload, (key) =>
        mutations.confirm.mutateAsync({ ...payload, key }),
      )
      toast.success(
        confirmed?.internal_number
          ? `Ingreso ${confirmed.internal_number} confirmado.`
          : 'Ingreso confirmado.',
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

  const note =
    purchase?.totals_status === 'not_calculable' && !dirty
      ? 'Totales no calculables: falta una tarifa vigente única para la fecha.'
      : 'Los importes los calcula el sistema al guardar; confirme solo después de revisarlos.'

  return (
    <div className="catalog-page sale-screen">
      <header className="sale-topbar">
        <div className="sale-topbar-title">
          <h1>
            {purchaseId === null
              ? 'Nuevo ingreso de mercadería'
              : 'Editar ingreso de mercadería'}
          </h1>
          <p>Registre el documento del proveedor y los productos recibidos</p>
        </div>
        <div className="sale-topbar-status">
          <StatusBadge label="Borrador" tone="neutral" />
          {dirty && <span className="sale-unsaved">Cambios sin guardar</span>}
        </div>
      </header>
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
              className="contents"
              id="purchase-form"
              onSubmit={(event) => {
                event.preventDefault()
                void onSave()
              }}
            >
              <section aria-label="Documento" className="sale-section">
                <div className="sale-section-head">
                  <h2>Datos del documento</h2>
                  <span className="sale-section-hint">
                    Proveedor y comprobante recibido
                  </span>
                </div>
                <div className="grid gap-3 p-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label
                      className="mb-1.5 block text-xs font-semibold text-ink"
                      htmlFor="purchase-supplier"
                    >
                      Proveedor
                    </label>
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
                        setDraft({
                          documentType: event.target.value as DocumentType,
                        })
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
                        onChange={(event) =>
                          setDraft({ reason: event.target.value })
                        }
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
                        className="font-mono"
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
                  <Field
                    error={errors.notes}
                    id="purchase-notes"
                    label="Observación"
                  >
                    <Textarea
                      id="purchase-notes"
                      maxLength={2000}
                      onChange={(event) =>
                        setDraft({ notes: event.target.value })
                      }
                      rows={2}
                      value={draft.notes}
                    />
                  </Field>
                </div>
              </section>
              <LinesEditor
                amounts={amounts}
                errors={errors}
                lines={draft.lines}
                onChange={(lines) => setDraft({ lines })}
                taxOptions={taxOptions.data?.results ?? []}
              />
            </form>
          </div>
          <div className="sale-actions">
            <div className="sale-actions-total">
              <span>Total del ingreso</span>
              <Money
                amount={!dirty ? (purchase?.totals?.total ?? null) : null}
                className="text-xl font-bold"
              />
            </div>
            <p aria-live="polite" className="sale-actions-note" role="status">
              {dirty ? 'Hay cambios sin guardar.' : note}
            </p>
            <Button
              onClick={() =>
                dirty ? setDiscardOpen(true) : navigate('/purchases')
              }
              type="button"
              variant="quiet"
            >
              Cancelar
            </Button>
            <Button
              disabled={busy}
              form="purchase-form"
              type="submit"
              variant="secondary"
            >
              {busy ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button
              disabled={busy}
              onClick={() => void onReview()}
              ref={reviewTrigger}
              type="button"
            >
              Revisar y confirmar
            </Button>
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
