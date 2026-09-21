import { useState, type RefObject } from 'react'

import { Field, InlineNotice, Textarea } from '@/shared/ui'

import { salesApi } from './api'
import { usd } from './format'
import { useSaleMutations } from './hooks'
import { MoneyDialog } from './MoneyDialog'
import { getOrCreateIntent, intentKey } from './moneyIntent'
import { PartsFields, partsValid, toParts } from './PartsFields'
import type { Sale } from './types'

/**
 * Anulación conservadora (solo Administrador). Con dinero aplicado exige capturar el
 * desembolso ya realizado; si el registro falla se reintenta el mismo hecho, nunca se pide
 * entregar el dinero otra vez.
 */
export function VoidSaleDialog({
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
  const [reason, setReason] = useState('')
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const key = intentKey(userScope, sale.id, 'void-refund')
  const trimmed = reason.trim()
  const applied = Number(sale.money.applied ?? 0)
  const withMoney = applied > 0
  const parts = toParts(cash, transfer)
  const valid =
    trimmed.length > 0 &&
    trimmed.length <= 500 &&
    (!withMoney || partsValid(cash, transfer))
  const body = () => ({
    reason: trimmed,
    refund: withMoney ? { operationId: getOrCreateIntent(key), parts } : null,
  })
  return (
    <MoneyDialog
      description="Anular conserva la venta con su número, revierte exactamente las salidas de inventario y deja el exigible en cero."
      formValid={valid}
      inputSignature={JSON.stringify([trimmed, parts])}
      intentKeys={withMoney ? [key] : []}
      onClose={onClose}
      onDone={onDone}
      open={open}
      preview={() => salesApi.voidPreview(sale.id, body())}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      submit={(reviewToken, idempotencyKey) =>
        mutations.void.mutateAsync({
          id: sale.id,
          ...body(),
          expectedVersion: sale.version,
          reviewToken,
          key: idempotencyKey,
        })
      }
      submitLabel="Anular venta"
      submitTone="danger"
      title="Anular venta"
      extraNotice={
        <InlineNotice title="Consecuencias de anular" tone="warning">
          <ul className="list-disc pl-5">
            <li>
              No se puede anular si hay devoluciones o movimientos posteriores
              del producto.
            </li>
            <li>
              {withMoney
                ? `La venta tiene ${usd(sale.money.applied)} aplicados: registre el desembolso ya entregado al cliente. Si el registro falla, reintente el mismo registro; no entregue el dinero otra vez.`
                : 'La venta no tiene dinero recibido por devolver.'}
            </li>
          </ul>
        </InlineNotice>
      }
    >
      <Field id="void-reason" label="Motivo de la anulación">
        <Textarea
          id="void-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </Field>
      {withMoney && (
        <PartsFields
          cash={cash}
          idPrefix="void-refund"
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
