import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type { GlobalSearchResponse } from './types'

export function createSearchApi(client: ApiClient) {
  return {
    search(query: string, signal?: AbortSignal): Promise<GlobalSearchResponse> {
      const encoded = encodeURIComponent(query)
      return client.request(
        `/home/search/?q=${encoded}`,
        signal ? { signal } : {},
      )
    },
  }
}

export const searchApi = createSearchApi(new ApiClient(environment.apiBaseUrl))
