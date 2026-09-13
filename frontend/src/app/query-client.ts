import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { sessionQueryKey } from '@/features/auth/hooks'
import { ProblemError } from '@/shared/api/client'

function isAuthorizationError(error: unknown) {
  return error instanceof ProblemError && [401, 403].includes(error.status)
}

export function createAppQueryClient() {
  const refreshSession = (error: unknown) => {
    if (isAuthorizationError(error)) {
      // Ask the backend whether this is a revoked session or a denied action.
      void client.invalidateQueries({ queryKey: sessionQueryKey })
    }
  }
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== sessionQueryKey[0]) refreshSession(error)
      },
    }),
    mutationCache: new MutationCache({ onError: refreshSession }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: (count, error) => !isAuthorizationError(error) && count < 3,
      },
    },
  })
  return client
}
