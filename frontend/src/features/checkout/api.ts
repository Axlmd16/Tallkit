import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type {
  CheckoutExecuteInput,
  CheckoutExecuteResponse,
  CheckoutPreview,
} from './types'

const BASE = '/checkout'

export function createCheckoutApi(client: ApiClient) {
  return {
    previewMaintenance(orderId: number): Promise<CheckoutPreview> {
      return client.request(`${BASE}/maintenance/${orderId}/`)
    },
    previewSale(saleId: number): Promise<CheckoutPreview> {
      return client.request(`${BASE}/sales/${saleId}/`)
    },
    execute(
      input: CheckoutExecuteInput,
      idempotencyKey: string,
    ): Promise<CheckoutExecuteResponse> {
      return client.request(`${BASE}/execute/`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(input),
      })
    },
  }
}

export const checkoutApi = createCheckoutApi(
  new ApiClient(environment.apiBaseUrl),
)
