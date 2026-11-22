import {
  ArrowLeft,
  ArrowsLeftRight,
  Check,
  CheckCircle,
  Clock,
  Money as MoneyIcon,
  Package,
  Receipt,
  WarningCircle,
  Wrench,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { describeProblem } from '@/features/catalog-common/problem'
import {
  useExecuteCheckout,
  useMaintenanceCheckoutPreview,
  useSaleCheckoutPreview,
} from '@/features/checkout/hooks'
import type {
  CheckoutBusinessPaymentInput,
  CheckoutExecuteInput,
  CheckoutExecuteResponse,
  CheckoutPaymentMode,
  CheckoutPreview,
} from '@/features/checkout/types'
import {
  Button,
  Checkbox,
  InlineNotice,
  LoadingState,
  Money,
  PlateTag,
  StatusBadge,
  useToast,
} from '@/shared/ui'

interface CheckoutPageProps {
  originKind: 'MAINTENANCE' | 'SALE'
}

const num = (value: string) => {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const fmt = (value: number) => value.toFixed(2)

function BusinessCard({
  scope,
  businessName,
  subtitle,
  lines,
  total,
  balance,
  partial,
  partialValue,
  onPartialChange,
  issues,
  fiscalState,
  done,
}: {
  scope: 'artisan' | 'commercial'
  businessName: string
  subtitle: string
  lines: { description: string; quantity: string; total: string }[]
  total: string
  balance: string
  partial: boolean
  partialValue: string
  onPartialChange: (value: string) => void
  issues: string[]
  fiscalState?: 'PREPARED' | 'FAILED' | 'SKIPPED' | string | undefined
  done: boolean
}) {
  const isArtisan = scope === 'artisan'
  return (
    <section className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center gap-3 px-5 py-4">
        <span
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-lg ${
            isArtisan
              ? 'bg-artisan-soft text-artisan-ink'
              : 'bg-commercial-soft text-commercial-ink'
          }`}
        >
          {isArtisan ? <Wrench size={18} /> : <Package size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body font-bold text-ink">
            {businessName}
          </h2>
          <p className="text-caption text-ink-muted">{subtitle}</p>
        </div>
        {done && fiscalState === 'PREPARED' && (
          <StatusBadge label="Factura preparada (sin enviar)" tone="info" />
        )}
        {done && fiscalState === 'FAILED' && (
          <StatusBadge label="Factura pendiente" tone="warning" />
        )}
      </div>

      <div className="divide-y divide-line border-t border-line">
        {lines.map((line, index) => (
          <div
            className="flex items-center justify-between gap-3 px-5 py-2.5 text-body-sm"
            key={`${line.description}-${index}`}
          >
            <span className="text-ink">
              {line.description}{' '}
              {Number(line.quantity) > 1 && (
                <span className="text-ink-muted">× {line.quantity}</span>
              )}
            </span>
            <Money amount={line.total} className="font-semibold text-ink" />
          </div>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="border-t border-line bg-danger-soft px-5 py-2.5 text-caption text-danger">
          {issues.join(' ')}
        </div>
      )}

      <div
        className={`mt-auto flex items-end justify-between gap-3 border-t border-line px-5 py-3.5 ${
          isArtisan ? 'bg-artisan-soft/40' : 'bg-commercial-soft/40'
        }`}
      >
        {!partial ? (
          <>
            <span
              className={`text-caption font-medium ${
                isArtisan ? 'text-artisan-ink' : 'text-commercial-ink'
              }`}
            >
              Total por cobrar
            </span>
            <Money
              amount={balance || total}
              className="text-2xl font-light tracking-tight text-ink"
            />
          </>
        ) : (
          <label className="flex flex-1 flex-col gap-1 text-caption font-medium text-ink-muted">
            Paga ahora (de USD {balance || total})
            <input
              aria-label={`Importe para ${businessName}`}
              className="h-11 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent text-lead font-medium text-ink tabular-nums focus:border-ink focus:outline-none"
              inputMode="decimal"
              onChange={(e) => onPartialChange(e.target.value)}
              value={partialValue}
            />
          </label>
        )}
      </div>
    </section>
  )
}

export function CheckoutPage({ originKind }: CheckoutPageProps) {
  const id = Number(useParams().id)
  const validId = Number.isFinite(id) && id > 0
  const maintQuery = useMaintenanceCheckoutPreview(
    id,
    validId && originKind === 'MAINTENANCE',
  )
  const saleQuery = useSaleCheckoutPreview(id, validId && originKind === 'SALE')
  const previewQuery = originKind === 'MAINTENANCE' ? maintQuery : saleQuery
  const executeMutation = useExecuteCheckout()
  const toast = useToast()

  const [paymentMode, setPaymentMode] = useState<CheckoutPaymentMode>('CASH')
  const [partial, setPartial] = useState(false)
  const [artisanAmount, setArtisanAmount] = useState('')
  const [commercialAmount, setCommercialAmount] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [artisanCash, setArtisanCash] = useState('')
  const [artisanTransfer, setArtisanTransfer] = useState('')
  const [commercialCash, setCommercialCash] = useState('')
  const [commercialTransfer, setCommercialTransfer] = useState('')
  const [artisanWithholding, setArtisanWithholding] = useState('')
  const [commercialWithholding, setCommercialWithholding] = useState('')
  const [receivedCash, setReceivedCash] = useState('')
  const [creditTermDays, setCreditTermDays] = useState('30')
  const [receiverMode, setReceiverMode] = useState<
    'CUSTOMER' | 'FINAL_CONSUMER'
  >('CUSTOMER')
  const [email, setEmail] = useState('')
  const [saveEmail, setSaveEmail] = useState(true)
  const [closeOrder, setCloseOrder] = useState(false)
  const [result, setResult] = useState<CheckoutExecuteResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [intentKey, setIntentKey] = useState(() => crypto.randomUUID())

  const data: CheckoutPreview | undefined = previewQuery.data

  useEffect(() => {
    if (!data) return
    setEmail(data.customer.email || '')
    setSaveEmail(data.customer.can_save_email)
    setCloseOrder(data.closure.default_checked)
    setArtisanAmount(data.artisan.balance || data.artisan.total)
    setCommercialAmount(data.commercial.balance || data.commercial.total)
  }, [data])

  if (previewQuery.isPending) {
    return <LoadingState label="Preparando cobro y facturación…" />
  }
  if (previewQuery.isError || !data) {
    return (
      <InlineNotice title="No se pudo cargar el cobro" tone="danger">
        <p className="text-body-sm">
          {describeProblem(previewQuery.error).message}
        </p>
        <Button
          onClick={() => void previewQuery.refetch()}
          type="button"
          variant="secondary"
        >
          Reintentar
        </Button>
      </InlineNotice>
    )
  }

  const showArtisan = data.artisan.visible && data.artisan.lines.length > 0
  const showCommercial =
    data.commercial.visible && data.commercial.lines.length > 0
  const businessCount = (showArtisan ? 1 : 0) + (showCommercial ? 1 : 0)

  const artPay = showArtisan
    ? partial
      ? Math.min(num(artisanAmount), num(data.artisan.balance))
      : num(data.artisan.balance)
    : 0
  const comPay = showCommercial
    ? partial
      ? Math.min(num(commercialAmount), num(data.commercial.balance))
      : num(data.commercial.balance)
    : 0

  const totalToCollect = paymentMode === 'CREDIT' ? 0 : artPay + comPay
  const changeAmount =
    paymentMode === 'CASH' && num(receivedCash) > totalToCollect
      ? num(receivedCash) - totalToCollect
      : 0

  const trimmedEmail = email.trim()
  const savedEmail = (data.customer.email || '').trim()
  const emailDiffers =
    receiverMode === 'CUSTOMER' &&
    savedEmail.length > 0 &&
    trimmedEmail.length > 0 &&
    trimmedEmail.toLowerCase() !== savedEmail.toLowerCase()
  const missingEmail = receiverMode === 'CUSTOMER' && trimmedEmail.length === 0

  const precheckBlocked =
    (showArtisan && data.artisan.issues.length > 0) ||
    (showCommercial && data.commercial.issues.length > 0)
  const fiscalBlocked =
    (showArtisan && data.artisan.fiscal.impediments.length > 0) ||
    (showCommercial && data.commercial.fiscal.impediments.length > 0)
  const canUseFinalConsumer =
    paymentMode !== 'CREDIT' &&
    (!showArtisan || data.artisan.fiscal.can_use_final_consumer) &&
    (!showCommercial || data.commercial.fiscal.can_use_final_consumer)

  const buildBusinessPayment = (
    scope: 'artisan' | 'commercial',
  ): CheckoutBusinessPaymentInput | null => {
    const isArt = scope === 'artisan'
    const cashVal = num(isArt ? artisanCash : commercialCash)
    const trVal = num(isArt ? artisanTransfer : commercialTransfer)
    const whVal = num(isArt ? artisanWithholding : commercialWithholding)
    const withholding = whVal > 0 ? { amount: fmt(whVal) } : null

    if (paymentMode === 'MIXED') {
      const parts: { method: 'EFECTIVO' | 'TRANSFERENCIA'; amount: string }[] =
        []
      if (cashVal > 0) parts.push({ method: 'EFECTIVO', amount: fmt(cashVal) })
      if (trVal > 0)
        parts.push({ method: 'TRANSFERENCIA', amount: fmt(trVal) })
      return { parts, withholding }
    }
    if (partial) {
      const amt = isArt ? artPay : comPay
      const method = paymentMode === 'TRANSFER' ? 'TRANSFERENCIA' : 'EFECTIVO'
      const parts =
        amt > 0 && paymentMode !== 'CREDIT'
          ? [{ method: method as 'EFECTIVO' | 'TRANSFERENCIA', amount: fmt(amt) }]
          : []
      return { parts, withholding }
    }
    if (withholding) {
      return { withholding }
    }
    return null
  }

  const submit = async (includeInvoices: boolean) => {
    setErrorMessage(null)
    const input: CheckoutExecuteInput = {
      origin_kind: originKind,
      ...(originKind === 'MAINTENANCE'
        ? { order_id: data.origin.id }
        : { sale_id: data.origin.id }),
      payment_mode: paymentMode,
      partial,
      commercial_payment: showCommercial
        ? buildBusinessPayment('commercial')
        : null,
      artisan_payment: showArtisan ? buildBusinessPayment('artisan') : null,
      include_invoices: includeInvoices,
      receiver_mode: receiverMode,
      receiver_email: receiverMode === 'CUSTOMER' ? trimmedEmail : '',
      save_email_to_customer:
        includeInvoices &&
        receiverMode === 'CUSTOMER' &&
        saveEmail &&
        data.customer.can_save_email,
      credit_term_days:
        paymentMode === 'CREDIT' || partial
          ? Math.max(1, Number(creditTermDays) || 30)
          : null,
      close_order: originKind === 'MAINTENANCE' && closeOrder,
    }
    try {
      const res = await executeMutation.mutateAsync({
        input,
        idempotencyKey: intentKey,
      })
      setResult(res)
      setIntentKey(crypto.randomUUID())
      toast.success(
        includeInvoices && res.overall_status === 'completed'
          ? 'Cobro registrado y factura local preparada (sin enviar).'
          : 'Cobro registrado.',
      )
    } catch (error) {
      setErrorMessage(describeProblem(error).message)
    }
  }

  const backTo =
    originKind === 'MAINTENANCE'
      ? `/maintenance/${data.origin.id}`
      : `/sales/${data.origin.id}`

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-card bg-accent-soft text-accent"
          >
            <Receipt size={26} />
          </span>
          <div>
            <p className="text-caption font-medium text-ink-muted">
              {originKind === 'MAINTENANCE'
                ? `Mantenimiento ${data.origin.number}`
                : `Venta ${data.origin.number}`}
            </p>
            <h1 className="text-title font-bold tracking-tight text-ink">
              Cobrar y facturar
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
              <span className="font-medium text-ink">{data.customer.name}</span>
              {data.origin.vehicle_plate && (
                <PlateTag plate={data.origin.vehicle_plate} />
              )}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-body-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
          to={backTo}
        >
          <ArrowLeft size={16} />
          {originKind === 'MAINTENANCE'
            ? 'Volver al mantenimiento'
            : 'Volver a la venta'}
        </Link>
      </div>

      {errorMessage && (
        <InlineNotice title="No se pudo completar la operación" tone="danger">
          <p className="text-body-sm">{errorMessage}</p>
        </InlineNotice>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {showArtisan && (
              <BusinessCard
                balance={data.artisan.balance}
                businessName={data.artisan.business_name}
                done={result !== null}
                fiscalState={result?.artisan.fiscal_state}
                issues={data.artisan.issues}
                lines={data.artisan.lines}
                onPartialChange={setArtisanAmount}
                partial={partial && !result}
                partialValue={artisanAmount}
                scope="artisan"
                subtitle="Factura de la mano de obra"
                total={data.artisan.total}
              />
            )}
            {showCommercial && (
              <BusinessCard
                balance={data.commercial.balance}
                businessName={data.commercial.business_name}
                done={result !== null}
                fiscalState={result?.commercial.fiscal_state}
                issues={data.commercial.issues}
                lines={data.commercial.lines}
                onPartialChange={setCommercialAmount}
                partial={partial && !result}
                partialValue={commercialAmount}
                scope="commercial"
                subtitle="Factura de los repuestos"
                total={data.commercial.total}
              />
            )}
          </div>

          <section className="space-y-4 rounded-card border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-body font-bold text-ink">
                Facturas a nombre de
              </h2>
              {canUseFinalConsumer && !result && (
                <button
                  className="min-h-9 rounded-control px-2.5 text-caption font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
                  onClick={() =>
                    setReceiverMode((mode) =>
                      mode === 'CUSTOMER' ? 'FINAL_CONSUMER' : 'CUSTOMER',
                    )
                  }
                  type="button"
                >
                  {receiverMode === 'CUSTOMER'
                    ? 'Cambiar a consumidor final'
                    : 'Usar datos del cliente'}
                </button>
              )}
            </div>

            {receiverMode === 'FINAL_CONSUMER' ? (
              <InlineNotice
                title="Receptor: Consumidor final (9999999999999)"
                tone="warning"
              >
                <p className="text-caption">
                  Una factura a consumidor final no admite anulación ni nota de
                  crédito ante el SRI. El cliente operativo del registro no
                  cambia.
                </p>
              </InlineNotice>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {data.customer.name}
                    </p>
                    <p className="text-caption text-ink-muted tabular-nums">
                      {data.customer.identification_type}{' '}
                      {data.customer.identification}
                    </p>
                  </div>
                </div>

                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="flex flex-col gap-1 text-caption font-medium text-ink-muted">
                    Correo para la factura
                    <input
                      className={`h-11 w-full border-0 border-b-[1.5px] bg-transparent text-body text-ink focus:border-ink focus:outline-none ${
                        missingEmail ? 'border-danger' : 'border-line-strong'
                      }`}
                      disabled={result !== null}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      type="email"
                      value={email}
                    />
                  </label>
                  {missingEmail && (
                    <StatusBadge label="Falta el correo" tone="danger" />
                  )}
                </div>

                {emailDiffers && saveEmail && data.customer.can_save_email && (
                  <InlineNotice
                    title="El correo difiere del guardado en el cliente"
                    tone="warning"
                  >
                    <p className="text-caption">
                      Guardado actualmente: <strong>{savedEmail}</strong> · Se
                      reemplazará por <strong>{trimmedEmail}</strong> si dejas
                      la casilla marcada.
                    </p>
                  </InlineNotice>
                )}

                {data.customer.can_save_email && (
                  <Checkbox
                    checked={saveEmail}
                    disabled={result !== null}
                    label="Guardar este correo en la ficha del cliente"
                    onChange={(e) => setSaveEmail(e.target.checked)}
                  />
                )}
              </>
            )}

            <p className="text-caption text-ink-muted">
              Facturación en modo pruebas: la factura queda preparada localmente
              (sin enviar al SRI).
            </p>
          </section>
        </div>

        <aside>
          {!result ? (
            <section className="space-y-4 rounded-card border border-line bg-surface p-5">
              <h2 className="text-body font-bold text-ink">¿Cómo paga?</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      mode: 'CASH',
                      label: 'Efectivo',
                      icon: <MoneyIcon size={17} />,
                    },
                    {
                      mode: 'TRANSFER',
                      label: 'Transferencia',
                      icon: <ArrowsLeftRight size={17} />,
                    },
                    {
                      mode: 'MIXED',
                      label: 'Combinado',
                      icon: <ArrowsLeftRight size={17} />,
                    },
                    {
                      mode: 'CREDIT',
                      label: 'Queda debiendo',
                      icon: <Clock size={17} />,
                    },
                  ] as const
                ).map((item) => {
                  const active = paymentMode === item.mode
                  return (
                    <button
                      aria-pressed={active}
                      className={`relative flex min-h-20 flex-col items-start gap-2 rounded-xl border-[1.5px] p-3 text-left transition ${
                        active
                          ? 'border-ink bg-surface-muted'
                          : 'border-line bg-surface hover:border-line-strong'
                      }`}
                      key={item.mode}
                      onClick={() => {
                        setPaymentMode(item.mode)
                        if (item.mode === 'MIXED') setShowAdvanced(true)
                      }}
                      type="button"
                    >
                      <span
                        className={`grid size-8 place-items-center rounded-lg ${
                          active
                            ? 'bg-ink text-white'
                            : 'bg-surface-muted text-ink'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="text-body-sm font-semibold text-ink">
                        {item.label}
                      </span>
                      {active && (
                        <span className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-accent text-white">
                          <Check size={12} weight="bold" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {paymentMode === 'CASH' && (
                <div className="grid grid-cols-2 items-end gap-3">
                  <label className="flex flex-col gap-1 text-caption font-medium text-ink-muted">
                    Recibe (opcional)
                    <input
                      className="h-11 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent text-body text-ink tabular-nums focus:border-ink focus:outline-none"
                      inputMode="decimal"
                      onChange={(e) => setReceivedCash(e.target.value)}
                      placeholder="0.00"
                      value={receivedCash}
                    />
                  </label>
                  <div>
                    <p className="text-caption font-medium text-ink-muted">
                      Vuelto
                    </p>
                    <p className="flex h-11 items-center text-lead font-semibold text-ink tabular-nums">
                      {fmt(changeAmount)}
                    </p>
                  </div>
                </div>
              )}

              {(paymentMode === 'CREDIT' || partial) && (
                <label className="flex flex-col gap-1 text-caption font-medium text-ink-muted">
                  Plazo para pagar, en días
                  <input
                    className="h-11 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent text-body text-ink tabular-nums focus:border-ink focus:outline-none"
                    inputMode="numeric"
                    onChange={(e) => setCreditTermDays(e.target.value)}
                    value={creditTermDays}
                  />
                  <span className="text-caption font-normal text-ink-muted">
                    Solo se escribe en la factura. No crea cuotas ni recargos.
                  </span>
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                {paymentMode !== 'CREDIT' && paymentMode !== 'MIXED' && (
                  <button
                    className="min-h-9 rounded-control px-2 text-caption font-semibold text-artisan-ink hover:bg-surface-muted"
                    onClick={() => setPartial((p) => !p)}
                    type="button"
                  >
                    {partial ? 'Paga todo' : 'Paga solo una parte'}
                  </button>
                )}
                <button
                  className="min-h-9 rounded-control px-2 text-caption font-semibold text-ink-muted hover:bg-surface-muted"
                  onClick={() => setShowAdvanced((v) => !v)}
                  type="button"
                >
                  {showAdvanced
                    ? 'Ocultar combinado y retención'
                    : 'Combinado o retención'}
                </button>
              </div>

              {showAdvanced && (
                <div className="space-y-3 rounded-lg border border-line bg-surface-muted/50 p-3">
                  {showArtisan && (
                    <div className="space-y-2">
                      <p className="text-caption font-semibold text-ink">
                        {data.artisan.business_name}
                      </p>
                      {paymentMode === 'MIXED' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            aria-label="Efectivo servicios"
                            className="h-10 border-b border-line-strong bg-transparent text-body-sm tabular-nums"
                            inputMode="decimal"
                            onChange={(e) => setArtisanCash(e.target.value)}
                            placeholder="Efectivo"
                            value={artisanCash}
                          />
                          <input
                            aria-label="Transferencia servicios"
                            className="h-10 border-b border-line-strong bg-transparent text-body-sm tabular-nums"
                            inputMode="decimal"
                            onChange={(e) => setArtisanTransfer(e.target.value)}
                            placeholder="Transferencia"
                            value={artisanTransfer}
                          />
                        </div>
                      )}
                      {data.artisan.withholding.enabled && (
                        <input
                          aria-label="Retención servicios"
                          className="h-10 w-full border-b border-line-strong bg-transparent text-body-sm tabular-nums"
                          inputMode="decimal"
                          onChange={(e) =>
                            setArtisanWithholding(e.target.value)
                          }
                          placeholder="Retención recibida (opcional)"
                          value={artisanWithholding}
                        />
                      )}
                    </div>
                  )}
                  {showCommercial && (
                    <div className="space-y-2">
                      <p className="text-caption font-semibold text-ink">
                        {data.commercial.business_name}
                      </p>
                      {paymentMode === 'MIXED' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            aria-label="Efectivo repuestos"
                            className="h-10 border-b border-line-strong bg-transparent text-body-sm tabular-nums"
                            inputMode="decimal"
                            onChange={(e) => setCommercialCash(e.target.value)}
                            placeholder="Efectivo"
                            value={commercialCash}
                          />
                          <input
                            aria-label="Transferencia repuestos"
                            className="h-10 border-b border-line-strong bg-transparent text-body-sm tabular-nums"
                            inputMode="decimal"
                            onChange={(e) =>
                              setCommercialTransfer(e.target.value)
                            }
                            placeholder="Transferencia"
                            value={commercialTransfer}
                          />
                        </div>
                      )}
                      {data.commercial.withholding.enabled && (
                        <input
                          aria-label="Retención repuestos"
                          className="h-10 w-full border-b border-line-strong bg-transparent text-body-sm tabular-nums"
                          inputMode="decimal"
                          onChange={(e) =>
                            setCommercialWithholding(e.target.value)
                          }
                          placeholder="Retención recibida (opcional)"
                          value={commercialWithholding}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {originKind === 'MAINTENANCE' && (
                <div className="space-y-1">
                  <Checkbox
                    checked={closeOrder}
                    disabled={!data.closure.can_close}
                    label="Cerrar el mantenimiento al cobrar"
                    onChange={(e) => setCloseOrder(e.target.checked)}
                  />
                  {!data.closure.can_close &&
                    data.closure.missing_requirements.length > 0 && (
                      <p className="text-caption text-ink-muted">
                        {data.closure.missing_requirements.join(' ')}
                      </p>
                    )}
                </div>
              )}

              <div className="border-t border-line pt-3">
                <p className="text-caption font-medium text-ink-muted">
                  {paymentMode === 'CREDIT'
                    ? 'Hoy no cobra; queda debiendo'
                    : partial
                      ? 'Cobra ahora'
                      : 'Total a cobrar'}
                </p>
                <p className="text-3xl font-light tracking-tight text-ink tabular-nums">
                  USD {fmt(totalToCollect)}
                </p>
                {showArtisan && showCommercial && (
                  <p className="mt-1 text-caption text-ink-muted tabular-nums">
                    Mano de obra {fmt(artPay)} · Repuestos {fmt(comPay)}
                  </p>
                )}
              </div>

              <Button
                className="min-h-12 w-full"
                disabled={
                  executeMutation.isPending ||
                  precheckBlocked ||
                  missingEmail ||
                  fiscalBlocked ||
                  businessCount === 0
                }
                onClick={() => void submit(true)}
                type="button"
              >
                {missingEmail
                  ? 'Escribe el correo para facturar'
                  : executeMutation.isPending
                    ? 'Procesando…'
                    : 'Cobrar y facturar'}
              </Button>

              {(missingEmail || fiscalBlocked) && !precheckBlocked && (
                <Button
                  className="min-h-11 w-full"
                  disabled={executeMutation.isPending || businessCount === 0}
                  onClick={() => void submit(false)}
                  type="button"
                  variant="secondary"
                >
                  Solo cobrar (facturar después)
                </Button>
              )}

              <p className="text-center text-caption text-ink-muted">
                {businessCount === 2
                  ? 'Se registran 2 cobros y se preparan 2 facturas locales, una por negocio.'
                  : 'Se registra 1 cobro y se prepara 1 factura local en modo pruebas.'}
              </p>
            </section>
          ) : (
            <section className="space-y-4 rounded-card border border-line bg-surface p-5">
              <span
                aria-hidden="true"
                className={`grid size-12 place-items-center rounded-full ${
                  result.overall_status === 'completed'
                    ? 'bg-success-soft text-success'
                    : 'bg-warning-soft text-warning'
                }`}
              >
                {result.overall_status === 'completed' ? (
                  <CheckCircle size={26} />
                ) : (
                  <WarningCircle size={26} />
                )}
              </span>

              <div>
                <h2 className="text-heading font-bold text-ink">
                  {result.overall_status === 'completed'
                    ? 'Cobro registrado'
                    : 'Cobro registrado con pendientes fiscales'}
                </h2>
                <p className="mt-1 text-caption text-ink-muted">
                  {result.customer_email_updated
                    ? 'El correo quedó guardado en la ficha del cliente. '
                    : ''}
                  {result.order_closure.closed
                    ? 'El mantenimiento quedó cerrado.'
                    : result.order_closure.reason || ''}
                </p>
              </div>

              <div className="divide-y divide-line rounded-xl border border-line">
                {result.artisan.executed && (
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body-sm font-semibold text-ink">
                        {data.artisan.business_name}
                      </span>
                      <StatusBadge
                        label={
                          result.artisan.paid
                            ? 'Cobro registrado'
                            : 'Registrado a crédito'
                        }
                        tone="success"
                      />
                    </div>
                    <p className="text-caption text-ink-muted">
                      {result.artisan.fiscal_state === 'PREPARED'
                        ? 'Factura preparada (sin enviar)'
                        : result.artisan.fiscal_state === 'FAILED'
                          ? `Factura pendiente: ${result.artisan.fiscal_error}`
                          : 'Factura pendiente (solo cobro)'}
                    </p>
                  </div>
                )}
                {result.commercial.executed && (
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body-sm font-semibold text-ink">
                        {data.commercial.business_name}
                      </span>
                      <StatusBadge
                        label={
                          result.commercial.paid
                            ? 'Cobro registrado'
                            : 'Registrado a crédito'
                        }
                        tone="success"
                      />
                    </div>
                    <p className="text-caption text-ink-muted">
                      {result.commercial.fiscal_state === 'PREPARED'
                        ? 'Factura preparada (sin enviar)'
                        : result.commercial.fiscal_state === 'FAILED'
                          ? `Factura pendiente: ${result.commercial.fiscal_error}`
                          : 'Factura pendiente (solo cobro)'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-ink px-4 text-body-sm font-semibold text-ink hover:bg-ink hover:text-white"
                  to={backTo}
                >
                  Ver ficha
                </Link>
                <Link
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control bg-accent px-4 text-body-sm font-semibold text-white hover:bg-accent-hover"
                  to="/"
                >
                  Volver al inicio
                </Link>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
