import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { clearRecentSearches } from './recent'

interface GlobalSearchContextValue {
  open: boolean
  initialQuery: string
  openSearch: (initialQuery?: string) => void
  closeSearch: () => void
}

const noop = () => {}

const GlobalSearchContext = createContext<GlobalSearchContextValue>({
  open: false,
  initialQuery: '',
  openSearch: noop,
  closeSearch: noop,
})

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function GlobalSearchProvider({
  username,
  authenticated,
  children,
}: {
  username: string | null
  authenticated: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [initialQuery, setInitialQuery] = useState('')
  const previousUser = useRef<string | null>(username)

  useEffect(() => {
    if (!authenticated || previousUser.current !== username) {
      clearRecentSearches()
      setOpen(false)
    }
    previousUser.current = username
  }, [authenticated, username])

  const openSearch = useCallback((query = '') => {
    setInitialQuery(query)
    setOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!authenticated) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch('')
        return
      }
      if (
        event.key === '/' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableElement(event.target)
      ) {
        event.preventDefault()
        openSearch('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [authenticated, openSearch])

  const value = useMemo(
    () => ({ open, initialQuery, openSearch, closeSearch }),
    [open, initialQuery, openSearch, closeSearch],
  )

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  )
}

export function useGlobalSearchModal() {
  return useContext(GlobalSearchContext)
}
