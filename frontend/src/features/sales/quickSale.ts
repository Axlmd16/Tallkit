import { describeProblem } from '@/features/catalog-common/problem'

import type {
  MoneyReview,
  PartInput,
  PaymentMethod,
  Sale,
  SaleInput,
  SaleLineInput,
  SaleReview,
} from './types'

/** Formas de pago del mostrador: «Queda debiendo» es una venta a crédito, sin cobro. */
export type QuickPayMethod = PaymentMethod | 'CREDITO'

/** Pasos del servidor que encadena la venta rápida; se inyectan para poder probarlos. */
export interface QuickSaleSteps {
  create(data: SaleInput, key: string): Promise<Sale>
  preview(id: number): Promise<SaleReview>
  confirm(v: {
    id: number
    expectedVersion: number
    reviewToken: string
    key: string
  }): Promise<Sale>
  paymentPreview(
    id: number,
    data: { operationId: string; parts: PartInput[] },
  ): Promise<MoneyReview>
  registerPayment(v: {
    id: number
    operationId: string
    parts: PartInput[]
    reviewToken: string
    key: string
  }): Promise<unknown>
  /** UUID de la intención de cobro de la venta; se conserva hasta resolverse. */
  operationId(saleId: number): string
  /** Marca la intención de cobro como resuelta. */
  settled(saleId: number): void
  newKey(): string
}

export type QuickSaleResult =
  | { status: 'paid' | 'credit'; sale: Sale }
  /** Guardada como borrador: no se confirmó y no movió inventario ni dinero. */
  | { status: 'draft'; sale: Sale; message: string }
  /** Confirmada pero sin cobro: queda la deuda y el cobro se registra desde la venta. */
  | { status: 'unpaid'; sale: Sale; message: string }

const issuesText = (issues: readonly { message: string }[]) =>
  issues.map((issue) => issue.message).join(' ')

/**
 * Venta rápida de mostrador con los endpoints de siempre: crea el borrador, lo revisa y lo
 * confirma; al contado registra después el cobro del saldo que calcula el servidor. Si un paso
 * posterior a crear no se completa, la venta queda tal como quedó (borrador o confirmada sin
 * cobro) y se informa el motivo: nunca se deshace ni se reintenta en silencio.
 */
export async function runQuickSale(
  steps: QuickSaleSteps,
  input: {
    customerId: number
    lines: SaleLineInput[]
    method: QuickPayMethod
  },
): Promise<QuickSaleResult> {
  const credit = input.method === 'CREDITO'
  const draft = await steps.create(
    {
      customer_id: input.customerId,
      condition: credit ? 'CREDITO' : 'CONTADO',
      notes: '',
      lines: input.lines,
    },
    steps.newKey(),
  )

  let sale: Sale
  try {
    const review = await steps.preview(draft.id)
    if (!review.can_confirm || !review.review_token) {
      return {
        status: 'draft',
        sale: draft,
        message:
          issuesText(review.issues) ||
          'La venta no se puede confirmar todavía.',
      }
    }
    sale = await steps.confirm({
      id: draft.id,
      expectedVersion: draft.version,
      reviewToken: review.review_token,
      key: steps.newKey(),
    })
  } catch (error) {
    return {
      status: 'draft',
      sale: draft,
      message: describeProblem(error).message,
    }
  }

  if (credit) return { status: 'credit', sale }

  const balance = sale.money?.balance ?? null
  if (!balance || Number(balance) <= 0) return { status: 'paid', sale }

  const method = input.method as PaymentMethod
  const parts: PartInput[] = [{ method, amount: balance }]
  const operationId = steps.operationId(sale.id)
  try {
    const review = await steps.paymentPreview(sale.id, { operationId, parts })
    if (!review.review_token || review.issues.length > 0) {
      return {
        status: 'unpaid',
        sale,
        message:
          issuesText(review.issues) || 'El cobro no se puede registrar ahora.',
      }
    }
    await steps.registerPayment({
      id: sale.id,
      operationId,
      parts,
      reviewToken: review.review_token,
      key: steps.newKey(),
    })
  } catch (error) {
    return { status: 'unpaid', sale, message: describeProblem(error).message }
  }
  steps.settled(sale.id)
  return { status: 'paid', sale }
}
