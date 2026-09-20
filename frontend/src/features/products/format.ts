import type { Product } from './types'

/** Presentación legible: cantidad decimal tal como llega y unidad, sin recalcular. */
export function presentation(product: Product): string {
  const quantity = product.content_quantity
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
  const unit = product.unit?.name ?? ''
  return `${quantity} ${unit}`.trim()
}

/** Importe USD tal como lo entrega el servidor (dos decimales, texto). */
export function usd(amount: string): string {
  return `USD ${amount}`
}
