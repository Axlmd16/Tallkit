import { useCallback, useEffect, useState } from 'react'

/**
 * Disponibilidad del encabezado de la hoja para imprimir: se cumple cuando `DocumentSheet`
 * avisa que el logotipo cargó, falló o no existe, o al agotar el tiempo máximo, de modo que
 * la impresión nunca queda bloqueada ni sale con una imagen incompleta.
 */
export function useSheetBrandReady(timeoutMs = 5000) {
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimedOut(true)
      setReady(true)
    }, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [timeoutMs])

  const onBrandReady = useCallback((value: boolean) => {
    if (value) {
      setTimedOut(false)
      setReady(true)
    }
  }, [])

  return { ready, timedOut, onBrandReady }
}
