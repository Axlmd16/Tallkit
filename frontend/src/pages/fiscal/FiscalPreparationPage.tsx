import {
  ArrowLeft,
  CheckCircle,
  Info,
  ListChecks,
  NotePencil,
  Plus,
  Receipt,
  Trash,
  User,
  WarningCircle,
  Wallet,
  Wrench,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { useFiscalMutations, usePreparation } from '@/features/fiscal/hooks'
import type {
  AdditionalInfoPair,
  DeclaredPaymentForm,
  FiscalPreparationDetail,
  FiscalReceiverValues,
  ReviewImpediment,
  ServiceDetail,
  WorkingDraft,
} from '@/features/fiscal/types'
import { ProblemError } from '@/shared/api/client'
import {
  AdvancedInfo,
  Button,
  Checkbox,
  ErrorState,
  FactList,
  FactRow,
  Field,
  FormModal,
  HintPopover,
  IconButton,
  InlineNotice,
  Input,
  LoadingState,
  SectionPanel,
  Select,
  StatusBadge,
  Surface,
  useToast,
} from '@/shared/ui'

/** Aviso corto y permanente: hoy ninguna factura se envía al SRI desde esta pantalla. */
export const NOT_SENT_NOTICE = 'Todavía no se ha enviado al SRI'

const STATE_LABELS = {
  DRAFT: 'Por completar',
  PREPARED: 'Datos listos',
  CANCELLED: 'Cancelados',
} as const

const TITLES = {
  DRAFT: 'Datos de la factura',
  PREPARED: 'Datos de la factura',
  CANCELLED: 'Datos cancelados',
} as const

const REGIME_LABELS: Record<string, string> = {
  GENERAL: 'General',
  RIMPE_EMPRENDEDOR: 'RIMPE Emprendedor',
  RIMPE_NEGOCIO_POPULAR: 'RIMPE Negocio Popular',
}

const ID_TYPES: Record<string, string> = {
  '04': 'RUC',
  '05': 'Cédula',
  '06': 'Pasaporte',
  '07': 'Consumidor final',
  '08': 'Identificación del exterior',
}

const CONSUMER_FINAL: FiscalReceiverValues = {
  identification_type: '07',
  identification: '9999999999999',
  legal_name: 'CONSUMIDOR FINAL',
}

/** La factura admite hasta 12 notas escritas por el usuario. */
const MAX_NOTES = 12

function money(value: unknown): string {
  return `USD ${typeof value === 'string' || typeof value === 'number' ? value : '—'}`
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

function cents(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function FiscalPreparationPage() {
  const preparationId = useParams().id
  const query = usePreparation(preparationId)
  if (query.isPending) return <LoadingState label="Cargando…" />
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="No se pudieron cargar los datos de la factura."
        onRetry={() => void query.refetch()}
      />
    )
  }
  const detail = query.data
  const sourcePath =
    detail.source.kind === 'COMMERCIAL'
      ? `/sales/${detail.source.id}`
      : `/maintenance/service-operations/${detail.source.id}`

  return (
    <div className="catalog-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            aria-label="Volver a la operación"
            className="grid size-10 place-items-center rounded-control border border-line bg-surface"
            to={sourcePath}
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
          <div>
            <p className="text-label text-ink-muted">Factura</p>
            <h1 className="text-page font-semibold text-ink">
              {TITLES[detail.state]}
            </h1>
          </div>
        </div>
        <StatusBadge
          label={STATE_LABELS[detail.state]}
          shape="pill"
          tone={
            detail.state === 'CANCELLED'
              ? 'neutral'
              : detail.state === 'PREPARED'
                ? 'success'
                : 'info'
          }
        />
      </div>

      <InlineNotice title={NOT_SENT_NOTICE} tone="info" />

      <OperationSummary detail={detail} />

      {detail.discrepancy.source_changed && (
        <InlineNotice
          title="La operación cambió después de empezar"
          tone="warning"
        >
          Estos datos se conservan como estaban.
          {detail.discrepancy.corrections_changed &&
            ' La operación tiene correcciones posteriores.'}
        </InlineNotice>
      )}
      {detail.state === 'CANCELLED' && (
        <InlineNotice title="Datos cancelados" tone="warning">
          {detail.cancellation_reason}
        </InlineNotice>
      )}

      {detail.state === 'DRAFT' && detail.working ? (
        <DraftEditor detail={detail} working={detail.working} />
      ) : detail.snapshot ? (
        <PreparedView detail={detail} />
      ) : (
        detail.state !== 'DRAFT' && (
          <InlineNotice title="Sin datos para mostrar" tone="warning" />
        )
      )}
    </div>
  )
}

function OperationSummary({ detail }: { detail: FiscalPreparationDetail }) {
  const summary = detail.summary
  if (!summary) return null
  const kind =
    summary.kind === 'COMMERCIAL'
      ? 'Venta de repuestos'
      : 'Servicios del taller'
  return (
    <SectionPanel icon={<Receipt size={17} />} id="op-title" title="Operación">
      <FactList className="px-4">
        <FactRow label="Operación">
          {`${kind} ${summary.internal_number ?? ''}`.trim()}
        </FactRow>
        <FactRow label="Emite">
          {detail.issuer
            ? `${detail.issuer.legal_name} · RUC ${detail.issuer.ruc}`
            : '—'}
        </FactRow>
        <FactRow label="Pago">
          {summary.condition === 'CREDITO' ? 'Crédito' : 'Contado'}
        </FactRow>
        <FactRow label="Total">{money(summary.grand_total)}</FactRow>
      </FactList>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[420px] text-left text-body">
          <thead className="text-label text-ink-muted">
            <tr>
              <th className="py-2">Detalle</th>
              <th className="py-2 text-right">Cantidad</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {summary.lines.map((line) => (
              <tr key={line.position}>
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right tabular-nums">
                  {line.quantity}
                </td>
                <td className="py-2 text-right">{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionPanel>
  )
}

function DraftEditor({
  detail,
  working,
}: {
  detail: FiscalPreparationDetail
  working: WorkingDraft
}) {
  const mutations = useFiscalMutations()
  const toast = useToast()
  const total = detail.summary?.grand_total ?? '0'
  const [receiver, setReceiver] = useState<FiscalReceiverValues>(
    working.receiver,
  )
  const [original] = useState<FiscalReceiverValues>(working.receiver)
  const [consumerFinal, setConsumerFinal] = useState(
    working.receiver.identification_type === '07',
  )
  const [forms, setForms] = useState<DeclaredPaymentForm[]>(
    working.payments.forms.length
      ? working.payments.forms
      : [
          {
            payment_code: detail.payment_options[0]?.code ?? '',
            amount: total,
          },
        ],
  )
  const [termDays, setTermDays] = useState(
    working.payments.term_days != null
      ? String(working.payments.term_days)
      : '',
  )
  const [notes, setNotes] = useState<AdditionalInfoPair[]>(
    working.additional_info,
  )
  const [noteDialog, setNoteDialog] = useState<{ index: number | null } | null>(
    null,
  )
  const [serviceDetails, setServiceDetails] = useState<ServiceDetail[]>(
    working.service_details,
  )
  const missing = new Set(detail.missing_fields)
  const serverErrors: Record<string, string[]> =
    mutations.updateDraft.error instanceof ProblemError
      ? (mutations.updateDraft.error.errors ?? {})
      : {}
  const review = mutations.review.data
  const difference =
    cents(total) - forms.reduce((sum, f) => sum + cents(f.amount), 0)
  const staleReview =
    mutations.prepare.error instanceof ProblemError &&
    mutations.prepare.error.code === 'review_stale'

  // El servidor decide si corresponde el plazo; un valor guardado que ya no aplica no se reenvía.
  const term = termDays.trim()
  const payload = () => ({
    expected_version: detail.version,
    receiver: consumerFinal ? CONSUMER_FINAL : receiver,
    payments: {
      forms,
      ...(working.term_required && term ? { term_days: Number(term) } : {}),
    },
    additional_info: notes,
    ...(serviceDetails.length ? { service_details: serviceDetails } : {}),
  })

  const save = () =>
    mutations.updateDraft.mutate(
      { preparationId: detail.preparation_id, data: payload() },
      { onSuccess: () => toast.success('Cambios guardados.') },
    )

  const saveAndReview = async () => {
    mutations.prepare.reset()
    try {
      await mutations.updateDraft.mutateAsync({
        preparationId: detail.preparation_id,
        data: payload(),
      })
    } catch {
      return
    }
    mutations.review.mutate({ preparationId: detail.preparation_id })
  }

  const complete = (token: string) =>
    mutations.prepare.mutate(
      {
        preparationId: detail.preparation_id,
        reviewToken: token,
        attemptKey: crypto.randomUUID(),
      },
      { onSuccess: () => toast.success('Datos de la factura listos.') },
    )

  const setField = (field: keyof FiscalReceiverValues) => (value: string) =>
    setReceiver((prev) => ({ ...prev, [field]: value }))

  const showIdentity =
    missing.has('identification') ||
    missing.has('identification_type') ||
    missing.has('legal_name')

  return (
    <div className="space-y-5">
      {(mutations.updateDraft.isError || mutations.review.isError) && (
        <ErrorState
          message={
            (mutations.updateDraft.error ?? mutations.review.error)?.message ??
            'No se pudieron revisar los datos.'
          }
        />
      )}

      <SectionPanel
        icon={<User size={17} />}
        id="receiver-title"
        title="Cliente"
      >
        <div className="space-y-4 p-4">
          {consumerFinal ? (
            <p className="text-body text-ink">Consumidor final</p>
          ) : (
            <FactList>
              <FactRow
                label={
                  ID_TYPES[original.identification_type] ?? 'Identificación'
                }
              >
                <span className="code">{original.identification}</span>
              </FactRow>
              <FactRow label="Nombre">{original.legal_name}</FactRow>
            </FactList>
          )}
          {!consumerFinal && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {showIdentity && (
                <>
                  <Field label="Tipo de identificación">
                    <Select
                      onChange={(event) =>
                        setField('identification_type')(event.target.value)
                      }
                      value={receiver.identification_type}
                    >
                      <option value="">Seleccione</option>
                      <option value="04">RUC</option>
                      <option value="05">Cédula</option>
                      <option value="06">Pasaporte</option>
                      <option value="08">Identificación del exterior</option>
                    </Select>
                  </Field>
                  <Field label="Identificación">
                    <Input
                      onChange={(event) =>
                        setField('identification')(event.target.value)
                      }
                      value={text(receiver.identification)}
                    />
                  </Field>
                  <Field label="Nombre o razón social">
                    <Input
                      onChange={(event) =>
                        setField('legal_name')(event.target.value)
                      }
                      value={text(receiver.legal_name)}
                    />
                  </Field>
                </>
              )}
              <Field label="Dirección (opcional)">
                <Input
                  onChange={(event) => setField('address')(event.target.value)}
                  value={text(receiver.address)}
                />
              </Field>
              <Field hint="La factura se envía a este correo." label="Correo">
                <Input
                  onChange={(event) => setField('email')(event.target.value)}
                  required
                  type="email"
                  value={text(receiver.email)}
                />
              </Field>
            </div>
          )}
          {cents(total) <= 5000 && (
            <div>
              <Checkbox
                checked={consumerFinal}
                label="Factura a consumidor final"
                onChange={(event) => setConsumerFinal(event.target.checked)}
              />
              <p className="mt-1 text-label text-ink-muted">
                Solo hasta USD 50. Luego no se puede anular ni corregir.
              </p>
            </div>
          )}
        </div>
      </SectionPanel>

      <SectionPanel
        actions={
          <HintPopover
            align="end"
            label="Cómo se sugirió"
            trigger={<Info aria-hidden="true" size={16} weight="bold" />}
          >
            <p className="text-ink-muted">
              {working.payments.suggested
                ? working.payments.suggestion_origin === 'DEFAULT'
                  ? 'Se sugirió la forma de pago habitual; puede cambiarla.'
                  : 'Se sugirió según los cobros registrados; puede cambiarla.'
                : 'Indique cómo se paga.'}{' '}
              Guardar esto no registra ni cambia cobros.
            </p>
          </HintPopover>
        }
        icon={<Wallet size={17} />}
        id="payments-title"
        title="Cómo se paga"
      >
        <div className="space-y-3 p-4">
          {forms.map((form, index) => (
            <div
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_12rem_auto]"
              key={index}
            >
              <Field label="Forma de pago">
                <Select
                  onChange={(event) =>
                    setForms((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? { ...item, payment_code: event.target.value }
                          : item,
                      ),
                    )
                  }
                  value={form.payment_code}
                >
                  {detail.payment_options.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.display_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Importe">
                <Input
                  inputMode="decimal"
                  onChange={(event) =>
                    setForms((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? { ...item, amount: event.target.value }
                          : item,
                      ),
                    )
                  }
                  value={form.amount}
                />
              </Field>
              <IconButton
                disabled={forms.length === 1}
                icon={<Trash size={16} />}
                label={`Quitar forma de pago ${index + 1}`}
                onClick={() =>
                  setForms((prev) => prev.filter((_, i) => i !== index))
                }
              />
            </div>
          ))}
          {working.term_required && (
            <Field
              error={serverErrors['payments.term_days']?.[0]}
              hint="Días para pagar. Solo aparece en la factura."
              label="Plazo en días"
            >
              <Input
                inputMode="numeric"
                max={9999}
                min={1}
                onChange={(event) => setTermDays(event.target.value)}
                required
                type="number"
                value={termDays}
              />
            </Field>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              onClick={() =>
                setForms((prev) => [
                  ...prev,
                  {
                    payment_code: detail.payment_options[0]?.code ?? '',
                    amount: '',
                  },
                ])
              }
              type="button"
              variant="quiet"
            >
              <Plus aria-hidden="true" /> Añadir forma de pago
            </Button>
            <p
              className={`text-body ${difference === 0 ? 'text-ink-muted' : 'text-warning'}`}
            >
              {difference === 0
                ? `Cubre el total de ${money(total)}.`
                : `Diferencia con el total: USD ${(difference / 100).toFixed(2)}`}
            </p>
          </div>
        </div>
      </SectionPanel>

      {serviceDetails.length > 0 && (
        <SectionPanel
          actions={
            <HintPopover
              align="end"
              label="Sobre el detalle"
              trigger={<Info aria-hidden="true" size={16} weight="bold" />}
            >
              <p className="text-ink-muted">
                Viene de la orden del taller. Cambiarlo aquí no cambia la orden.
              </p>
            </HintPopover>
          }
          icon={<Wrench size={17} />}
          id="service-details-title"
          title="Detalle de cada servicio"
        >
          <div className="space-y-3 p-4">
            {serviceDetails.map((entry, index) => {
              const description =
                detail.summary?.lines.find(
                  (line) => line.position === entry.position,
                )?.description ?? `línea ${entry.position}`
              return (
                <Field
                  error={
                    serverErrors[`service_details[${index + 1}].detail`]?.[0]
                  }
                  key={entry.position}
                  label={`Detalle de ${description}`}
                >
                  <Input
                    maxLength={300}
                    onChange={(event) =>
                      setServiceDetails((prev) =>
                        prev.map((item) =>
                          item.position === entry.position
                            ? { ...item, detail: event.target.value }
                            : item,
                        ),
                      )
                    }
                    value={entry.detail}
                  />
                </Field>
              )
            })}
          </div>
        </SectionPanel>
      )}

      <SectionPanel
        actions={
          <Button
            disabled={notes.length >= MAX_NOTES}
            onClick={() => setNoteDialog({ index: null })}
            type="button"
            variant="soft"
          >
            <Plus aria-hidden="true" /> Añadir nota
          </Button>
        }
        description="Opcional. Escriba solo lo necesario."
        icon={<NotePencil size={17} />}
        id="notes-title"
        title="Notas de la factura"
      >
        {(serverErrors.additional_info?.[0] || notes.length > 0) && (
          <div className="p-4">
            {serverErrors.additional_info?.[0] && (
              <p className="mb-2 text-label font-semibold text-danger">
                {serverErrors.additional_info[0]}
              </p>
            )}
            <ul className="divide-y divide-line">
              {notes.map((note, index) => {
                const errors = [
                  serverErrors[`additional_info[${index + 1}]`]?.[0],
                  serverErrors[`additional_info[${index + 1}].name`]?.[0],
                  serverErrors[`additional_info[${index + 1}].value`]?.[0],
                ].filter(Boolean)
                return (
                  <li
                    className="flex items-start justify-between gap-3 py-2"
                    key={`${note.name}-${index}`}
                  >
                    <div className="min-w-0">
                      <p className="text-label text-ink-muted">{note.name}</p>
                      <p className="text-body font-medium break-words text-ink">
                        {note.value}
                      </p>
                      {errors.map((message) => (
                        <p
                          className="mt-1 text-label font-semibold text-danger"
                          key={message}
                        >
                          {message}
                        </p>
                      ))}
                    </div>
                    <div className="flex shrink-0">
                      <IconButton
                        icon={<NotePencil size={16} />}
                        label={`Editar ${note.name}`}
                        onClick={() => setNoteDialog({ index })}
                      />
                      <IconButton
                        icon={<Trash size={16} />}
                        label={`Quitar ${note.name}`}
                        onClick={() =>
                          setNotes((prev) => prev.filter((_, i) => i !== index))
                        }
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </SectionPanel>
      {noteDialog && (
        <NoteDialog
          initial={noteDialog.index === null ? null : notes[noteDialog.index]!}
          onClose={() => setNoteDialog(null)}
          onSave={(note) => {
            setNotes((prev) =>
              noteDialog.index === null
                ? [...prev, note]
                : prev.map((item, i) => (i === noteDialog.index ? note : item)),
            )
            setNoteDialog(null)
          }}
        />
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button
          onClick={save}
          pending={mutations.updateDraft.isPending}
          type="button"
          variant="secondary"
        >
          Guardar para después
        </Button>
        <Button
          onClick={() => void saveAndReview()}
          pending={mutations.review.isPending}
          type="button"
        >
          Revisar datos
        </Button>
      </div>

      {review && <ReviewOutcome impediments={review.impediments} />}
      {review && review.impediments.length === 0 && review.review_token && (
        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-body text-success">
              <CheckCircle aria-hidden="true" /> Todo está en orden.
            </p>
            <Button
              onClick={() => complete(review.review_token!)}
              pending={mutations.prepare.isPending}
            >
              Confirmar datos
            </Button>
          </div>
        </Surface>
      )}
      {mutations.prepare.isError && (
        <ErrorState
          message={
            staleReview
              ? 'Algo cambió desde la revisión. Revise los datos de nuevo.'
              : mutations.prepare.error.message
          }
        />
      )}
    </div>
  )
}

function NoteDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: AdditionalInfoPair | null
  onClose: () => void
  onSave: (note: AdditionalInfoPair) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty =
    name !== (initial?.name ?? '') || value !== (initial?.value ?? '')

  function save(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Escriba el título.'
    if (!value.trim()) next.value = 'Escriba el texto.'
    setErrors(next)
    if (Object.keys(next).length) return false
    onSave({ name: name.trim(), value: value.trim() })
    return true
  }

  return (
    <FormModal
      dirty={dirty}
      onClose={onClose}
      onSave={save}
      open
      saveLabel={initial ? 'Guardar nota' : 'Agregar nota'}
      title={initial ? 'Editar nota' : 'Añadir nota'}
    >
      <div className="space-y-4">
        <Field error={errors.name} id="note-name" label="Título" required>
          <Input
            id="note-name"
            maxLength={300}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field error={errors.value} id="note-value" label="Texto" required>
          <Input
            id="note-value"
            maxLength={300}
            onChange={(event) => setValue(event.target.value)}
            value={value}
          />
        </Field>
      </div>
    </FormModal>
  )
}

function ReviewOutcome({ impediments }: { impediments: ReviewImpediment[] }) {
  if (!impediments.length) return null
  const operator = impediments.filter((item) => item.audience === 'OPERATOR')
  const admin = impediments.filter((item) => item.audience === 'ADMINISTRATOR')
  return (
    <Surface aria-label="Resultado de la revisión" className="space-y-4">
      {operator.length > 0 && (
        <ImpedimentList items={operator} title="Puede completarlo aquí" />
      )}
      {admin.length > 0 && (
        <ImpedimentList
          items={admin}
          title="Debe resolverlo el Administrador"
        />
      )}
    </Surface>
  )
}

function ImpedimentList({
  title,
  items,
}: {
  title: string
  items: ReviewImpediment[]
}) {
  return (
    <section>
      <h3 className="text-body font-bold text-ink">{title}</h3>
      <ul aria-label={title} className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li
            className="flex gap-2 rounded-control bg-warning-soft p-3 text-body text-warning"
            key={`${item.field}-${index}`}
          >
            <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PreparedView({ detail }: { detail: FiscalPreparationDetail }) {
  const snapshot = record(detail.snapshot)
  const receiver = record(snapshot.receiver)
  const totals = record(snapshot.totals)
  const payments = Array.isArray(snapshot.payments)
    ? snapshot.payments.map(record)
    : []
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines.map(record) : []
  const notes = Array.isArray(snapshot.additional_info)
    ? snapshot.additional_info.map(record).filter((pair) => text(pair.name))
    : []
  const issuer = record(snapshot.issuer)
  const profile = record(issuer.tax_profile)
  // Las preparaciones anteriores guardaban las condiciones como leyendas de texto.
  const legends = Array.isArray(snapshot.legends)
    ? snapshot.legends.map(text).filter(Boolean)
    : []
  return (
    <div className="space-y-5">
      <SectionPanel
        icon={<User size={17} />}
        id="prepared-title"
        title="Cliente"
      >
        <FactList className="px-4">
          <FactRow label="Nombre">{text(receiver.legal_name) || '—'}</FactRow>
          <FactRow label="Identificación">
            <span className="code">{text(receiver.identification) || '—'}</span>
          </FactRow>
          {text(receiver.email) && (
            <FactRow label="Correo">{text(receiver.email)}</FactRow>
          )}
          <FactRow label="Impuestos">{money(totals.tax)}</FactRow>
          <FactRow label="Total">{money(totals.grand)}</FactRow>
        </FactList>
        <p className="px-4 py-3 text-label text-ink-muted">
          Guardados el {text(snapshot.reference_date)}. Los cambios posteriores
          de configuración no los modifican.
        </p>
      </SectionPanel>

      <SectionPanel
        icon={<ListChecks size={17} />}
        id="lines-title"
        title="Detalle"
      >
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[520px] text-left text-body">
            <thead className="text-label text-ink-muted">
              <tr>
                <th className="py-2">Código</th>
                <th className="py-2">Descripción</th>
                <th className="py-2">Impuesto</th>
                <th className="py-2 text-right">Cantidad</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((line, index) => (
                <tr key={`${text(line.position)}-${index}`}>
                  <td className="py-3 code text-label">
                    {text(line.item_code)}
                  </td>
                  <td className="py-3">
                    {text(line.description)}
                    {text(line.service_detail) && (
                      <span className="block text-label break-words text-ink-muted">
                        {text(line.service_detail)}
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    {text(line.display_name) || `${text(line.tax_rate)} %`}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {text(line.quantity)}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {money(line.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      <SectionPanel
        icon={<Wallet size={17} />}
        id="prepared-payments-title"
        title="Cómo se paga"
      >
        <ul
          aria-label="Formas de pago preparadas"
          className="space-y-1 p-4 text-body"
        >
          {payments.map((payment, index) => (
            <li key={index}>
              {text(payment.display_name) || text(payment.payment_code)} ·{' '}
              {money(payment.amount)}
              {text(payment.term_days) &&
                ` · plazo ${text(payment.term_days)} días`}
            </li>
          ))}
        </ul>
      </SectionPanel>

      {notes.length > 0 && (
        <SectionPanel
          icon={<NotePencil size={17} />}
          id="prepared-notes-title"
          title="Notas de la factura"
        >
          <FactList className="px-4">
            {notes.map((note, index) => (
              <FactRow
                key={`${text(note.name)}-${index}`}
                label={text(note.name)}
              >
                {text(note.value)}
              </FactRow>
            ))}
          </FactList>
        </SectionPanel>
      )}

      <IssuerSummary issuer={issuer} legends={legends} profile={profile} />

      {detail.technical && (
        <AdvancedInfo hint="para el Administrador">
          <pre className="overflow-x-auto text-label text-ink-muted">
            {JSON.stringify(detail.technical, null, 2)}
          </pre>
        </AdvancedInfo>
      )}
    </div>
  )
}

/** Datos tributarios del emisor tal como se conservaron; plegados porque casi nadie los consulta. */
function IssuerSummary({
  issuer,
  profile,
  legends,
}: {
  issuer: Record<string, unknown>
  profile: Record<string, unknown>
  legends: string[]
}) {
  const hasProfile = Object.keys(profile).length > 0
  if (!hasProfile && legends.length === 0) return null
  const regime = text(profile.regime)
  const qualification = record(profile.artisan_qualification)
  return (
    <Surface aria-label="Emisor preparado">
      <details className="group text-body">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
          Datos del emisor
        </summary>
        <FactList className="mt-1">
          {hasProfile ? (
            <>
              {text(issuer.trade_name) && (
                <FactRow label="Nombre comercial">
                  {text(issuer.trade_name)}
                </FactRow>
              )}
              {text(issuer.establishment_address) && (
                <FactRow label="Dirección del establecimiento">
                  {text(issuer.establishment_address)}
                </FactRow>
              )}
              {regime && (
                <FactRow label="Régimen">
                  {REGIME_LABELS[regime] ?? regime}
                </FactRow>
              )}
              {text(profile.regime_legend) && (
                <FactRow label="Leyenda en la factura">
                  {text(profile.regime_legend)}
                </FactRow>
              )}
              {text(profile.accounting_obligation) && (
                <FactRow label="Obligado a llevar contabilidad">
                  {profile.accounting_obligation === 'SI' ? 'Sí' : 'No'}
                </FactRow>
              )}
              {text(profile.withholding_agent_resolution) && (
                <FactRow label="Agente de retención">
                  <span className="code">
                    {text(profile.withholding_agent_resolution)}
                  </span>
                </FactRow>
              )}
              {text(profile.special_taxpayer_resolution) && (
                <FactRow label="Contribuyente especial">
                  <span className="code">
                    {text(profile.special_taxpayer_resolution)}
                  </span>
                </FactRow>
              )}
              {text(profile.large_taxpayer_resolution) && (
                <FactRow label="Gran contribuyente">
                  <span className="code">
                    {text(profile.large_taxpayer_resolution)}
                  </span>
                </FactRow>
              )}
              {text(qualification.number) && (
                <FactRow label="Calificación artesanal">
                  {`${text(qualification.number)} · vence ${text(qualification.ends_on)}`}
                </FactRow>
              )}
            </>
          ) : (
            <FactRow label="Condiciones declaradas">
              <ul className="list-none space-y-0.5 p-0">
                {legends.map((legend) => (
                  <li key={legend}>{legend}</li>
                ))}
              </ul>
            </FactRow>
          )}
        </FactList>
      </details>
    </Surface>
  )
}
