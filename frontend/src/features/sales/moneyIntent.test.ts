import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearIntent,
  clearMoneyIntents,
  getOrCreateIntent,
  intentKey,
  peekIntent,
} from './moneyIntent'

beforeEach(() => {
  clearMoneyIntents()
  window.sessionStorage.clear()
})

describe('moneyIntent', () => {
  it('conserva el mismo UUID hasta que la intención se resuelve', () => {
    const key = intentKey(1, 7, 'payment')
    const first = getOrCreateIntent(key)
    expect(getOrCreateIntent(key)).toBe(first)
    expect(peekIntent(key)).toBe(first)
    clearIntent(key)
    expect(peekIntent(key)).toBeNull()
    expect(getOrCreateIntent(key)).not.toBe(first)
  })

  it('sobrevive a una recarga porque vive en sessionStorage', () => {
    const key = intentKey(1, 7, 'payment')
    const id = getOrCreateIntent(key)
    // «recarga»: la memoria del módulo se pierde, sessionStorage permanece
    expect(window.sessionStorage.getItem(key)).toBe(id)
  })

  it('está ligado a usuario, venta y acción', () => {
    const ids = new Set([
      getOrCreateIntent(intentKey(1, 7, 'payment')),
      getOrCreateIntent(intentKey(2, 7, 'payment')),
      getOrCreateIntent(intentKey(1, 8, 'payment')),
      getOrCreateIntent(intentKey(1, 7, 'refund')),
    ])
    expect(ids.size).toBe(4)
  })

  it('solo guarda el identificador opaco: ni importes, ni cliente, ni motivo, ni token', () => {
    getOrCreateIntent(intentKey(1, 7, 'payment'))
    const stored = Object.keys(window.sessionStorage).map((name) => [
      name,
      window.sessionStorage.getItem(name),
    ])
    expect(stored).toHaveLength(1)
    const [, value] = stored[0] as [string, string]
    expect(value).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('se limpia por completo al cerrar o invalidar la sesión', () => {
    getOrCreateIntent(intentKey(1, 7, 'payment'))
    getOrCreateIntent(intentKey(1, 7, 'void-refund'))
    window.sessionStorage.setItem('otra-clave', 'no-se-toca')
    clearMoneyIntents()
    expect(peekIntent(intentKey(1, 7, 'payment'))).toBeNull()
    expect(peekIntent(intentKey(1, 7, 'void-refund'))).toBeNull()
    expect(window.sessionStorage.getItem('otra-clave')).toBe('no-se-toca')
  })
})
