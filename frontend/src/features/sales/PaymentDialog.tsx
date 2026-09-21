import { useState, type RefObject } from 'react'

import { InlineNotice } from '@/shared/ui'

import { salesApi } from './api'
import { useSaleMutations } from './hooks'
import { MoneyDialog } from './MoneyDialog'
import { intentKey, getOrCreateIntent } from './moneyIntent'
import { PartsFields, partsValid, toParts } from './PartsFields'
import { usd } from './format'
import type { Sale } from './types'

/** Cobro contextual de una venta: medios combinados validados contra el saldo del servidor. */
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
  const key = intentKey(userScope, sale.id, 'payment')
  const parts = toParts(cash, transfer)
  return (
    <MoneyDialog
      description="Registra un cobro ya recibido. El registro en el sistema no entrega ni recibe dinero."
      formValid={partsValid(cash, transfer)}
      inputSignature={JSON.stringify(parts)}
      intentKeys={[key]}
      onClose={onClose}
      onDone={onDone}
      open={open}
      preview={() =>
        salesApi.paymentPreview(sale.id, {
          operationId: getOrCreateIntent(key),
          parts,
        })
      }
      {...(returnFocusRef ? { returnFocusRef } : {})}
      submit={(reviewToken, idempotencyKey) =>
        mutations.registerPayment.mutateAsync({
          id: sale.id,
          operationId: getOrCreateIntent(key),
          parts,
          reviewToken,
          key: idempotencyKey,
        })
      }
      submitLabel="Registrar cobro"
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
    </MoneyDialog>
  )
}
