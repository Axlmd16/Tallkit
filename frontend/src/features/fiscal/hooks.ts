import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fiscalApi } from './api'
import type { DraftUpdate, FiscalSourceKind } from './types'

export const fiscalKeys = {
  all: ['fiscal'] as const,
  origin: (kind: FiscalSourceKind, id: number) =>
    [...fiscalKeys.all, 'origin', kind, id] as const,
  preparation: (id: string) => [...fiscalKeys.all, 'preparation', id] as const,
  archive: (entityId?: number) =>
    [...fiscalKeys.all, 'archive', entityId ?? 'all'] as const,
  profile: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'profile', entityId] as const,
  establishments: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'establishments', entityId] as const,
}

export function useArchive(entityId?: number) {
  return useQuery({
    queryKey: fiscalKeys.archive(entityId),
    queryFn: () => fiscalApi.listArchive(entityId),
  })
}

export function usePreparation(preparationId: string | undefined) {
  return useQuery({
    queryKey: fiscalKeys.preparation(preparationId ?? 'missing'),
    queryFn: () => fiscalApi.getPreparation(preparationId!),
    enabled: Boolean(preparationId),
  })
}

export function useElectronicProfile(entityId: number) {
  return useQuery({
    queryKey: fiscalKeys.profile(entityId),
    queryFn: () => fiscalApi.getElectronicProfile(entityId),
    enabled: entityId > 0,
  })
}

export function useEstablishments(entityId: number) {
  return useQuery({
    queryKey: fiscalKeys.establishments(entityId),
    queryFn: () => fiscalApi.listEstablishments(entityId),
    enabled: entityId > 0,
  })
}

export function useFiscalMutations() {
  const queryClient = useQueryClient()
  return {
    createPreparation: useMutation({
      mutationFn: ({
        sourceKind,
        sourceId,
        attemptKey,
      }: {
        sourceKind: FiscalSourceKind
        sourceId: number
        attemptKey: string
      }) => fiscalApi.createPreparation(sourceKind, sourceId, attemptKey),
      onSuccess: (_, variables) =>
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.origin(variables.sourceKind, variables.sourceId),
        }),
    }),
    updateDraft: useMutation({
      mutationFn: ({
        preparationId,
        data,
      }: {
        preparationId: string
        data: DraftUpdate
      }) => fiscalApi.updateDraft(preparationId, data),
      onSuccess: (_, variables) =>
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.preparation(variables.preparationId),
        }),
    }),
    review: useMutation({
      mutationFn: ({ preparationId }: { preparationId: string }) =>
        fiscalApi.review(preparationId),
      onSuccess: (_, variables) =>
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.preparation(variables.preparationId),
        }),
    }),
    prepare: useMutation({
      mutationFn: ({
        preparationId,
        reviewToken,
        attemptKey,
      }: {
        preparationId: string
        reviewToken: string
        attemptKey: string
      }) => fiscalApi.prepare(preparationId, reviewToken, attemptKey),
      onSuccess: (_, variables) =>
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.preparation(variables.preparationId),
        }),
    }),
    uploadArchive: useMutation({
      mutationFn: ({
        entityId,
        sourceLabel,
        xml,
      }: {
        entityId: number
        sourceLabel: string
        xml: File
      }) => fiscalApi.uploadArchive(entityId, sourceLabel, xml),
      onSuccess: (_, variables) =>
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.archive(variables.entityId),
        }),
    }),
    saveProfile: useMutation({
      mutationFn: ({
        entityId,
        data,
        attemptKey,
      }: {
        entityId: number
        data: Parameters<typeof fiscalApi.saveElectronicProfile>[1]
        attemptKey: string
      }) => fiscalApi.saveElectronicProfile(entityId, data, attemptKey),
      onSuccess: (profile) => {
        queryClient.setQueryData(fiscalKeys.profile(profile.entity_id), profile)
      },
    }),
    createEstablishment: useMutation({
      mutationFn: ({
        entityId,
        code,
        address,
      }: {
        entityId: number
        code: string
        address: string
      }) => fiscalApi.createEstablishment(entityId, code, address),
      onSuccess: (_, variables) =>
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.establishments(variables.entityId),
        }),
    }),
    createPoint: useMutation({
      mutationFn: ({
        entityId: _entityId,
        establishmentId,
        code,
      }: {
        entityId: number
        establishmentId: number
        code: string
      }) => fiscalApi.createPoint(establishmentId, code),
      onSuccess: (_, variables) =>
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.establishments(variables.entityId),
        }),
    }),
    createTaxMapping: useMutation({
      mutationFn: fiscalApi.createTaxMapping,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['workshop-configuration', 'taxes'],
        })
      },
    }),
  }
}
