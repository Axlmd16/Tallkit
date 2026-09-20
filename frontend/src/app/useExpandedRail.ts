import { useSyncExternalStore } from 'react'

/** Coincide con el punto de quiebre `xl` en que el rail pasa a sidebar expandido. */
const expandedQuery = '(min-width: 1280px)'

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const media = window.matchMedia(expandedQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSnapshot() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(expandedQuery).matches
    : true
}

export function useExpandedRail() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
