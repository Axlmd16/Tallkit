import { useState, type RefObject } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Field,
  FiscalScopeBadge,
  FormModal,
  InlineNotice,
  Input,
  Money,
  StatusBadge,
  Textarea,
} from '@/shared/ui'

import { validAmount } from './PartsFields'
import type { VoucherInput, Withholding } from './types'

const VOUCHER = /^\d{3}-\d{3}-\d{9}$/
const today = () => new Date().toLocaleDateString('en-CA')

export type WithholdingScope = 'commercial' | 'artesanal'

export function voucherLabel(withholding: Withholding): string {
  if (withholding.state === 'VOIDED') return 'Anulada'
  return withholding.voucher_pending
    ? 'Comprobante pendiente'
    : `Comprobante ${withholding.voucher_number}`
}

/**
 * Retenciones recibidas de una operación: vigentes y anuladas, con la situación de su
 * comprobante. Las acciones dependen de los permisos que el servidor vuelve a comprobar.
 */
export function WithholdingList({
  withholdings,
  canComplete,
  canAdmin,
  onComplete,
  onCorrect,
  onVoid,
}: {
  withholdings: Withholding[]
  canComplete: boolean
  canAdmin: boolean
  onComplete: (item: Withholding, origin: HTMLElement) => void
  onCorrect: (item: Withholding, origin: HTMLElement) => void
  onVoid: (item: Withholding, origin: HTMLElement) => void
}) {
  if (withholdings.length === 0) return null
  return (
    <ul className="divide-y divide-line text-body">
      {withholdings.map((item) => {
        const active = item.state === 'ACTIVE'
        return (
          <li
            aria-label={`Retención ${item.id}`}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            key={item.id}
          >
            <Money amount={item.amount} className="font-semibold" />
            <span className="text-ink-muted">{item.effective_date}</span>
            <StatusBadge
              label={voucherLabel(item)}
              tone={
                !active
                  ? 'neutral'
                  : item.voucher_pending
                    ? 'warning'
                    : 'success'
              }
            />
            {item.income_tax_amount != null && item.vat_amount != null && (
              <span className="text-label text-ink-muted">
                Renta USD {item.income_tax_amount} · IVA USD {item.vat_amount}
              </span>
            )}
            {item.void_reason && (
              <span className="text-label text-ink-muted">
                Motivo: {item.void_reason}
              </span>
            )}
            <span className="ml-auto flex flex-wrap gap-2">
              {active && item.voucher_pending && canComplete && (
                <Button
                  onClick={(event) => onComplete(item, event.currentTarget)}
                  type="button"
                  variant="soft"
                >
                  Completar comprobante
                </Button>
              )}
              {active && !item.voucher_pending && canAdmin && (
                <Button
                  onClick={(event) => onCorrect(item, event.currentTarget)}
                  type="button"
                  variant="ghost"
                >
                  Corregir comprobante
                </Button>
              )}
              {active && canAdmin && (
                <Button
                  onClick={(event) => onVoid(item, event.currentTarget)}
                  type="button"
                  variant="ghost"
                >
                  Anular retención
                </Button>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Datos del comprobante de retención. Se completan después del cobro, cuando el
 * comprobante electrónico ya llegó; el importe retenido nunca cambia aquí.
 */
export function VoucherDialog({
  withholding,
  scope,
  correcting = false,
  onSubmit,
  onClose,
  onDone,
  returnFocusRef,
}: {
  withholding: Withholding
  scope: WithholdingScope
  /** Corrección administrativa de un comprobante ya completado: exige motivo. */
  correcting?: boolean
  onSubmit: (
    data: VoucherInput & { reason: string; operationId: string },
    key: string,
  ) => Promise<unknown>
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const tracker = useIntentTracker()
  const [number, setNumber] = useState(withholding.voucher_number ?? '')
  const [date, setDate] = useState(withholding.voucher_date ?? today())
  const [income, setIncome] = useState(withholding.income_tax_amount ?? '')
  const [vat, setVat] = useState(withholding.vat_amount ?? '')
  const [reason, setReason] = useState('')
  const [operationId] = useState(() => crypto.randomUUID())

  const hasBreakdown = Boolean(income.trim() || vat.trim())
  const amountOk = (text: string) =>
    /^\d+(\.\d{1,2})?$/.test(text.trim()) || validAmount(text)
  const breakdownOk = !hasBreakdown || (amountOk(income) && amountOk(vat))
  const numberError =
    number && !VOUCHER.test(number.trim())
      ? 'Use el formato 001-001-000000001.'
      : undefined
  const valid =
    VOUCHER.test(number.trim()) &&
    Boolean(date) &&
    breakdownOk &&
    (!correcting || reason.trim().length > 0)

  async function save(): Promise<boolean> {
    if (!valid) return false
    const data = {
      voucherNumber: number.trim(),
      voucherDate: date,
      incomeTaxAmount: hasBreakdown ? income.trim() : null,
      vatAmount: hasBreakdown ? vat.trim() : null,
      reason: reason.trim(),
      operationId,
    }
    try {
      await tracker.run({ voucher: withholding.id, data }, (key) =>
        onSubmit(data, key),
      )
      onDone(
        correcting
          ? 'Comprobante corregido.'
          : 'Comprobante de retención completado.',
      )
      return true
    } catch (problem) {
      throw new Error(describeProblem(problem).message, { cause: problem })
    }
  }

  return (
    <FormModal
      description="Copie los datos del comprobante electrónico que emitió el cliente. No cambian el valor retenido ni el saldo."
      dirty={Boolean(number || income || vat || reason)}
      onClose={onClose}
      onSave={save}
      open
      {...(returnFocusRef ? { returnFocusRef } : {})}
      saveDisabled={!valid}
      saveLabel={correcting ? 'Guardar corrección' : 'Guardar comprobante'}
      title={
        correcting
          ? 'Corregir comprobante de retención'
          : 'Completar comprobante'
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-body">
          <span className="font-semibold text-ink">
            Valor retenido: <Money amount={withholding.amount} />
          </span>
          <FiscalScopeBadge scope={scope} />
        </div>
        <Field
          error={numberError}
          hint="Lo encuentra en SRI en línea, en comprobantes electrónicos recibidos."
          id="voucher-number"
          label="Número del comprobante"
        >
          <Input
            id="voucher-number"
            onChange={(event) => setNumber(event.target.value)}
            placeholder="001-001-000000001"
            value={number}
          />
        </Field>
        <Field id="voucher-date" label="Fecha de emisión">
          <Input
            id="voucher-date"
            max={today()}
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
        </Field>
        <fieldset className="space-y-3">
          <legend className="text-body font-semibold text-ink">
            Desglose (opcional)
          </legend>
          <p className="text-label text-ink-muted">
            Si el comprobante separa renta e IVA, anote ambos valores. Deben
            sumar el valor retenido.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="voucher-income" label="Retención de renta (USD)">
              <Input
                id="voucher-income"
                inputMode="decimal"
                onChange={(event) => setIncome(event.target.value)}
                value={income}
              />
            </Field>
            <Field id="voucher-vat" label="Retención de IVA (USD)">
              <Input
                id="voucher-vat"
                inputMode="decimal"
                onChange={(event) => setVat(event.target.value)}
                value={vat}
              />
            </Field>
          </div>
          {hasBreakdown && !breakdownOk && (
            <p className="text-label text-danger">
              Complete los dos valores con hasta 2 decimales, o deje ambos
              vacíos.
            </p>
          )}
        </fieldset>
        {correcting && (
          <Field id="voucher-reason" label="Motivo de la corrección">
            <Textarea
              id="voucher-reason"
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            />
          </Field>
        )}
      </div>
    </FormModal>
  )
}

/** Anulación administrativa: el valor vuelve al saldo y el registro se conserva. */
export function VoidWithholdingDialog({
  withholding,
  scope,
  onSubmit,
  onClose,
  onDone,
  returnFocusRef,
}: {
  withholding: Withholding
  scope: WithholdingScope
  onSubmit: (reason: string, key: string) => Promise<unknown>
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const tracker = useIntentTracker()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  async function save(): Promise<boolean> {
    if (!trimmed) return false
    try {
      await tracker.run({ void: withholding.id, reason: trimmed }, (key) =>
        onSubmit(trimmed, key),
      )
      onDone('Retención anulada. Su valor volvió al saldo pendiente.')
      return true
    } catch (problem) {
      throw new Error(describeProblem(problem).message, { cause: problem })
    }
  }

  return (
    <FormModal
      description="Úsela solo si la retención se registró por error. No se borra: queda en el historial con su motivo."
      dirty={Boolean(reason)}
      onClose={onClose}
      onSave={save}
      open
      {...(returnFocusRef ? { returnFocusRef } : {})}
      saveDisabled={!trimmed}
      saveLabel="Anular retención"
      title="Anular retención"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-body">
          <span className="font-semibold text-ink">
            Valor retenido: <Money amount={withholding.amount} />
          </span>
          <FiscalScopeBadge scope={scope} />
        </div>
        <InlineNotice
          title="El saldo volverá a mostrar este valor"
          tone="warning"
        >
          Al anularla, la operación queda otra vez con ese importe pendiente de
          cobro.
        </InlineNotice>
        <Field id="withholding-void-reason" label="Motivo">
          <Textarea
            id="withholding-void-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </Field>
      </div>
    </FormModal>
  )
}
