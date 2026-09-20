import { useEffect, useRef, type RefObject } from 'react'

/**
 * Recuerda el control que tenía el foco cuando se abre un panel para que el
 * panel lo recupere al cerrarse. Debe leerse antes de que el panel mueva el foco.
 */
export function useReturnFocus(open: boolean): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    const active = document.activeElement
    ref.current =
      active instanceof HTMLElement && active !== document.body ? active : null
  }, [open])
  return ref
}
