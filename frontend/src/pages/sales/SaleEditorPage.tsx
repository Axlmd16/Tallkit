import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { salesApi } from '@/features/sales/api'
import {
  fromSale,
  emptyDraft,
  signature,
  toInput,
  WHOLE,
  type SaleDraft,
} from '@/features/sales/draft'
import { useCustomerPickerOptions } from '@/features/sales/pickers'
import { SaleCombobox } from '@/features/sales/SaleCombobox'
import { useSale, useSaleMutations } from '@/features/sales/hooks'
import { SaleLinesEditor } from '@/features/sales/SaleLinesEditor'
import { SaleReviewDialog } from '@/features/sales/SaleReviewDialog'
import { SalesDocument, type SheetData } from '@/features/sales/SalesDocument'
import { SaleViewer, type ViewerPhase } from '@/features/sales/SaleViewer'
import '@/features/sales/sales.css'
import {
  conditionLabels,
  type DocumentLine,
  type DraftPreview,
  type SaleCondition,
} from '@/features/sales/types'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import {
  Button,
  FiscalScopeBadge,
  InlineNotice,
  LoadingState,
  Select,
  StatusBadge,
  Textarea,
} from '@/shared/ui'

const DEBOUNCE_MS = 300
const PRISTINE = signature(emptyDraft()) + ''

/**
 * Editor de ventas con vista previa en vivo: editor compacto a la izquierda y visor de
 * documentos con la hoja del comprobante a la derecha desde 1280 px; por debajo se alterna
 * entre «Editar» y «Vista previa» conservando la captura. La consulta reactiva no guarda, numera ni reserva nada y nunca
 * habilita confirmar: primero se guarda y se revisa el borrador persistido.
 */
export function SaleEditorPage() {
  const { id } = useParams()
  const saleId = id ? Number(id) : null
  const navigate = useNavigate()
  const saved = useSale(saleId)
  const mutations = useSaleMutations()
  const tracker = useIntentTracker()
  const [draft, setDraft] = useState<SaleDraft>(emptyDraft)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const hydrated = useRef(false)
  const reviewRef = useRef<HTMLButtonElement>(null)
  const latest = useLatestReview<DraftPreview>()
  const [requestedFor, setRequestedFor] = useState<string | null>(null)
  const { request } = latest
  const currentSignature = signature(draft) + draft.notes
  const dirty = savedSignature !== currentSignature

  useEffect(() => {
    if (hydrated.current || !saved.data) return
    hydrated.current = true
    const sale = saved.data
    const next: SaleDraft = {
      customer: sale.customer.name
        ? { id: sale.customer.id, label: sale.customer.name }
        : null,
      condition: sale.condition,
      notes: sale.notes,
      lines: fromSale(sale.lines),
    }
    setDraft(next)
    setSavedSignature(signature(next) + next.notes)
  }, [saved.data])

  const sig = signature(draft)
  useEffect(() => {
    // Tras 300 ms sin cambios relevantes se pide la proyección del servidor; una
    // respuesta anterior a la captura vigente se descarta mediante `latest-review`.
    const timer = setTimeout(() => {
      setRequestedFor(sig)
      void request(() => salesApi.draftPreview(toInput(draft)))
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [sig, request])

  const errors = problem?.fields ?? {}
  const lineErrors = draft.lines.some(
    (l) => l.quantity && !WHOLE.test(l.quantity),
  )
  const canSave = Boolean(draft.customer) && !lineErrors && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    setProblem(null)
    const data = {
      customer_id: (draft.customer as { id: number }).id,
      condition: draft.condition,
      notes: draft.notes,
      lines: toInput(draft).lines ?? [],
    }
    try {
      const result = await tracker.run({ saleId, data }, (key) =>
        saleId
          ? mutations.update.mutateAsync({
              id: saleId,
              data,
              expectedVersion: saved.data?.version ?? 1,
              key,
            })
          : mutations.create.mutateAsync({ data, key }),
      )
      setSavedSignature(currentSignature)
      if (!saleId) navigate(`/sales/${result.id}/edit`, { replace: true })
      else await saved.refetch()
    } catch (error) {
      setProblem(describeProblem(error))
    } finally {
      setSaving(false)
    }
  }

  const preview = latest.review
  const fresh =
    requestedFor === sig && !latest.pending && !latest.error && preview !== null
  const updating = latest.pending
  const failed = Boolean(latest.error)
  const showValues = fresh || updating
  const byPosition = new Map((preview?.lines ?? []).map((l) => [l.position, l]))
  // La posición de la proyección cuenta solo las líneas con producto, como en `toInput`.
  const priced: Record<string, DocumentLine | undefined> = {}
  let position = 0
  for (const line of draft.lines) {
    if (!line.product) continue
    position += 1
    if (showValues) priced[line.key] = byPosition.get(position)
  }
  const sheet: SheetData = {
    heading: 'Borrador · Vista previa',
    number: null,
    issuer: preview?.fiscal_entity ?? null,
    customer: draft.customer
      ? {
          id: draft.customer.id,
          name: draft.customer.label,
          ...(preview?.customer ?? {}),
        }
      : null,
    condition: draft.condition,
    date: preview?.operational_date ?? null,
    lines: draft.lines
      .filter((l) => l.product)
      .map((line, index) => {
        const [code = null, name = null] = (line.product?.label ?? '').split(
          ' — ',
        )
        const row = priced[line.key]
        return {
          position: index + 1,
          product_code: code,
          product_name: name,
          quantity: line.quantity,
          unit_price: row?.unit_price ?? null,
          tax_rate: row?.tax_rate ?? null,
          base_amount: row?.base_amount ?? null,
          tax_amount: row?.tax_amount ?? null,
          total_amount: row?.total_amount ?? null,
        }
      }),
    totals: showValues ? (preview?.totals ?? null) : null,
  }
  const incomplete = failed || updating ? [] : (preview?.issues ?? [])
  const phase: ViewerPhase = failed
    ? 'incomplete'
    : updating || !fresh
      ? 'updating'
      : incomplete.length > 0
        ? 'incomplete'
        : 'fresh'
  const pristine = !saleId && currentSignature === PRISTINE
  const unsaved = dirty && !pristine
  const blockedByCustomer = !draft.customer
  const actionNote = saving
    ? 'Guardando…'
    : blockedByCustomer
      ? 'Seleccione un cliente para guardar el borrador.'
      : lineErrors
        ? 'Corrija las cantidades para guardar el borrador.'
        : !saleId || dirty
          ? 'La vista previa no habilita confirmar: guarde el borrador y revise la versión guardada.'
          : 'Borrador guardado. Revíselo para confirmar la venta.'

  return (
    <div className="catalog-page sale-screen">
      <header className="sale-topbar">
        <div className="sale-topbar-title">
          <h1>{saleId ? 'Editar venta' : 'Nueva venta'}</h1>
          <p>Prepare una venta directa de repuestos</p>
        </div>
        <div className="sale-topbar-status">
          <FiscalScopeBadge scope="commercial" />
          <StatusBadge label="Borrador" tone="neutral" />
          {unsaved && <span className="sale-unsaved">Cambios sin guardar</span>}
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
        <section
          aria-label="Captura de la venta"
          className="sale-editor-panel"
          id="sale-form"
        >
          <div className="sale-editor-scroll">
            {saleId && saved.isPending && (
              <LoadingState label="Cargando venta…" />
            )}
            {saleId && saved.isError && (
              <InlineNotice title="No se pudo cargar la venta" tone="danger">
                Reintente en unos instantes.
              </InlineNotice>
            )}
            {problem && (
              <InlineNotice
                title={
                  problem.staleRecord
                    ? 'La venta cambió desde que la abrió'
                    : 'No se guardó el borrador'
                }
                tone="danger"
              >
                <p>{problem.message}</p>
                {problem.staleRecord && (
                  <div className="mt-2">
                    <Button
                      onClick={() => {
                        hydrated.current = false
                        void saved.refetch()
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Recargar la versión guardada
                    </Button>
                  </div>
                )}
              </InlineNotice>
            )}
            <section aria-label="Datos de la venta" className="sale-section">
              <div className="sale-section-head">
                <h2>Datos de la venta</h2>
              </div>
              <div className="sale-data-grid">
                <div className="sale-field">
                  <label htmlFor="sale-customer">Cliente</label>
                  <SaleCombobox
                    clearable
                    error={errors.customer_id}
                    id="sale-customer"
                    inactiveHelp="El cliente está inactivo: no puede iniciarse una venta nueva."
                    label="Cliente"
                    onSelect={(customer) =>
                      setDraft((d) => ({ ...d, customer }))
                    }
                    placeholder="Buscar cliente por nombre o identificación"
                    selected={draft.customer}
                    useOptions={useCustomerPickerOptions}
                  />
                </div>
                <div className="sale-field">
                  <label htmlFor="sale-condition">Condición de venta</label>
                  <Select
                    aria-describedby={
                      errors.condition ? 'sale-condition-error' : undefined
                    }
                    aria-invalid={errors.condition ? true : undefined}
                    id="sale-condition"
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        condition: event.target.value as SaleCondition,
                      }))
                    }
                    value={draft.condition}
                  >
                    {(Object.keys(conditionLabels) as SaleCondition[]).map(
                      (value) => (
                        <option key={value} value={value}>
                          {conditionLabels[value]}
                        </option>
                      ),
                    )}
                  </Select>
                  {errors.condition && (
                    <p
                      className="sale-field-note font-semibold text-danger"
                      id="sale-condition-error"
                      role="alert"
                    >
                      {errors.condition}
                    </p>
                  )}
                </div>
              </div>
            </section>
            <SaleLinesEditor
              errors={errors}
              lines={draft.lines}
              onChange={(lines) => setDraft((d) => ({ ...d, lines }))}
              pending={!fresh}
              priced={priced}
            />
            <div className="sale-section">
              <div className="sale-section-head">
                <h2>Notas</h2>
              </div>
              <div className="sale-field">
                <label className="sr-only" htmlFor="sale-notes">
                  Notas
                </label>
                <Textarea
                  aria-describedby={
                    errors.notes ? 'sale-notes-error' : undefined
                  }
                  aria-invalid={errors.notes ? true : undefined}
                  className="sale-notes"
                  id="sale-notes"
                  maxLength={2000}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, notes: event.target.value }))
                  }
                  radius="r5"
                  resize="none"
                  rows={2}
                  value={draft.notes}
                />
                {errors.notes && (
                  <p
                    className="sale-field-note font-semibold text-danger"
                    id="sale-notes-error"
                    role="alert"
                  >
                    {errors.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="sale-actions">
            <p aria-live="polite" className="sale-actions-note">
              {actionNote}
            </p>
            <Button
              disabled={!canSave}
              onClick={() => void save()}
              type="button"
              variant="secondary"
            >
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button
              disabled={!saleId || dirty || saving}
              onClick={() => setReviewing(true)}
              ref={reviewRef}
              type="button"
            >
              Revisar y confirmar
            </Button>
          </div>
        </section>
        <section
          aria-label="Vista previa"
          className="sale-viewer"
          id="sale-preview"
        >
          <SaleViewer failed={failed} issues={incomplete} phase={phase}>
            <SalesDocument
              data={sheet}
              stale={failed || (!fresh && !updating)}
              updating={updating}
            />
          </SaleViewer>
        </section>
      </div>
      {saved.data && (
        <SaleReviewDialog
          onClose={() => setReviewing(false)}
          onConfirmed={(sale) => navigate(`/sales/${sale.id}`)}
          open={reviewing}
          returnFocusRef={reviewRef}
          sale={saved.data}
        />
      )}
    </div>
  )
}
