import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { proformasApi } from '@/features/proformas/api'
import {
  emptyDraft,
  fromProforma,
  signature,
  toInput,
  WHOLE,
  type ProformaDraft,
} from '@/features/proformas/draft'
import { documentDate } from '@/features/proformas/format'
import { useProforma, useProformaMutations } from '@/features/proformas/hooks'
import { IssueDialog } from '@/features/proformas/IssueDialog'
import { issueText } from '@/features/proformas/issueLabel'
import { useCustomerPickerOptions } from '@/features/proformas/pickers'
import { ProformaLinesEditor } from '@/features/proformas/ProformaLinesEditor'
import type { DraftPreview, ProformaLine } from '@/features/proformas/types'
import '@/features/sales/sales.css'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import {
  Button,
  Combobox,
  InlineNotice,
  Input,
  LoadingState,
  Money,
  StatusBadge,
  useToast,
} from '@/shared/ui'

const DEBOUNCE_MS = 300
const PRISTINE = signature(emptyDraft())

/**
 * Editor del borrador de proforma: cliente, vigencia, productos y cantidades. Los precios y
 * totales llegan de una consulta de solo lectura al servidor y nunca se calculan ni editan
 * aquí. La captura se conserva ante un error y los cambios sin guardar se advierten. Emitir
 * exige guardar primero y revisar la versión guardada.
 */
export function ProformaEditorPage() {
  const { id } = useParams()
  const proformaId = id ? Number(id) : null
  const navigate = useNavigate()
  const toast = useToast()
  const saved = useProforma(proformaId)
  const mutations = useProformaMutations()
  const tracker = useIntentTracker()
  const latest = useLatestReview<DraftPreview>()
  const [draft, setDraft] = useState<ProformaDraft>(emptyDraft)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [saving, setSaving] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [requestedFor, setRequestedFor] = useState<string | null>(null)
  const hydrated = useRef(false)
  const reviewRef = useRef<HTMLButtonElement>(null)
  const { request } = latest
  const sig = signature(draft)

  useEffect(() => {
    if (hydrated.current || !saved.data) return
    hydrated.current = true
    const next = fromProforma(saved.data)
    setDraft(next)
    setSavedSignature(signature(next))
  }, [saved.data])

  useEffect(() => {
    // Tras 300 ms sin cambios se pide el cálculo del servidor; una respuesta anterior a la
    // captura vigente se descarta mediante `latest-review`.
    const timer = setTimeout(() => {
      setRequestedFor(sig)
      void request(() => proformasApi.draftPreview(toInput(draft)))
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [sig, request])

  // Antes de cargar el borrador guardado no hay cambios propios que advertir.
  const dirty =
    savedSignature === null
      ? !proformaId && sig !== PRISTINE
      : savedSignature !== sig

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const errors = problem?.fields ?? {}
  const lineErrors = draft.lines.some(
    (line) => line.quantity && !WHOLE.test(line.quantity),
  )
  const editable = !saved.data || saved.data.allowed_actions.includes('edit')
  const canSave = !lineErrors && !saving && editable

  async function save() {
    if (!canSave) return
    setSaving(true)
    setProblem(null)
    const data = {
      customer_id: draft.customer?.id ?? null,
      valid_until: draft.validUntil || null,
      lines: toInput(draft).lines ?? [],
    }
    try {
      const result = await tracker.run({ proformaId, data }, (key) =>
        proformaId
          ? mutations.update.mutateAsync({
              id: proformaId,
              data,
              expectedVersion: saved.data?.version ?? 1,
              key,
            })
          : mutations.create.mutateAsync({ data, key }),
      )
      // La barra de acciones confirma el guardado: un toast taparía «Revisar y emitir».
      setSavedSignature(sig)
      if (!proformaId)
        navigate(`/proformas/${result.id}/edit`, { replace: true })
      else await saved.refetch()
    } catch (error) {
      // La captura se conserva: solo se informa el error junto al campo o la acción.
      setProblem(describeProblem(error))
    } finally {
      setSaving(false)
    }
  }

  const preview = latest.review
  const fresh =
    requestedFor === sig && !latest.pending && !latest.error && preview !== null
  const showValues = fresh || latest.pending
  const byPosition = new Map((preview?.lines ?? []).map((l) => [l.position, l]))
  // La posición del cálculo cuenta solo las líneas con producto, como en `toInput`.
  const priced: Record<string, ProformaLine | undefined> = {}
  let position = 0
  for (const line of draft.lines) {
    if (!line.product) continue
    position += 1
    if (showValues) priced[line.key] = byPosition.get(position)
  }
  const issues = fresh
    ? (preview?.issues ?? []).filter((item) => item.field !== 'customer_id')
    : []
  const suggested = preview?.suggested_valid_until
  const actionNote = saving
    ? 'Guardando…'
    : lineErrors
      ? 'Corrija las cantidades para guardar.'
      : dirty || !proformaId
        ? 'Guarde el borrador para revisarlo y emitirlo.'
        : 'Borrador guardado.'

  if (proformaId && saved.isPending) {
    return <LoadingState label="Cargando proforma…" />
  }
  if (proformaId && (saved.isError || !editable)) {
    return (
      <InlineNotice
        title={
          saved.isError
            ? 'No se pudo cargar la proforma'
            : 'Esta proforma ya no se edita'
        }
        tone="danger"
      >
        {saved.isError
          ? 'Reintente en unos instantes.'
          : 'Una proforma emitida conserva su contenido. Cree una nueva vinculada desde su ficha.'}{' '}
        <Link
          className="font-semibold text-accent hover:underline"
          to={
            proformaId && !saved.isError
              ? `/proformas/${proformaId}`
              : '/proformas'
          }
        >
          Volver
        </Link>
      </InlineNotice>
    )
  }

  return (
    <div className="catalog-page sale-screen">
      <header className="sale-topbar">
        <Link
          aria-label="Volver a proformas"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a proformas"
          to={proformaId ? `/proformas/${proformaId}` : '/proformas'}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="sale-topbar-title">
          <h1>{proformaId ? 'Editar proforma' : 'Nueva proforma'}</h1>
          <p>Cotización de repuestos; no reserva inventario</p>
        </div>
        <div className="sale-topbar-status">
          <StatusBadge label="Borrador" tone="neutral" />
          {dirty && <span className="sale-unsaved">Cambios sin guardar</span>}
        </div>
      </header>
      <section
        aria-label="Captura de la proforma"
        className="sale-editor-panel"
        id="proforma-form"
      >
        <div className="sale-editor-scroll">
          {saved.data?.origin && (
            <p className="text-body text-ink-muted">
              Nueva oferta vinculada a{' '}
              <Link
                className="font-semibold text-accent hover:underline"
                to={`/proformas/${saved.data.origin.id}`}
              >
                <span className="code">{saved.data.origin.number}</span>
              </Link>
              ; usa precios actuales.
            </p>
          )}
          {problem && (
            <InlineNotice
              title={
                problem.staleRecord
                  ? 'La proforma cambió desde que la abrió'
                  : problem.uncertain
                    ? 'No sabemos si el borrador se guardó'
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
                      setProblem(null)
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
          <section aria-label="Datos de la proforma" className="sale-section">
            <div className="sale-section-head">
              <h2>Datos</h2>
            </div>
            <div className="sale-data-grid">
              <div className="sale-field">
                <label htmlFor="proforma-customer">Cliente (opcional)</label>
                <Combobox
                  clearable
                  error={errors.customer_id}
                  id="proforma-customer"
                  inactiveHelp="El cliente está inactivo: no puede emitirse la proforma."
                  label="Cliente"
                  onSelect={(customer) => setDraft((d) => ({ ...d, customer }))}
                  placeholder="Sin cliente; se pedirá al convertir en venta"
                  selected={draft.customer}
                  useOptions={useCustomerPickerOptions}
                />
              </div>
              <div className="sale-field">
                <label htmlFor="proforma-valid-until">Vigente hasta</label>
                <Input
                  aria-describedby="proforma-valid-until-note"
                  aria-invalid={errors.valid_until ? true : undefined}
                  id="proforma-valid-until"
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, validUntil: event.target.value }))
                  }
                  type="date"
                  value={draft.validUntil}
                />
                <p
                  className={`sale-field-note ${errors.valid_until ? 'font-semibold text-danger' : ''}`}
                  id="proforma-valid-until-note"
                  role={errors.valid_until ? 'alert' : undefined}
                >
                  {errors.valid_until ??
                    (draft.validUntil
                      ? 'Fecha elegida; incluye todo ese día.'
                      : suggested
                        ? `Sin fecha: 7 días, hasta el ${documentDate(suggested)} si se emite hoy.`
                        : 'Sin fecha: 7 días desde la emisión.')}
                </p>
              </div>
            </div>
          </section>
          <ProformaLinesEditor
            errors={errors}
            lines={draft.lines}
            onChange={(lines) => setDraft((d) => ({ ...d, lines }))}
            pending={!fresh}
            priced={priced}
          />
          {issues.length > 0 && (
            <InlineNotice title="Pendiente para emitir" tone="warning">
              <ul className="list-disc pl-5">
                {issues.map((item) => (
                  <li key={`${item.field}-${item.code}`}>{issueText(item)}</li>
                ))}
              </ul>
            </InlineNotice>
          )}
        </div>
        <div className="sale-actions">
          <div className="sale-actions-total">
            <span>Total de la proforma</span>
            <Money
              amount={showValues ? (preview?.totals?.total ?? null) : null}
              className={`text-block font-bold ${fresh ? '' : 'pending-value'}`}
            />
          </div>
          <p aria-live="polite" className="sale-actions-note">
            {actionNote}
          </p>
          <Button
            disabled={!canSave}
            onClick={() => void save()}
            type="button"
            variant="secondary"
          >
            {saving
              ? 'Guardando…'
              : problem?.uncertain
                ? 'Reintentar guardado'
                : 'Guardar borrador'}
          </Button>
          <Button
            disabled={!proformaId || dirty || saving}
            onClick={() => setReviewing(true)}
            ref={reviewRef}
            type="button"
          >
            Revisar y emitir
          </Button>
        </div>
      </section>
      {saved.data && (
        <IssueDialog
          onClose={() => setReviewing(false)}
          onIssued={(issued) => {
            toast.success(`Proforma ${issued.internal_number} emitida.`, {
              href: `/proformas/${issued.id}/document`,
              linkLabel: 'Imprimir',
            })
            navigate(`/proformas/${issued.id}`)
          }}
          open={reviewing}
          proforma={saved.data}
          returnFocusRef={reviewRef}
        />
      )}
    </div>
  )
}
