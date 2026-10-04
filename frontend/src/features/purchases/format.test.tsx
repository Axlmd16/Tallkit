import { expect, it } from 'vitest'

import { count, documentDate, timestamp, unitCost } from './format'

it('el costo unitario conserva sus decimales reales sin redondear', () => {
  expect(unitCost('4.500000')).toBe('USD 4.50')
  expect(unitCost('0.335000')).toBe('USD 0.335')
  expect(unitCost('4.123456')).toBe('USD 4.123456')
  expect(unitCost('0.000000')).toBe('USD 0.00')
  expect(unitCost('12')).toBe('USD 12.00')
})

it('un costo ausente o inválido no se presenta como cero', () => {
  expect(unitCost(null)).toBe('—')
  expect(unitCost(undefined)).toBe('—')
  expect(unitCost('abc')).toBe('—')
})

it('cuenta con singular y plural', () => {
  expect(count(1, 'producto', 'productos')).toBe('1 producto')
  expect(count('3', 'producto', 'productos')).toBe('3 productos')
  expect(count(0, 'unidad', 'unidades')).toBe('0 unidades')
})

it('formatea fechas y marcas de tiempo, y tolera lo ausente', () => {
  expect(documentDate('2026-01-15')).toBe('15/01/2026')
  expect(documentDate('texto')).toBe('texto')
  expect(timestamp(null)).toBe('—')
  expect(timestamp('2026-10-04T15:30:00Z')).toMatch(/2026/)
})

it('los importes ajenos se anteponen con la moneda sin recalcularse', async () => {
  const { usd } = await import('./format')
  expect(usd('22.00')).toBe('USD 22.00')
  expect(usd(null)).toBe('—')
  expect(usd(undefined)).toBe('—')
})
