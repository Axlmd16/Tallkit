import type { Product } from './types'

/** Presentación legible: cantidad decimal tal como llega y unidad, sin recalcular. */
export function presentation(product: Product): string {
  const quantity = trimDecimal(product.content_quantity)
  const unit = product.unit?.name ?? ''
  return `${quantity} ${unit}`.trim()
}

/** Importe USD tal como lo entrega el servidor (dos decimales, texto). */
export function usd(amount: string): string {
  return `USD ${amount}`
}

/** Decimal del servidor sin ceros finales, solo para mostrar (`15.00` → `15`). */
export function trimDecimal(value: string): string {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/** Costo de inventario (hasta seis decimales) con al menos dos decimales visibles. */
export function inventoryAmount(value: string | undefined): string {
  if (!value) return '—'
  const [whole = '0', fraction = ''] = value.split('.')
  return `USD ${whole}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`
}
