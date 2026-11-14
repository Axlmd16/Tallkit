import { useState, type RefObject } from 'react'

import { InlineNotice } from '@/shared/ui'

import { salesApi } from './api'
import { useSaleMutations } from './hooks'
import { MoneyDialog } from './MoneyDialog'
import { intentKey, getOrCreateIntent } from './moneyIntent'
import { PartsFields, toParts } from './PartsFields'
import { usd } from './format'
import type { MoneyReview, Sale } from './types'
import {
  emptyWithholding,
  settlementValid,
  toWithholding,
  WithholdingQuestion,
} from './WithholdingQuestion'

/**
 * Cobro contextual de una venta: se escribe el dinero recibido y, si falta una parte
 * porque el cliente la retuvo, se confirma en lenguaje llano. Todo se valida contra el
 * saldo del servidor.
 */
export function PaymentDialog({
  sale,
  userScope,
  open,
  onClose,
  onDone,
  returnFocusRef,
}: {
  sale: Sale
  userScope: string
  open: boolean
  onClose: () => void
  onDone: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useSaleMutations()
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const [withheld, setWithheld] = useState(emptyWithholding)
  const [warning, setWarning] = useState<MoneyReview['warning']>(null)
  const key = intentKey(userScope, sale.id, 'payment')
  const parts = toParts(cash, transfer)
  const withholding = toWithholding(withheld)
  return (
    <MoneyDialog
      subject={`Venta ${sale.internal_number ?? `#${sale.id}`}`}
      description="Registra un cobro ya recibido. El registro en el sistema no entrega ni recibe dinero."
      formValid={settlementValid(cash, transfer, withheld)}
      inputSignature={JSON.stringify([parts, withholding])}
      intentKeys={[key]}
      onClose={onClose}
      onDone={onDone}
      open={open}
      preview={async () => {
        const review = await salesApi.paymentPreview(sale.id, {
          operationId: getOrCreateIntent(key),
          parts,
          withholding,
        })
        setWarning(review.warning ?? null)
        return review
      }}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      submit={(reviewToken, idempotencyKey) =>
        mutations.registerPayment.mutateAsync({
          id: sale.id,
          operationId: getOrCreateIntent(key),
          parts,
          withholding,
          reviewToken,
          key: idempotencyKey,
        })
      }
      submitLabel={
        parts.length === 0 && withholding !== null
          ? 'Registrar retención'
          : 'Registrar cobro'
      }
      title="Registrar cobro"
      extraNotice={
        <InlineNotice
          title={`Saldo pendiente: ${usd(sale.money.balance)}`}
          tone="info"
        >
          {sale.condition === 'CONTADO'
            ? 'Una venta de contado exige cubrir el saldo completo en un solo cobro.'
            : 'Una venta a crédito admite abonos hasta el saldo, sin vencimiento ni cuotas.'}{' '}
          El importe de un cobro se aplica solo a esta venta.
        </InlineNotice>
      }
    >
      <PartsFields
        cash={cash}
        idPrefix="payment"
        onChange={(next) => {
          setCash(next.cash)
          setTransfer(next.transfer)
        }}
        transfer={transfer}
      />
      <WithholdingQuestion
        balance={sale.money.balance}
        cash={cash}
        context={sale.withholding_context}
        idPrefix="payment"
        onChange={setWithheld}
        transfer={transfer}
        value={withheld}
        warning={warning}
      />
    </MoneyDialog>
  )
}
