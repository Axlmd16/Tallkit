import { useState } from 'react'

import { ProblemError } from './client'

/** Resultado desconocido: sin respuesta, agotamiento de tiempo o error del servidor. */
export function isUncertainFailure(error: unknown): boolean {
  if (error instanceof ProblemError) {
    return error.status === 0 || error.status === 408 || error.status >= 500
  }
  return true
}

/**
 * Asocia una clave de idempotencia a una intención de escritura. Tras un
 * resultado incierto conserva clave y payload para un reintento explícito; una
 * edición posterior o una respuesta definitiva usan una clave nueva. Nunca
 * reintenta por sí sola.
 */
export function createIntentTracker() {
  let current: { key: string; fingerprint: string } | null = null
  let uncertain = false

  function keyFor(payload: unknown): string {
    const fingerprint = JSON.stringify(payload)
    if (current && uncertain && current.fingerprint === fingerprint) {
      return current.key
    }
    current = { key: crypto.randomUUID(), fingerprint }
    uncertain = false
    return current.key
  }

  return {
    keyFor,
    hasUncertainAttempt: () => uncertain,
    async run<T>(
      payload: unknown,
      send: (key: string) => Promise<T>,
    ): Promise<T> {
      const key = keyFor(payload)
      try {
        const result = await send(key)
        current = null
        uncertain = false
        return result
      } catch (error) {
        uncertain = isUncertainFailure(error)
        throw error
      }
    },
  }
}

export type IntentTracker = ReturnType<typeof createIntentTracker>

export function useIntentTracker(): IntentTracker {
  return useState(createIntentTracker)[0]
}
