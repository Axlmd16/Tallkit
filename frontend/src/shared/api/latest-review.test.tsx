import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLatestReview } from './latest-review'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('useLatestReview', () => {
  it('una respuesta antigua no reemplaza la revisión de una edición más reciente', async () => {
    const { result } = renderHook(() => useLatestReview<string>())
    const first = deferred<string>()
    const second = deferred<string>()
    let p1!: Promise<string | null>
    let p2!: Promise<string | null>
    act(() => {
      p1 = result.current.request(() => first.promise)
      p2 = result.current.request(() => second.promise)
    })
    await act(async () => {
      second.resolve('revisión nueva')
      await p2
    })
    expect(result.current.review).toBe('revisión nueva')
    await act(async () => {
      first.resolve('revisión antigua')
      expect(await p1).toBeNull()
    })
    expect(result.current.review).toBe('revisión nueva')
    expect(result.current.pending).toBe(false)
  })

  it('invalidar descarta la revisión vigente y las solicitudes en vuelo', async () => {
    const { result } = renderHook(() => useLatestReview<string>())
    const inflight = deferred<string>()
    let request!: Promise<string | null>
    act(() => {
      request = result.current.request(() => inflight.promise)
    })
    act(() => result.current.invalidate())
    await act(async () => {
      inflight.resolve('tarde')
      await request
    })
    expect(result.current.review).toBeNull()
  })

  it('conserva el error de la última solicitud', async () => {
    const { result } = renderHook(() => useLatestReview<string>())
    await act(async () => {
      await result.current.request(() => Promise.reject(new Error('falla')))
    })
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.review).toBeNull()
  })
})
