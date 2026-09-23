import { useState, type RefObject } from 'react'

import { Field, Input, InlineNotice, Textarea } from '@/shared/ui'

import { salesApi } from './api'
import { useSaleMutations } from './hooks'
import { MoneyDialog } from './MoneyDialog'
import { getOrCreateIntent, intentKey } from './moneyIntent'
import type { Sale } from './types'

const WHOLE = /^\d+$/

/** Devolución de cliente (solo Administrador): cantidades aptas y no aptas por línea. */
export function ReturnDialog({
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
  const [quantities, setQuantities] = useState<
    Record<number, { fit: string; unfit: string }>
  >({})
  const key = intentKey(userScope, sale.id, 'return')
  const trimmed = reason.trim()
  const lines = sale.lines
    .map((line) => {
      const q = quantities[line.id] ?? { fit: '', unfit: '' }
      return {
        sale_line_id: line.id,
        fit_quantity: q.fit || '0',
        unfit_quantity: q.unfit || '0',
      }
    })
    .filter((l) => l.fit_quantity !== '0' || l.unfit_quantity !== '0')
  const numeric = lines.every(
    (l) => WHOLE.test(l.fit_quantity) && WHOLE.test(l.unfit_quantity),
  )
  const valid =
    trimmed.length > 0 && trimmed.length <= 500 && lines.length > 0 && numeric
  const body = () => ({
    operationId: getOrCreateIntent(key),
    reason: trimmed,
    lines,
  })

  function set(id: number, part: 'fit' | 'unfit', value: string) {
    setQuantities((prev) => ({
      ...prev,
      [id]: { fit: '', unfit: '', ...prev[id], [part]: value },
    }))
  }

  return (
    <MoneyDialog
      subject={`Venta ${sale.internal_number ?? `#${sale.id}`}`}
      description="Corrige el importe exigible con los valores históricos de la venta. Solo lo declarado apto para reventa regresa al inventario."
      formValid={valid}
      inputSignature={JSON.stringify([trimmed, lines])}
      intentKeys={[key]}
      onClose={onClose}
      onDone={onDone}
      open={open}
      preview={() => salesApi.returnPreview(sale.id, body())}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      submit={(reviewToken, idempotencyKey) =>
        mutations.registerReturn.mutateAsync({
          id: sale.id,
          ...body(),
          reviewToken,
          key: idempotencyKey,
        })
      }
      submitLabel="Registrar devolución"
      title="Registrar devolución"
      extraNotice={
        <InlineNotice title="Aptitud para reventa" tone="info">
          Clasifique cada cantidad devuelta. Las unidades no aptas reducen el
          exigible pero no aumentan la existencia.
        </InlineNotice>
      }
    >
      <div className="space-y-3" role="group" aria-label="Líneas a devolver">
        {sale.lines.map((line) => {
          const returned = Number(line.returned_quantity ?? 0)
          const remaining = Number(line.quantity) - returned
          const q = quantities[line.id] ?? { fit: '', unfit: '' }
          return (
            <div
              className="rounded-xl border border-line p-3"
              key={line.id}
              role="group"
              aria-label={`Línea ${line.position}`}
            >
              <p className="font-semibold text-ink">
                {line.product_code} · {line.product_name}
              </p>
              <p className="text-sm text-ink-muted">
                Vendidas {line.quantity} · ya devueltas {returned} · devolvibles{' '}
                {remaining}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field
                  id={`fit-${line.id}`}
                  label={`Aptas para reventa (línea ${line.position})`}
                >
                  <Input
                    id={`fit-${line.id}`}
                    inputMode="numeric"
                    onChange={(e) => set(line.id, 'fit', e.target.value)}
                    value={q.fit}
                  />
                </Field>
                <Field
                  id={`unfit-${line.id}`}
                  label={`No aptas (línea ${line.position})`}
                >
                  <Input
                    id={`unfit-${line.id}`}
                    inputMode="numeric"
                    onChange={(e) => set(line.id, 'unfit', e.target.value)}
                    value={q.unfit}
                  />
                </Field>
              </div>
            </div>
          )
        })}
      </div>
      <Field id="return-reason" label="Motivo de la devolución">
        <Textarea
          id="return-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </Field>
    </MoneyDialog>
  )
}
