import { expect } from 'vitest'

/** Expresiones que una preparación local nunca debe usar para describirse. */
export const FORBIDDEN_FISCAL_TERMS = [
  /factura emitida/i,
  /factura autorizada/i,
  /\bautorizad[oa]\b/i,
  /enviad[oa] al SRI/i,
  /comprobante enviado/i,
  /aprobad[oa] por el SRI/i,
  /\baprobad[oa]\b/i,
]

/** Falla si el contenedor presenta la preparación como factura emitida o autorizada. */
export function expectNoForbiddenFiscalTerms(container: HTMLElement) {
  const content = (container.textContent ?? '').replace(
    /No ha sido firmada ni enviada al SRI\.?/g,
    '',
  )
  for (const pattern of FORBIDDEN_FISCAL_TERMS) {
    expect(content, `término prohibido ${pattern}`).not.toMatch(pattern)
  }
}
