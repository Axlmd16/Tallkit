import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { saleKeys } from '@/features/sales/hooks'

import { proformasApi, type ReviewedCommand } from './api'
import type { ProformaFilters, ProformaInput } from './types'

export const proformaKeys = {
  root: ['proformas'] as const,
  list: (filters: ProformaFilters) => ['proformas', 'list', filters] as const,
  detail: (id: number | null) => ['proformas', 'detail', id] as const,
  document: (id: number | null) => ['proformas', 'document', id] as const,
  issuePreview: (id: number | null, version: number | null) =>
    ['proformas', 'issue-preview', id, version] as const,
  conversionPreview: (id: number | null, version: number | null) =>
    ['proformas', 'conversion-preview', id, version] as const,
  customers: (term: string, page: number) =>
    ['proformas', 'customers', term, page] as const,
  products: (term: string, page: number) =>
    ['proformas', 'products', term, page] as const,
}

/**
 * Tras una mutación propia se invalidan las ofertas. Una conversión crea además una venta:
 * también se invalidan las listas y fichas de ventas. Nunca se toca inventario, porque una
 * proforma no reserva ni mueve existencias.
 */
export async function invalidateAfterProformaMutation(
  queryClient: QueryClient,
  options: { conversion?: boolean } = {},
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: proformaKeys.root }),
    ...(options.conversion
      ? [queryClient.invalidateQueries({ queryKey: saleKeys.root })]
      : []),
  ])
}

const positive = (id: number | null) => typeof id === 'number' && id > 0

export function useProformas(filters: ProformaFilters = {}) {
  return useQuery({
    queryKey: proformaKeys.list(filters),
    queryFn: () => proformasApi.list(filters),
    refetchOnWindowFocus: true,
  })
}

export function useProforma(id: number | null) {
  return useQuery({
    queryKey: proformaKeys.detail(id),
    queryFn: () => proformasApi.get(id as number),
    enabled: positive(id),
    refetchOnWindowFocus: true,
  })
}

export function useProformaDocument(id: number | null) {
  return useQuery({
    queryKey: proformaKeys.document(id),
    queryFn: () => proformasApi.document(id as number),
    enabled: positive(id),
  })
}

/** Revisión previa a emitir: siempre se consulta de nuevo, nunca se reutiliza de caché. */
export function useIssuePreview(
  id: number | null,
  version: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: proformaKeys.issuePreview(id, version),
    queryFn: () => proformasApi.issuePreview(id as number),
    enabled: enabled && positive(id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}

export function useConversionPreview(
  id: number | null,
  version: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: proformaKeys.conversionPreview(id, version),
    queryFn: () => proformasApi.conversionPreview(id as number),
    enabled: enabled && positive(id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}

export function useProformaCustomerOptions(term: string, page: number) {
  return useQuery({
    queryKey: proformaKeys.customers(term, page),
    queryFn: () => proformasApi.customerOptions(term, page),
  })
}

export function useProformaProductOptions(term: string, page: number) {
  return useQuery({
    queryKey: proformaKeys.products(term, page),
    queryFn: () => proformasApi.productOptions(term, page),
  })
}

/**
 * Mutaciones idempotentes: nunca reintentan por sí solas (`retry: false`). Tras un resultado
 * incierto el llamador reenvía la misma solicitud con la misma clave de intento.
 */
export function useProformaMutations() {
  const queryClient = useQueryClient()
  const own = () => invalidateAfterProformaMutation(queryClient)
  const conversion = () =>
    invalidateAfterProformaMutation(queryClient, { conversion: true })
  return {
    create: useMutation({
      retry: false,
      onSuccess: own,
      mutationFn: (v: { data: ProformaInput; key: string }) =>
        proformasApi.create(v.data, v.key),
    }),
    update: useMutation({
      retry: false,
      onSuccess: own,
      mutationFn: (v: {
        id: number
        data: Partial<ProformaInput>
        expectedVersion: number
        key: string
      }) => proformasApi.update(v.id, v.data, v.expectedVersion, v.key),
    }),
    issue: useMutation({
      retry: false,
      onSuccess: own,
      mutationFn: (v: ReviewedCommand & { id: number; key: string }) =>
        proformasApi.issue(v.id, v, v.key),
    }),
    void: useMutation({
      retry: false,
      onSuccess: own,
      mutationFn: (v: { id: number; expectedVersion: number; key: string }) =>
        proformasApi.void(v.id, v.expectedVersion, v.key),
    }),
    copy: useMutation({
      retry: false,
      onSuccess: own,
      mutationFn: (v: { id: number; key: string }) =>
        proformasApi.copy(v.id, v.key),
    }),
    convert: useMutation({
      retry: false,
      onSuccess: conversion,
      mutationFn: (v: ReviewedCommand & { id: number; key: string }) =>
        proformasApi.convert(v.id, v, v.key),
    }),
  }
}
