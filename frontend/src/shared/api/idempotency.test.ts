import { describe, expect, it } from 'vitest'

import { ProblemError } from './client'
import { createIntentTracker, isUncertainFailure } from './idempotency'

const network = new ProblemError('sin red', 0, 'network_error')
const rejected = new ProblemError('inválido', 400, 'validation_error')

describe('isUncertainFailure', () => {
  it('trata la falta de respuesta y los 5xx como resultado incierto', () => {
    expect(isUncertainFailure(network)).toBe(true)
    expect(isUncertainFailure(new ProblemError('x', 503, 'x'))).toBe(true)
    expect(isUncertainFailure(new Error('desconocido'))).toBe(true)
  })

  it('trata una respuesta definitiva como resuelta', () => {
    expect(isUncertainFailure(rejected)).toBe(false)
    expect(isUncertainFailure(new ProblemError('x', 409, 'stale_record'))).toBe(
      false,
    )
  })
})

describe('createIntentTracker', () => {
  it('genera claves ASCII válidas para el backend', () => {
    const key = createIntentTracker().keyFor({ a: 1 })
    expect(key).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  })

  it('conserva la clave tras un resultado incierto con el mismo payload', async () => {
    const tracker = createIntentTracker()
    const seen: string[] = []
    const failing = (key: string) => {
      seen.push(key)
      return Promise.reject(network)
    }
    await expect(tracker.run({ name: 'A' }, failing)).rejects.toBe(network)
    expect(tracker.hasUncertainAttempt()).toBe(true)
    await expect(tracker.run({ name: 'A' }, failing)).rejects.toBe(network)
    expect(seen[1]).toBe(seen[0])
  })

  it('usa una clave nueva si el payload cambia o si hubo respuesta definitiva', async () => {
    const tracker = createIntentTracker()
    const seen: string[] = []
    const fail = (error: Error) => (key: string) => {
      seen.push(key)
      return Promise.reject(error)
    }
    await expect(tracker.run({ name: 'A' }, fail(network))).rejects.toBe(
      network,
    )
    await expect(tracker.run({ name: 'B' }, fail(rejected))).rejects.toBe(
      rejected,
    )
    expect(tracker.hasUncertainAttempt()).toBe(false)
    await expect(tracker.run({ name: 'B' }, fail(rejected))).rejects.toBe(
      rejected,
    )
    expect(new Set(seen).size).toBe(3)
  })

  it('libera la intención tras el éxito y no reintenta automáticamente', async () => {
    const tracker = createIntentTracker()
    let calls = 0
    const ok = () => {
      calls += 1
      return Promise.resolve('listo')
    }
    await expect(tracker.run({ x: 1 }, ok)).resolves.toBe('listo')
    expect(calls).toBe(1)
    expect(tracker.hasUncertainAttempt()).toBe(false)
    const first = tracker.keyFor({ x: 1 })
    expect(tracker.keyFor({ x: 1 })).not.toBe(first)
  })
})
