import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { checkoutApi } from './api'
import type { CheckoutExecuteInput } from './types'

export const checkoutKeys = {
  maintenance: (orderId: number) =>
    ['checkout', 'maintenance', orderId] as const,
  sale: (saleId: number) => ['checkout', 'sale', saleId] as const,
}

export function useMaintenanceCheckoutPreview(
  orderId: number,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && Number.isFinite(orderId) && orderId > 0,
    gcTime: 0,
    staleTime: 0,
    queryKey: checkoutKeys.maintenance(orderId),
    queryFn: () => checkoutApi.previewMaintenance(orderId),
  })
}

export function useSaleCheckoutPreview(saleId: number, enabled = true) {
  return useQuery({
    enabled: enabled && Number.isFinite(saleId) && saleId > 0,
    gcTime: 0,
    staleTime: 0,
    queryKey: checkoutKeys.sale(saleId),
    queryFn: () => checkoutApi.previewSale(saleId),
  })
}

export function useExecuteCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CheckoutExecuteInput
      idempotencyKey: string
    }) => checkoutApi.execute(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['home'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['fiscal'] })
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
