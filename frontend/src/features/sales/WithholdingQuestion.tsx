import { Field, InlineNotice, Input } from '@/shared/ui'

import { partsTotal, validAmount } from './PartsFields'
import type { WithholdingContext, WithholdingInput } from './types'

const toCents = (amount: string | null | undefined): number => {
  const [whole = '0', frac = ''] = String(amount ?? '0').split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))
}

const fromCents = (cents: number): string =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`

/** Lo que falta para cubrir el saldo con el dinero escrito; solo ayuda de interfaz. */
export function remainingAfter(
  balance: string | null | undefined,
  cash: string,
  transfer: string,
): string {
  const money =
    (!cash || validAmount(cash)) && (!transfer || validAmount(transfer))
      ? toCents(partsTotal(cash, transfer))
      : 0
  return fromCents(Math.max(toCents(balance) - money, 0))
}

export interface WithholdingState {
  active: boolean
  amount: string
  acknowledged: boolean
}

export const emptyWithholding: WithholdingState = {
  active: false,
  amount: '',
  acknowledged: false,
}

/** Cuerpo de la retención para la API, o nada si la persona no la marcó. */
export function toWithholding(
  state: WithholdingState,
): WithholdingInput | null {
  if (!state.active || !validAmount(state.amount)) return null
  return {
    amount: state.amount.trim(),
    ...(state.acknowledged ? { acknowledged: true } : {}),
  }
}

/** El cobro es válido con dinero, con retención o con ambos. */
export function settlementValid(
  cash: string,
  transfer: string,
  state: WithholdingState,
): boolean {
  const money = [cash, transfer].filter((text) => text.trim())
  if (!money.every(validAmount)) return false
  if (state.active) return validAmount(state.amount)
  return money.length > 0
}

/**
 * Pregunta en lenguaje llano si el cliente retuvo la diferencia. No pide datos del
 * comprobante: eso se completa después, fuera del cobro. La interfaz solo propone el
 * importe; el servidor decide saldos y límites.
 */
export function WithholdingQuestion({
  idPrefix,
  context,
  balance,
  cash,
  transfer,
  value,
  onChange,
  warning,
}: {
  idPrefix: string
  context: WithholdingContext | undefined
  balance: string | null | undefined
  cash: string
  transfer: string
  value: WithholdingState
  onChange: (next: WithholdingState) => void
  /** Presente cuando el servidor pidió confirmar un importe inusual. */
  warning?: { percentage: string } | null | undefined
}) {
  if (!context?.enabled) return null
  const remaining = remainingAfter(balance, cash, transfer)
  const hasMoney = Boolean(cash.trim() || transfer.trim())
  const offer =
    value.active ||
    context.customer_is_agent ||
    (hasMoney && toCents(remaining) > 0)
  if (!offer) return null
  const amountError =
    value.active && value.amount && !validAmount(value.amount)
      ? 'Use un importe positivo con hasta 2 decimales.'
      : undefined
  return (
    <fieldset
      className="space-y-3 rounded-control border border-warning/30 bg-warning-soft/40 px-3 py-3"
      data-testid={`${idPrefix}-withholding`}
    >
      <legend className="px-1 text-body font-semibold text-ink">
        ¿El cliente retuvo parte del pago?
      </legend>
      {context.customer_is_agent && (
        <p className="text-label text-ink-muted">
          Este cliente está marcado como agente de retención: suele pagar un
          poco menos y entregar el resto al SRI.
        </p>
      )}
      <label className="flex items-start gap-2 text-body text-ink">
        <input
          checked={value.active}
          className="mt-1"
          onChange={(event) =>
            onChange({
              active: event.target.checked,
              amount: event.target.checked
                ? toCents(remaining) > 0
                  ? remaining
                  : value.amount
                : '',
              acknowledged: false,
            })
          }
          type="checkbox"
        />
        <span>
          Sí, el cliente retuvo
          {toCents(remaining) > 0 && !value.active
            ? ` los USD ${remaining} que faltan`
            : ' una parte'}
          . Ese valor baja la deuda, pero no cuenta como dinero recibido.
        </span>
      </label>
      {value.active && (
        <Field
          error={amountError}
          id={`${idPrefix}-withheld`}
          label="Valor retenido (USD)"
        >
          <Input
            id={`${idPrefix}-withheld`}
            inputMode="decimal"
            onChange={(event) =>
              onChange({
                ...value,
                amount: event.target.value,
                acknowledged: false,
              })
            }
            value={value.amount}
          />
        </Field>
      )}
      {value.active && warning && (
        <InlineNotice title="Revise el valor retenido" tone="warning">
          <p>
            Es mayor que el {warning.percentage} % del total, algo poco
            frecuente. Confirme solo si es correcto.
          </p>
          <label className="mt-2 flex items-center gap-2 text-body text-ink">
            <input
              checked={value.acknowledged}
              onChange={(event) =>
                onChange({ ...value, acknowledged: event.target.checked })
              }
              type="checkbox"
            />
            Confirmo que el valor retenido es correcto
          </label>
        </InlineNotice>
      )}
    </fieldset>
  )
}
