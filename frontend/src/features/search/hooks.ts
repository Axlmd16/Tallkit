import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { searchApi } from './api'

const DEBOUNCE_MS = 220

export function useDebouncedValue(
  value: string,
  delayMs = DEBOUNCE_MS,
): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function useGlobalSearch(rawQuery: string, enabled: boolean) {
  const debounced = useDebouncedValue(rawQuery.trim())
  const active = enabled && debounced.length >= 2

  return useQuery({
    queryKey: ['home', 'search', debounced],
    queryFn: ({ signal }) => searchApi.search(debounced, signal),
    enabled: active,
    staleTime: 15_000,
    retry: false,
  })
}
