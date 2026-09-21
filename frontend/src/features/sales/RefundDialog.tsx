import { useState, type RefObject } from 'react'

import { Field, InlineNotice, Textarea } from '@/shared/ui'

import { salesApi } from './api'
import { usd } from './format'
import { useSaleMutations } from './hooks'
import { MoneyDialog } from './MoneyDialog'
import { getOrCreateIntent, intentKey } from './moneyIntent'
import { PartsFields, partsValid, toParts } from './PartsFields'
import type { Sale, SaleReturnRow } from './types'

/** Registro de un desembolso ya realizado por el exceso pagado de una devolución. */
export function RefundDialog({
  sale,
  saleReturn,
  userScope,
  open,
  onClose,
  onDone,
  returnFocusRef,
}: {
  sale: Sale
  saleReturn: SaleReturnRow
  userScope: string
  open: boolean
  onClose: () => void
  onDone: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useSaleMutations()
  const [reason, setReason] = useState('')
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const key = intentKey(userScope, sale.id, 'refund', String(saleReturn.id))
  const trimmed = reason.trim()
  const parts = toParts(cash, transfer)
  const valid =
    trimmed.length > 0 && trimmed.length <= 500 && partsValid(cash, transfer)
  const body = () => ({
    operationId: getOrCreateIntent(key),
    saleReturnId: saleReturn.id,
    reason: trimmed,
    parts,
  })
  return (
    <MoneyDialog
      description="Registra el dinero que ya entregó al cliente. El sistema no realiza la transferencia ni entrega el efectivo."
      formValid={valid}
      inputSignature={JSON.stringify([trimmed, parts])}
      intentKeys={[key]}
      onClose={onClose}
      onDone={onDone}
      open={open}
      preview={() => salesApi.refundPreview(sale.id, body())}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      submit={(reviewToken, idempotencyKey) =>
        mutations.registerRefund.mutateAsync({
          id: sale.id,
          ...body(),
          reviewToken,
          key: idempotencyKey,
        })
      }
      submitLabel="Registrar reembolso"
      title="Registrar reembolso"
      extraNotice={
        <InlineNotice
          title={`Exceso pendiente de reembolso: ${usd(sale.money.refund_due)}`}
          tone="info"
        >
          Registrar el hecho en el sistema es distinto de entregar el dinero. El
          importe no puede superar el exceso vigente ni lo atribuible a la
          devolución seleccionada (USD {saleReturn.grand_total}).
        </InlineNotice>
      }
    >
      <PartsFields
        cash={cash}
        idPrefix="refund"
        onChange={(next) => {
          setCash(next.cash)
          setTransfer(next.transfer)
        }}
        transfer={transfer}
      />
      <Field id="refund-reason" label="Motivo del reembolso">
        <Textarea
          id="refund-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </Field>
    </MoneyDialog>
  )
}
