import { useCallback, useRef, useState } from 'react'

export interface LatestReview<T> {
  review: T | null
  pending: boolean
  error: unknown
  /** Solicita una revisión; una respuesta más antigua nunca reemplaza a una más reciente. */
  request: (fetcher: () => Promise<T>) => Promise<T | null>
  /** Descarta la revisión vigente (p. ej. tras editar) e ignora las respuestas en vuelo. */
  invalidate: () => void
}

/**
 * Conserva únicamente la revisión de la última solicitud. Si el usuario edita
 * mientras una revisión anterior sigue en vuelo, su respuesta llega tarde y se
 * descarta en lugar de presentarse como la revisión de la edición más reciente.
 */
export function useLatestReview<T>(): LatestReview<T> {
  const sequence = useRef(0)
  const [review, setReview] = useState<T | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const request = useCallback(async (fetcher: () => Promise<T>) => {
    const id = ++sequence.current
    setPending(true)
    setError(null)
    try {
      const result = await fetcher()
      if (id !== sequence.current) return null
      setReview(result)
      return result
    } catch (failure) {
      if (id === sequence.current) setError(failure)
      return null
    } finally {
      if (id === sequence.current) setPending(false)
    }
  }, [])

  const invalidate = useCallback(() => {
    sequence.current += 1
    setReview(null)
    setPending(false)
    setError(null)
  }, [])

  return { review, pending, error, request, invalidate }
}
