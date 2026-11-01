import {
  ArrowLeft,
  CheckCircle,
  NotePencil,
  Plus,
  Trash,
  WarningCircle,
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
  Button,
  ErrorState,
  Field,
  FormModal,
  getControlClasses,
  IconButton,
  InlineNotice,
  Input,
  LoadingState,
  StatusBadge,
  Surface,
  useToast,
} from '@/shared/ui'

export const LOCAL_PREPARATION_NOTICE =
  'Esta preparación todavía no es una factura electrónica. No ha sido firmada ni enviada al SRI.'

const STATE_LABELS = {
  DRAFT: 'Borrador fiscal',
  PREPARED: 'Preparación local · Pendiente de emisión',
  CANCELLED: 'Cancelada localmente',
} as const

const TITLES = {
  DRAFT: 'Borrador fiscal',
  PREPARED: 'Preparación local',
  CANCELLED: 'Preparación cancelada',
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

/** El comprobante admite hasta 12 datos adicionales escritos por el usuario (DP-035). */
const MAX_ADDITIONAL_INFO = 12

function cents(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function FiscalPreparationPage() {
  const preparationId = useParams().id
  const query = usePreparation(preparationId)
  if (query.isPending) return <LoadingState label="Cargando datos fiscales…" />
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="No se pudo cargar la preparación fiscal."
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
            <p className="text-xs text-ink-muted">Datos fiscales</p>
            <h1 className="text-xl font-semibold text-ink">
              {TITLES[detail.state]}
            </h1>
          </div>
        </div>
        <StatusBadge
          label={STATE_LABELS[detail.state]}
          shape="pill"
          tone={detail.state === 'CANCELLED' ? 'neutral' : 'info'}
        />
      </div>

      <InlineNotice title="Preparación local" tone="warning">
        {LOCAL_PREPARATION_NOTICE}
      </InlineNotice>

      <OperationSummary detail={detail} />

      {detail.discrepancy.source_changed && (
        <InlineNotice
          title="La operación cambió después de iniciar esta preparación"
          tone="warning"
        >
          Los datos fiscales ya preparados se conservan tal como se revisaron.
          {detail.discrepancy.corrections_changed &&
            ' La operación registra correcciones posteriores.'}
        </InlineNotice>
      )}
      {detail.state === 'CANCELLED' && (
        <InlineNotice title="Preparación cancelada localmente" tone="warning">
          {detail.cancellation_reason}
        </InlineNotice>
      )}

      {detail.state === 'DRAFT' && detail.working ? (
        <DraftEditor detail={detail} working={detail.working} />
      ) : detail.snapshot ? (
        <PreparedView detail={detail} />
      ) : (
        detail.state !== 'DRAFT' && (
          <InlineNotice title="Sin datos preparados" tone="warning">
            Esta preparación no conserva datos fiscales para mostrar.
          </InlineNotice>
        )
      )}
    </div>
  )
}

function OperationSummary({ detail }: { detail: FiscalPreparationDetail }) {
  const summary = detail.summary
  if (!summary) return null
  const kind =
    summary.kind === 'COMMERCIAL' ? 'Venta comercial' : 'Operación artesanal'
  return (
    <Surface aria-label="Resumen de la operación">
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Datum
          label="Operación"
          value={`${kind} ${summary.internal_number ?? ''}`.trim()}
        />
        <Datum
          label="Entidad emisora"
          value={
            detail.issuer
              ? `${detail.issuer.legal_name} · RUC ${detail.issuer.ruc}`
              : ''
          }
        />
        <Datum
          label="Condición"
          value={summary.condition === 'CREDITO' ? 'Crédito' : 'Contado'}
        />
        <Datum label="Total" value={money(summary.grand_total)} />
      </dl>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-surface-subtle text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2">Producto o servicio</th>
              <th className="px-3 py-2 text-right">Cantidad</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {summary.lines.map((line) => (
              <tr key={line.position}>
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {line.quantity}
                </td>
                <td className="px-3 py-2 text-right">{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
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
  const [extra, setExtra] = useState<AdditionalInfoPair[]>(
    working.additional_info,
  )
  const [pairDialog, setPairDialog] = useState<{ index: number | null } | null>(
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
    additional_info: extra,
    ...(serviceDetails.length ? { service_details: serviceDetails } : {}),
  })

  const save = () =>
    mutations.updateDraft.mutate(
      { preparationId: detail.preparation_id, data: payload() },
      { onSuccess: () => toast.success('Borrador fiscal guardado.') },
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
      {
        onSuccess: () =>
          toast.success(
            'Datos fiscales preparados localmente. Pendiente de emisión.',
          ),
      },
    )

  const receiverField = (
    field: keyof FiscalReceiverValues,
    label: string,
    type = 'text',
    required = false,
  ) => (
    <label className="ui-field block text-sm font-semibold text-ink">
      {label}
      <input
        className={`mt-1.5 ${getControlClasses()}`}
        name={field}
        required={required}
        onChange={(event) =>
          setReceiver((prev) => ({ ...prev, [field]: event.target.value }))
        }
        type={type}
        value={text(receiver[field])}
      />
    </label>
  )

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

      <Surface aria-label="Receptor">
        <h2 className="font-bold text-ink">Receptor</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Datos copiados del cliente de la operación. Completar datos aquí no
          modifica la ficha del cliente.
        </p>
        {consumerFinal ? (
          <p className="mt-3 text-sm text-ink">
            Consumidor final · 9999999999999
          </p>
        ) : (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <Datum
              label={ID_TYPES[original.identification_type] ?? 'Identificación'}
              value={original.identification}
              mono
            />
            <Datum label="Nombre o razón social" value={original.legal_name} />
            {original.email && <Datum label="Correo" value={original.email} />}
            {original.address && (
              <Datum label="Dirección" value={original.address} />
            )}
          </dl>
        )}
        {!consumerFinal &&
          (showIdentity || !original.address || !original.email) && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {showIdentity && (
                <>
                  <label className="ui-field block text-sm font-semibold text-ink">
                    Tipo de identificación
                    <select
                      className={`mt-1.5 ${getControlClasses()}`}
                      onChange={(event) =>
                        setReceiver((prev) => ({
                          ...prev,
                          identification_type: event.target.value,
                        }))
                      }
                      value={receiver.identification_type}
                    >
                      <option value="">Seleccione</option>
                      <option value="04">RUC</option>
                      <option value="05">Cédula</option>
                      <option value="06">Pasaporte</option>
                      <option value="08">Identificación del exterior</option>
                    </select>
                  </label>
                  {receiverField('identification', 'Identificación')}
                  {receiverField('legal_name', 'Nombre o razón social')}
                </>
              )}
              {!original.address &&
                receiverField('address', 'Dirección (opcional)')}
              {!original.email &&
                receiverField('email', 'Correo', 'email', true)}
            </div>
          )}
        {cents(total) <= 5000 && (
          <label className="mt-4 flex items-start gap-2 text-sm text-ink">
            <input
              checked={consumerFinal}
              onChange={(event) => setConsumerFinal(event.target.checked)}
              type="checkbox"
            />
            <span>
              Preparar a nombre de consumidor final
              <span className="block text-xs text-ink-muted">
                Solo para totales de hasta USD 50. Una vez emitida, esa factura
                no admite anulación ni nota de crédito.
              </span>
            </span>
          </label>
        )}
      </Surface>

      <Surface aria-label="Formas de pago">
        <h2 className="font-bold text-ink">Formas de pago</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {working.payments.suggested
            ? working.payments.suggestion_origin === 'DEFAULT'
              ? 'Sugerido con la forma de pago predeterminada; puede cambiarlo.'
              : 'Sugerido desde los cobros registrados; puede cambiarlo.'
            : 'Indique cómo se paga el comprobante.'}{' '}
          Guardar esta información no registra ni modifica cobros.
        </p>
        <div className="mt-4 space-y-3">
          {forms.map((form, index) => (
            <div
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_12rem_auto]"
              key={index}
            >
              <label className="ui-field block text-sm font-semibold text-ink">
                Forma de pago
                <select
                  className={`mt-1.5 ${getControlClasses()}`}
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
                </select>
              </label>
              <label className="ui-field block text-sm font-semibold text-ink">
                Importe
                <input
                  className={`mt-1.5 ${getControlClasses()}`}
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
              </label>
              <Button
                aria-label={`Quitar forma de pago ${index + 1}`}
                disabled={forms.length === 1}
                onClick={() =>
                  setForms((prev) => prev.filter((_, i) => i !== index))
                }
                type="button"
                variant="quiet"
              >
                <Trash aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        {working.term_required && (
          <div className="mt-4">
            <label className="ui-field block text-sm font-semibold text-ink">
              Plazo en días
              <input
                className={`mt-1.5 ${getControlClasses()}`}
                inputMode="numeric"
                max={9999}
                min={1}
                onChange={(event) => setTermDays(event.target.value)}
                required
                type="number"
                value={termDays}
              />
            </label>
            <p className="mt-1 text-xs text-ink-muted">
              Solo se declara en la factura; no crea vencimiento ni cambia el
              cobro.
            </p>
            {serverErrors['payments.term_days']?.[0] && (
              <p className="mt-1 text-xs font-semibold text-danger">
                {serverErrors['payments.term_days'][0]}
              </p>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
            className={`text-sm ${difference === 0 ? 'text-ink-muted' : 'text-warning'}`}
          >
            {difference === 0
              ? `Cubre el total de ${money(total)}.`
              : `Diferencia con el total: USD ${(difference / 100).toFixed(2)}`}
          </p>
        </div>
      </Surface>

      {serviceDetails.length > 0 && (
        <Surface aria-label="Detalle por servicio">
          <h2 className="font-bold text-ink">Detalle por servicio</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Opcional. Viene de la operación; ajustarlo aquí no la modifica.
          </p>
          <div className="mt-4 space-y-3">
            {serviceDetails.map((entry, index) => {
              const description =
                detail.summary?.lines.find(
                  (line) => line.position === entry.position,
                )?.description ?? `línea ${entry.position}`
              const error =
                serverErrors[`service_details[${index + 1}].detail`]?.[0]
              return (
                <div key={entry.position}>
                  <label className="ui-field block text-sm font-semibold text-ink">
                    Detalle de {description}
                    <input
                      className={`mt-1.5 ${getControlClasses()}`}
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
                  </label>
                  {error && (
                    <p className="mt-1 text-xs font-semibold text-danger">
                      {error}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Surface>
      )}

      <Surface aria-label="Detalle adicional">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">Detalle adicional</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Opcional. Incluya solo lo necesario para el comprobante; hasta{' '}
              {MAX_ADDITIONAL_INFO} datos.
            </p>
          </div>
          <Button
            disabled={extra.length >= MAX_ADDITIONAL_INFO}
            onClick={() => setPairDialog({ index: null })}
            type="button"
            variant="soft"
          >
            <Plus aria-hidden="true" /> Añadir dato adicional
          </Button>
        </div>
        {serverErrors.additional_info?.[0] && (
          <p className="mt-2 text-xs font-semibold text-danger">
            {serverErrors.additional_info[0]}
          </p>
        )}
        {extra.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {extra.map((pair, index) => {
              const errors = [
                serverErrors[`additional_info[${index + 1}]`]?.[0],
                serverErrors[`additional_info[${index + 1}].name`]?.[0],
                serverErrors[`additional_info[${index + 1}].value`]?.[0],
              ].filter(Boolean)
              return (
                <li
                  className="flex items-start justify-between gap-3 py-2"
                  key={`${pair.name}-${index}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">{pair.name}</p>
                    <p className="font-medium break-words">{pair.value}</p>
                    {errors.map((message) => (
                      <p
                        className="mt-1 text-xs font-semibold text-danger"
                        key={message}
                      >
                        {message}
                      </p>
                    ))}
                  </div>
                  <div className="flex shrink-0">
                    <IconButton
                      icon={<NotePencil size={16} />}
                      label={`Editar ${pair.name}`}
                      onClick={() => setPairDialog({ index })}
                    />
                    <IconButton
                      icon={<Trash size={16} />}
                      label={`Quitar ${pair.name}`}
                      onClick={() =>
                        setExtra((prev) => prev.filter((_, i) => i !== index))
                      }
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Surface>
      {pairDialog && (
        <AdditionalInfoDialog
          initial={pairDialog.index === null ? null : extra[pairDialog.index]!}
          onClose={() => setPairDialog(null)}
          onSave={(pair) => {
            setExtra((prev) =>
              pairDialog.index === null
                ? [...prev, pair]
                : prev.map((item, i) => (i === pairDialog.index ? pair : item)),
            )
            setPairDialog(null)
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
          Guardar borrador
        </Button>
        <Button
          onClick={() => void saveAndReview()}
          pending={mutations.review.isPending}
          type="button"
        >
          Revisar datos para facturación
        </Button>
      </div>

      {review && <ReviewOutcome impediments={review.impediments} />}
      {review && review.impediments.length === 0 && review.review_token && (
        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle aria-hidden="true" /> Los datos están completos para
              la preparación local.
            </p>
            <Button
              onClick={() => complete(review.review_token!)}
              pending={mutations.prepare.isPending}
            >
              Guardar preparación local
            </Button>
          </div>
        </Surface>
      )}
      {mutations.prepare.isError && (
        <ErrorState
          message={
            staleReview
              ? 'La configuración o la fecha cambiaron después de revisar. Revise nuevamente los datos.'
              : mutations.prepare.error.message
          }
        />
      )}
    </div>
  )
}

function AdditionalInfoDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: AdditionalInfoPair | null
  onClose: () => void
  onSave: (pair: AdditionalInfoPair) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty =
    name !== (initial?.name ?? '') || value !== (initial?.value ?? '')

  function save(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Escriba el nombre del dato.'
    if (!value.trim()) next.value = 'Escriba el valor del dato.'
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
      saveLabel={initial ? 'Guardar dato' : 'Agregar dato'}
      title={initial ? 'Editar dato adicional' : 'Añadir dato adicional'}
    >
      <div className="space-y-4">
        <Field error={errors.name} id="extra-name" label="Nombre" required>
          <Input
            id="extra-name"
            maxLength={300}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field error={errors.value} id="extra-value" label="Valor" required>
          <Input
            id="extra-value"
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
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul aria-label={title} className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li
            className="flex gap-2 rounded-control bg-warning-soft p-3 text-sm text-warning"
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
  const extra = Array.isArray(snapshot.additional_info)
    ? snapshot.additional_info.map(record).filter((pair) => text(pair.name))
    : []
  const issuer = record(snapshot.issuer)
  const profile = record(issuer.tax_profile)
  // Las preparaciones anteriores guardaban las condiciones como leyendas de texto.
  const legends = Array.isArray(snapshot.legends)
    ? snapshot.legends.map(text).filter(Boolean)
    : []
  return (
    <div className="space-y-4">
      <Surface aria-label="Datos preparados">
        <p className="text-sm text-ink-muted">
          Datos conservados tal como se prepararon el{' '}
          {text(snapshot.reference_date)}. Cambios posteriores de la
          configuración no los modifican.
        </p>
        <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Datum label="Receptor" value={text(receiver.legal_name)} />
          <Datum
            label="Identificación"
            mono
            value={text(receiver.identification)}
          />
          {text(receiver.email) && (
            <Datum label="Correo" value={text(receiver.email)} />
          )}
          <Datum label="Impuestos" value={money(totals.tax)} />
          <Datum label="Total" value={money(totals.grand)} />
        </dl>
      </Surface>
      <IssuerSummary issuer={issuer} legends={legends} profile={profile} />
      <Surface className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface-subtle text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2">Impuesto</th>
                <th className="px-4 py-2 text-right">Cantidad</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((line, index) => (
                <tr key={`${text(line.position)}-${index}`}>
                  <td className="px-4 py-3 font-mono text-xs">
                    {text(line.item_code)}
                  </td>
                  <td className="px-4 py-3">
                    {text(line.description)}
                    {text(line.service_detail) && (
                      <span className="block text-xs break-words text-ink-muted">
                        {text(line.service_detail)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {text(line.display_name) || `${text(line.tax_rate)} %`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {text(line.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {money(line.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
      <Surface aria-label="Formas de pago preparadas">
        <h2 className="font-bold text-ink">Formas de pago</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {payments.map((payment, index) => (
            <li key={index}>
              {text(payment.display_name) || text(payment.payment_code)} ·{' '}
              {money(payment.amount)}
              {text(payment.term_days) &&
                ` · plazo ${text(payment.term_days)} días`}
            </li>
          ))}
        </ul>
      </Surface>
      {extra.length > 0 && (
        <Surface aria-label="Detalle adicional preparado">
          <h2 className="font-bold text-ink">Detalle adicional</h2>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            {extra.map((pair, index) => (
              <Datum
                key={`${text(pair.name)}-${index}`}
                label={text(pair.name)}
                value={text(pair.value)}
              />
            ))}
          </dl>
        </Surface>
      )}
      {detail.technical && (
        <details className="rounded-panel border border-line p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">
            Información avanzada
          </summary>
          <pre className="mt-3 overflow-x-auto text-xs text-ink-muted">
            {JSON.stringify(detail.technical, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

/** Datos tributarios del emisor tal como se conservaron al preparar. */
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
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {hasProfile ? (
          <>
            {text(issuer.trade_name) && (
              <Datum label="Nombre comercial" value={text(issuer.trade_name)} />
            )}
            {text(issuer.establishment_address) && (
              <Datum
                label="Dirección del establecimiento"
                value={text(issuer.establishment_address)}
              />
            )}
            {regime && (
              <Datum label="Régimen" value={REGIME_LABELS[regime] ?? regime} />
            )}
            {text(profile.regime_legend) && (
              <Datum
                label="Leyenda en el comprobante"
                value={text(profile.regime_legend)}
              />
            )}
            {text(profile.accounting_obligation) && (
              <Datum
                label="Obligado a llevar contabilidad"
                value={profile.accounting_obligation === 'SI' ? 'Sí' : 'No'}
              />
            )}
            {text(profile.withholding_agent_resolution) && (
              <Datum
                label="Agente de retención"
                mono
                value={text(profile.withholding_agent_resolution)}
              />
            )}
            {text(profile.special_taxpayer_resolution) && (
              <Datum
                label="Contribuyente especial"
                mono
                value={text(profile.special_taxpayer_resolution)}
              />
            )}
            {text(profile.large_taxpayer_resolution) && (
              <Datum
                label="Gran contribuyente"
                mono
                value={text(profile.large_taxpayer_resolution)}
              />
            )}
            {text(qualification.number) && (
              <Datum
                label="Calificación artesanal"
                value={`${text(qualification.number)} · vence ${text(qualification.ends_on)}`}
              />
            )}
          </>
        ) : (
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-xs text-ink-muted">Condiciones declaradas</dt>
            <dd className="mt-1 font-medium">
              <ul className="list-none space-y-0.5 p-0">
                {legends.map((legend) => (
                  <li key={legend}>{legend}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
    </Surface>
  )
}

function Datum({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`mt-1 font-medium ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  )
}
