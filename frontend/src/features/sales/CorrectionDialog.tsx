import { useState, type RefObject } from 'react'

import { Field, InlineNotice, Textarea } from '@/shared/ui'

import { salesApi } from './api'
import { useSaleMutations } from './hooks'
import { MoneyDialog } from './MoneyDialog'
import { getOrCreateIntent, intentKey } from './moneyIntent'
import { PartsFields, partsValid, toParts } from './PartsFields'
import type { Sale, SalePaymentRow } from './types'

/** Corrección de un pago (solo Administrador): anula el original y puede sustituirlo. */
export function CorrectionDialog({
  sale,
  payment,
  userScope,
  open,
  onClose,
  onDone,
  returnFocusRef,
}: {
  sale: Sale
  payment: SalePaymentRow
  userScope: string
  open: boolean
  onClose: () => void
  onDone: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useSaleMutations()
  const [reason, setReason] = useState('')
  const [replace, setReplace] = useState(false)
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const correctionKey = intentKey(
    userScope,
    sale.id,
    'correction',
    String(payment.id),
  )
  const replacementKey = intentKey(
    userScope,
    sale.id,
    'replacement',
    String(payment.id),
  )
  const trimmed = reason.trim()
  const reasonError =
    reason && !trimmed ? 'El motivo es obligatorio.' : undefined
  const replacement = replace
    ? {
        operationId: getOrCreateIntent(replacementKey),
        parts: toParts(cash, transfer),
      }
    : null
  const valid =
    trimmed.length > 0 &&
    trimmed.length <= 500 &&
    (!replace || partsValid(cash, transfer))
  const body = () => ({
    operationId: getOrCreateIntent(correctionKey),
    reason: trimmed,
    replacement,
  })
  return (
    <MoneyDialog
      subject={`Venta ${sale.internal_number ?? `#${sale.id}`}`}
      description="La corrección conserva el pago original y su auditoría; no representa dinero reembolsado."
      formValid={valid}
      inputSignature={JSON.stringify([trimmed, replace, cash, transfer])}
      intentKeys={replace ? [correctionKey, replacementKey] : [correctionKey]}
      onClose={onClose}
      onDone={onDone}
      open={open}
      preview={() => salesApi.correctionPreview(sale.id, payment.id, body())}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      submit={(reviewToken, key) =>
        mutations.correctPayment.mutateAsync({
          id: sale.id,
          paymentId: payment.id,
          ...body(),
          reviewToken,
          key,
        })
      }
      cancelLabel="Conservar pago"
      submitLabel="Corregir pago"
      submitTone="danger"
      title="Corregir pago"
      extraNotice={
        <InlineNotice title={`Pago de USD ${payment.amount}`} tone="info">
          Si ya existe un reembolso efectivo que depende de este pago, la
          corrección se rechaza para no dejar sin respaldo el dinero ya
          devuelto.
        </InlineNotice>
      }
    >
      <Field
        error={reasonError}
        id="correction-reason"
        label="Motivo de la corrección"
      >
        <Textarea
          id="correction-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </Field>
      <label className="flex items-center gap-2 text-body text-ink">
        <input
          checked={replace}
          onChange={(event) => setReplace(event.target.checked)}
          type="checkbox"
        />
        Sustituir por un pago corregido
      </label>
      {replace && (
        <PartsFields
          cash={cash}
          idPrefix="replacement"
          onChange={(next) => {
            setCash(next.cash)
            setTransfer(next.transfer)
          }}
          transfer={transfer}
        />
      )}
    </MoneyDialog>
  )
}
