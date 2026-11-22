export interface RecentSearchEntry {
  key: string
  kind: 'vehicle' | 'customer' | 'invoice' | 'product'
  title: string
  subtitle: string
  badge?: string
  to: string
}

const KEY_PREFIX = 'tallkit.recent_search.'
const MAX_ITEMS = 5

function storageKey(username: string): string {
  return `${KEY_PREFIX}${username}`
}

export function loadRecentSearches(
  username: string | null,
): RecentSearchEntry[] {
  if (!username) return []
  try {
    const raw = window.sessionStorage.getItem(storageKey(username))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecentSearchEntry[]) : []
  } catch {
    return []
  }
}

export function recordRecentSearch(
  username: string | null,
  entry: RecentSearchEntry,
): RecentSearchEntry[] {
  if (!username) return []
  const current = loadRecentSearches(username)
  const next = [
    entry,
    ...current.filter((item) => item.key !== entry.key),
  ].slice(0, MAX_ITEMS)
  try {
    window.sessionStorage.setItem(storageKey(username), JSON.stringify(next))
  } catch {
    // sessionStorage puede estar deshabilitado en modo privado estricto
  }
  return next
}

/** Limpia los recientes de todos los usuarios en esta pestaña (al cerrar o cambiar sesión). */
export function clearRecentSearches(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i)
      if (key && key.startsWith(KEY_PREFIX)) toRemove.push(key)
    }
    for (const key of toRemove) window.sessionStorage.removeItem(key)
  } catch {
    // Ignorar errores de almacenamiento
  }
}
