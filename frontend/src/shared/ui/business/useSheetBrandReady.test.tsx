import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useSheetBrandReady } from './useSheetBrandReady'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('queda listo cuando la hoja avisa que su encabezado terminó', () => {
  const { result } = renderHook(() => useSheetBrandReady())
  expect(result.current.ready).toBe(false)
  act(() => result.current.onBrandReady(true))
  expect(result.current.ready).toBe(true)
})

it('habilita la impresión tras el tiempo máximo aunque el logotipo no responda', () => {
  const { result } = renderHook(() => useSheetBrandReady(5000))
  act(() => vi.advanceTimersByTime(4999))
  expect(result.current.ready).toBe(false)
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.ready).toBe(true)
})

it('conserva la misma función de aviso entre renderizados', () => {
  const { result, rerender } = renderHook(() => useSheetBrandReady())
  const first = result.current.onBrandReady
  rerender()
  expect(result.current.onBrandReady).toBe(first)
})
