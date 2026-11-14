/**
 * Términos con los que las pantallas de uso diario nombran los conceptos del dominio. Los
 * avisos legales o fiscales conservan su redacción y no pasan por aquí.
 */
export const TERMS = {
  /** Orden de mantenimiento. */
  maintenance: 'Mantenimiento',
  /** Comprobante interno de una operación (no es una factura electrónica autorizada). */
  receipt: 'Recibo',
  /** Importe exigible. */
  totalToPay: 'Total a pagar',
  /** Kardex de un producto. */
  movements: 'Movimientos',
} as const

export type Term = keyof typeof TERMS
