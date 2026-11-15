import { expect, it } from 'vitest'

import { sumMoney } from './money'

it('suma importes decimales sin errores de coma flotante', () => {
  expect(sumMoney('0.10', '0.20')).toBe('0.30')
  expect(sumMoney('1234.50', '0.5')).toBe('1235.00')
  expect(sumMoney('85', '1.05')).toBe('86.05')
})

it('ignora los valores ausentes y no inventa un importe', () => {
  expect(sumMoney('10.00', null, undefined, '')).toBe('10.00')
  expect(sumMoney(null)).toBe('0.00')
})

it('rechaza lo que no es un decimal exacto en lugar de redondearlo', () => {
  expect(sumMoney('10.00', '1.234')).toBeNull()
  expect(sumMoney('abc')).toBeNull()
})

it('admite saldos negativos', () => {
  expect(sumMoney('5.00', '-7.25')).toBe('-2.25')
})
