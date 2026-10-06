import { useEffect, useState, type RefObject } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import {
  emptyWithholding,
  settlementValid,
  toWithholding,
  WithholdingQuestion,
} from '@/features/sales/WithholdingQuestion'
import { ProblemError } from '@/shared/api/client'
import {
  PartsFields,
  partsTotal,
  partsValid,
  toParts,
} from '@/features/sales/PartsFields'
import {
  clearIntent,
  getOrCreateIntent,
  intentKey,
} from '@/features/sales/moneyIntent'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Field,
  FiscalScopeBadge,
  FormModal,
  InlineNotice,
  LoadingState,
  Money,
  Select,
  Textarea,
} from '@/shared/ui'

import { maintenanceApi } from './api'
import { useBillingMutations, useVoidPreview } from './billingHooks'
import type {
  ArtisanPayment,
  MaintenanceOrder,
  ServiceOperationPreview,
  ServiceOperationSummary,
} from './types'

type Condition = 'CONTADO' | 'CREDITO'

/**
 * Generar el comprobante de servicios (RUC artesanal): vista previa sin efectos con importes, condición y
 * efectos; la confirmación exige la huella revisada. No afecta inventario ni registra pagos.
 */
export function ServiceOperationDialog({
  order,
  onClose,
  onDone,
  returnFocusRef,
}: {
  order: MaintenanceOrder
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useBillingMutations()
  const tracker = useIntentTracker()
  const [condition, setCondition] = useState<Condition>('CONTADO')
  const [preview, setPreview] = useState<ServiceOperationPreview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    maintenanceApi
      .previewServiceOperation(order.id, condition)
      .then((result) => active && setPreview(result))
      .catch(
        (problem: unknown) =>
          active && setError(describeProblem(problem).message),
      )
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [order.id, condition, order.version])

  const blocked = !preview || preview.issues.length > 0 || loading

  async function save(): Promise<boolean> {
    if (!preview) return false
    try {
      const operation = await tracker.run(
        { documentServices: order.id, digest: preview.review_digest },
        (key) =>
          mutations.confirmServices.mutateAsync({
            id: order.id,
            condition,
            reviewDigest: preview.review_digest,
            expectedVersion: order.version,
            key,
          }),
      )
      onDone(
        `Comprobante de servicios ${operation.internal_number} generado (RUC artesanal).`,
      )
      return true
    } catch (problem) {
      const view = describeProblem(problem)
      throw new Error(view.message, { cause: problem })
    }
  }

  return (
    <FormModal
      description="Genera la operación ART-SER con los servicios pendientes. Comprobante interno: no es una factura electrónica autorizada por el SRI. No descuenta inventario ni registra cobros."
      onClose={onClose}
      onSave={save}
      open
      {...(returnFocusRef ? { returnFocusRef } : {})}
      saveDisabled={blocked}
      saveLabel="Generar comprobante"
      size="wide"
      title="Generar comprobante de servicios"
    >
      <div className="space-y-4">
        <FiscalScopeBadge scope="artesanal" />
        <Field
          hint="Crédito admite abonos sin vencimiento ni cuotas; contado pide después el cobro completo."
          id="service-condition"
          label="Condición"
        >
          <Select
            id="service-condition"
            onChange={(event) => setCondition(event.target.value as Condition)}
            value={condition}
          >
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </Field>
        {loading && <LoadingState label="Calculando importes…" />}
        {error && (
          <InlineNotice title="No se pudo revisar" tone="danger">
            {error}
          </InlineNotice>
        )}
        {preview && !loading && (
          <>
            {preview.warnings.map((warning) => (
              <InlineNotice
                key={warning.code}
                title="Revise antes de confirmar"
                tone="warning"
              >
                {warning.message}
              </InlineNotice>
            ))}
            {preview.issues.map((issue) => (
              <InlineNotice
                key={issue.code + issue.message}
                title="No se puede confirmar"
                tone="danger"
              >
                {issue.message}
              </InlineNotice>
            ))}
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Servicio</th>
                  <th className="py-2 pr-3 text-right font-semibold">Cant.</th>
                  <th className="py-2 pr-3 text-right font-semibold">Base</th>
                  <th className="py-2 pr-3 text-right font-semibold">
                    Impuesto
                  </th>
                  <th className="py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr
                    className="border-b border-line last:border-0"
                    key={line.service_line_id}
                  >
                    <td className="py-2 pr-3">
                      {line.service_name}
                      {line.service_code && (
                        <span className="block font-mono text-xs text-ink-muted">
                          {line.service_code}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">{line.quantity}</td>
                    <td className="py-2 pr-3 text-right">
                      <Money amount={line.base_amount} />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Money amount={line.tax_amount} />
                    </td>
                    <td className="py-2 text-right font-medium">
                      <Money amount={line.total_amount} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.totals && (
              <p className="flex justify-end gap-3 text-[13px]">
                <span className="text-ink-muted">Total a documentar</span>
                <Money
                  amount={preview.totals.total}
                  className="font-semibold"
                />
              </p>
            )}
            <InlineNotice title="Efectos" tone="info">
              Numeración {preview.effects.series}; nace un saldo por cobrar del
              RUC artesanal. No afecta inventario ni registra pagos. Las líneas
              documentadas quedarán bloqueadas.
            </InlineNotice>
          </>
        )}
      </div>
    </FormModal>
  )
}

/** Cobro del RUC artesanal aplicado a una sola operación; nunca a la venta comercial. */
export function ArtisanPaymentDialog({
  operation,
  userScope,
  onClose,
  onDone,
  returnFocusRef,
}: {
  operation: ServiceOperationSummary
  userScope: string
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useBillingMutations()
  const tracker = useIntentTracker()
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const [withheld, setWithheld] = useState(emptyWithholding)
  const [warning, setWarning] = useState<{ percentage: string } | null>(null)
  const key = intentKey(userScope, operation.id, 'artisan-payment')
  const parts = toParts(cash, transfer)
  const withholding = toWithholding(withheld)
  const valid = settlementValid(cash, transfer, withheld)

  async function save(): Promise<boolean> {
    if (!valid) return false
    try {
      const result = await tracker.run(
        { pay: operation.id, parts, withholding },
        (idem) =>
          mutations.pay.mutateAsync({
            id: operation.id,
            parts,
            withholding,
            factId: getOrCreateIntent(key),
            key: idem,
          }),
      )
      clearIntent(key)
      onDone(
        `Cobro de servicios registrado en ${operation.internal_number}. Saldo: USD ${result.balance}.`,
      )
      return true
    } catch (problem) {
      // Importe inusual: el servidor pide confirmarlo antes de registrar.
      if (
        problem instanceof ProblemError &&
        problem.code === 'withholding_warning'
      ) {
        const percentage = /([\d.]+)\s*%/.exec(problem.message)?.[1] ?? ''
        setWarning({ percentage })
      }
      throw new Error(describeProblem(problem).message, { cause: problem })
    }
  }

  return (
    <FormModal
      description="Registra un cobro ya recibido. El registro en el sistema no entrega ni recibe dinero."
      dirty={Boolean(cash || transfer || withheld.active)}
      onClose={onClose}
      onSave={save}
      open
      {...(returnFocusRef ? { returnFocusRef } : {})}
      saveDisabled={!valid}
      saveLabel={
        parts.length > 0
          ? `Registrar cobro de USD ${partsTotal(cash, transfer)}`
          : 'Registrar retención'
      }
      title={`Cobrar servicios · ${operation.internal_number}`}
    >
      <div className="space-y-4">
        <FiscalScopeBadge scope="artesanal" />
        <InlineNotice
          title={`Saldo pendiente: USD ${operation.balance}`}
          tone="info"
        >
          {operation.condition === 'CONTADO'
            ? 'Una operación de contado exige cubrir el saldo completo en un solo cobro.'
            : 'Una operación a crédito admite abonos hasta el saldo, sin vencimiento ni cuotas.'}{' '}
          El importe se aplica solo a esta operación del RUC artesanal; no se
          aplica a los repuestos.
        </InlineNotice>
        <PartsFields
          cash={cash}
          idPrefix="artisan-payment"
          onChange={(next) => {
            setCash(next.cash)
            setTransfer(next.transfer)
          }}
          transfer={transfer}
        />
        <WithholdingQuestion
          balance={operation.balance}
          cash={cash}
          context={operation.withholding_context}
          idPrefix="artisan-payment"
          onChange={(next) => {
            setWithheld(next)
            if (!next.active) setWarning(null)
          }}
          transfer={transfer}
          value={withheld}
          warning={warning}
        />
      </div>
    </FormModal>
  )
}

/** Anulación administrativa; bloqueada con pagos vigentes (sin reembolsos en esta entrega). */
export function VoidServiceOperationDialog({
  operation,
  onClose,
  onDone,
  returnFocusRef,
}: {
  operation: ServiceOperationSummary
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useBillingMutations()
  const tracker = useIntentTracker()
  const preview = useVoidPreview(operation.id, true)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!reason.trim()) {
      setError('El motivo es obligatorio.')
      return false
    }
    try {
      await tracker.run({ void: operation.id, reason }, (key) =>
        mutations.voidOperation.mutateAsync({
          id: operation.id,
          reason,
          expectedVersion: preview.data?.version ?? operation.version,
          key,
        }),
      )
      onDone(
        `${operation.internal_number} anulada; sus servicios quedan pendientes de documentar.`,
      )
      return true
    } catch (problem) {
      throw new Error(describeProblem(problem).message, { cause: problem })
    }
  }

  return (
    <FormModal
      cancelLabel="Conservar la operación"
      description="La anulación conserva número, líneas y motivo; no afecta inventario."
      dirty={Boolean(reason)}
      onClose={onClose}
      onSave={save}
      open
      {...(returnFocusRef ? { returnFocusRef } : {})}
      saveDisabled={!preview.data?.can_void}
      saveLabel="Anular operación"
      title={`Anular ${operation.internal_number}`}
    >
      <div className="space-y-4">
        {preview.isPending && <LoadingState label="Revisando…" />}
        {preview.data?.blockers.map((blocker) => (
          <InlineNotice key={blocker} title="No se puede anular" tone="danger">
            {blocker}
          </InlineNotice>
        ))}
        <Field error={error} id="void-reason" label="Motivo" required>
          <Textarea
            id="void-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </Field>
      </div>
    </FormModal>
  )
}

/** Corrección administrativa de un pago artesanal registrado por error. */
export function ArtisanCorrectionDialog({
  operation,
  payment,
  userScope,
  onClose,
  onDone,
  returnFocusRef,
}: {
  operation: ServiceOperationSummary
  payment: ArtisanPayment
  userScope: string
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useBillingMutations()
  const tracker = useIntentTracker()
  const [reason, setReason] = useState('')
  const [replace, setReplace] = useState(false)
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const [error, setError] = useState('')
  const correctionKey = intentKey(
    userScope,
    operation.id,
    'artisan-correction',
    String(payment.id),
  )
  const replacementKey = intentKey(
    userScope,
    operation.id,
    'artisan-replacement',
    String(payment.id),
  )

  async function save(): Promise<boolean> {
    if (!reason.trim()) {
      setError('El motivo es obligatorio.')
      return false
    }
    if (replace && !partsValid(cash, transfer)) return false
    const replacement = replace
      ? {
          operation_id: getOrCreateIntent(replacementKey),
          parts: toParts(cash, transfer),
        }
      : undefined
    try {
      await tracker.run({ correct: payment.id, reason, replacement }, (key) =>
        mutations.correctPayment.mutateAsync({
          id: operation.id,
          paymentId: payment.id,
          reason,
          ...(replacement ? { replacement } : {}),
          factId: getOrCreateIntent(correctionKey),
          key,
        }),
      )
      clearIntent(correctionKey)
      clearIntent(replacementKey)
      onDone(
        replace
          ? 'Pago sustituido; el original se conserva en el historial.'
          : 'Pago anulado; el original se conserva en el historial.',
      )
      return true
    } catch (problem) {
      throw new Error(describeProblem(problem).message, { cause: problem })
    }
  }

  return (
    <FormModal
      description="Corrige un pago registrado por error; no representa un reembolso de dinero."
      dirty={Boolean(reason || cash || transfer)}
      onClose={onClose}
      onSave={save}
      open
      {...(returnFocusRef ? { returnFocusRef } : {})}
      saveLabel={replace ? 'Sustituir pago' : 'Anular pago'}
      title={`Corregir pago de USD ${payment.amount}`}
    >
      <div className="space-y-4">
        <Field error={error} id="correction-reason" label="Motivo" required>
          <Textarea
            id="correction-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            checked={replace}
            onChange={(event) => setReplace(event.target.checked)}
            type="checkbox"
          />
          Registrar un pago de reemplazo
        </label>
        {replace && (
          <PartsFields
            cash={cash}
            idPrefix="artisan-replacement"
            onChange={(next) => {
              setCash(next.cash)
              setTransfer(next.transfer)
            }}
            transfer={transfer}
          />
        )}
      </div>
    </FormModal>
  )
}
