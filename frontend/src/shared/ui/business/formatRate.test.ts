import { expect, it } from 'vitest'

import { formatRate, trimRate } from './formatRate'

it('escribe las tarifas sin ceros sobrantes', () => {
  expect(formatRate('0.0000')).toBe('0 %')
  expect(formatRate('15.0000')).toBe('15 %')
  expect(formatRate('12.5000')).toBe('12.5 %')
  expect(formatRate(15)).toBe('15 %')
  expect(trimRate('100')).toBe('100')
})

it('no inventa una tarifa cuando falta o no es un decimal', () => {
  expect(formatRate(null)).toBeNull()
  expect(formatRate(undefined)).toBeNull()
  expect(formatRate('abc')).toBeNull()
})
