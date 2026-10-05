import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fiscalApi } from './api'
import type {
  ArchiveFilters,
  CatalogKind,
  DraftUpdate,
  FiscalSourceKind,
  PreparationDefaultsWrite,
  TaxMappingSuccessorWrite,
} from './types'

export const fiscalKeys = {
  all: ['fiscal'] as const,
  origin: (kind: FiscalSourceKind, id: number) =>
    [...fiscalKeys.all, 'origin', kind, id] as const,
  preparation: (id: string) => [...fiscalKeys.all, 'preparation', id] as const,
  archive: (entityId?: number, filters?: ArchiveFilters) =>
    filters
      ? ([...fiscalKeys.all, 'archive', entityId ?? 'all', filters] as const)
      : ([...fiscalKeys.all, 'archive', entityId ?? 'all'] as const),
  profile: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'profile', entityId] as const,
  establishments: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'establishments', entityId] as const,
  configuration: () => [...fiscalKeys.all, 'configuration'] as const,
  status: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'status', entityId] as const,
  defaults: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'defaults', entityId] as const,
  catalog: (kind: CatalogKind, selectable: boolean) =>
    [...fiscalKeys.all, 'configuration', 'catalog', kind, selectable] as const,
  taxMappings: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'tax-mappings', entityId] as const,
  paymentForms: (entityId: number) =>
    [...fiscalKeys.all, 'configuration', 'payment-forms', entityId] as const,
  corrections: () => [...fiscalKeys.all, 'corrections'] as const,
  correction: (id: string) => [...fiscalKeys.corrections(), id] as const,
  readiness: (entityId: number) =>
    [...fiscalKeys.all, 'readiness', entityId] as const,
}

export function useArchive(entityId?: number, filters: ArchiveFilters = {}) {
  return useQuery({
    queryKey: fiscalKeys.archive(entityId, filters),
    queryFn: () => fiscalApi.listArchive(entityId, filters),
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

export function useCorrections() {
  return useQuery({
    queryKey: fiscalKeys.corrections(),
    queryFn: fiscalApi.listCorrections,
  })
}

export function useCorrection(requestId: string | null) {
  return useQuery({
    queryKey: fiscalKeys.correction(requestId ?? 'missing'),
    queryFn: () => fiscalApi.getCorrection(requestId!),
    enabled: Boolean(requestId),
  })
}

export function useArchiveReadiness(entityId: number) {
  return useQuery({
    queryKey: fiscalKeys.readiness(entityId),
    queryFn: () => fiscalApi.getReadiness(entityId),
    enabled: entityId > 0,
  })
}

export function useActivePreparation(
  sourceKind: FiscalSourceKind,
  sourceId: number,
  enabled = true,
) {
  return useQuery({
    queryKey: fiscalKeys.origin(sourceKind, sourceId),
    queryFn: () => fiscalApi.getActivePreparation(sourceKind, sourceId),
    enabled: enabled && sourceId > 0,
  })
}

export function useElectronicStatus(entityId: number) {
  return useQuery({
    queryKey: fiscalKeys.status(entityId),
    queryFn: () => fiscalApi.getElectronicStatus(entityId),
    enabled: entityId > 0,
  })
}

export function usePreparationDefaults(entityId: number) {
  return useQuery({
    queryKey: fiscalKeys.defaults(entityId),
    queryFn: () => fiscalApi.getPreparationDefaults(entityId),
    enabled: entityId > 0,
  })
}

export function useCatalog(kind: CatalogKind, selectable = false) {
  return useQuery({
    queryKey: fiscalKeys.catalog(kind, selectable),
    queryFn: () => fiscalApi.getCatalog(kind, selectable),
  })
}

export function useTaxMappings(entityId: number) {
  return useQuery({
    queryKey: fiscalKeys.taxMappings(entityId),
    queryFn: () => fiscalApi.getTaxMappings(entityId),
    enabled: entityId > 0,
  })
}

export function usePaymentForms(entityId: number) {
  return useQuery({
    queryKey: fiscalKeys.paymentForms(entityId),
    queryFn: () => fiscalApi.getPaymentForms(entityId),
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
    createCorrection: useMutation({
      mutationFn: ({
        data,
        attemptKey,
      }: {
        data: Parameters<typeof fiscalApi.createCorrection>[0]
        attemptKey: string
      }) => fiscalApi.createCorrection(data, attemptKey),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: fiscalKeys.corrections() }),
    }),
    prepareCorrection: useMutation({
      mutationFn: ({
        requestId,
        version,
      }: {
        requestId: string
        version: number
      }) => fiscalApi.prepareCorrection(requestId, version),
      onSuccess: (_, variables) => {
        void queryClient.invalidateQueries({
          queryKey: fiscalKeys.corrections(),
        })
        void queryClient.invalidateQueries({
          queryKey: fiscalKeys.correction(variables.requestId),
        })
      },
    }),
    cancelCorrection: useMutation({
      mutationFn: ({
        requestId,
        version,
        reason,
      }: {
        requestId: string
        version: number
        reason: string
      }) => fiscalApi.cancelCorrection(requestId, version, reason),
      onSuccess: (_, variables) => {
        void queryClient.invalidateQueries({
          queryKey: fiscalKeys.corrections(),
        })
        void queryClient.invalidateQueries({
          queryKey: fiscalKeys.correction(variables.requestId),
        })
      },
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
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.preparation(variables.preparationId),
        })
        queryClient.invalidateQueries({
          queryKey: [...fiscalKeys.all, 'origin'],
        })
      },
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
      onSuccess: async (_, variables) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: fiscalKeys.archive(variables.entityId),
          }),
          queryClient.invalidateQueries({ queryKey: fiscalKeys.archive() }),
        ])
      },
    }),
    linkArchive: useMutation({
      mutationFn: ({
        dossierId,
        data,
      }: {
        dossierId: string
        data: Parameters<typeof fiscalApi.linkArchive>[1]
      }) => fiscalApi.linkArchive(dossierId, data),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: fiscalKeys.archive() }),
    }),
    exportArchive: useMutation({
      mutationFn: ({ dossierIds }: { dossierIds: string[] }) =>
        fiscalApi.exportArchive(dossierIds),
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
        queryClient.invalidateQueries({
          queryKey: fiscalKeys.status(profile.entity_id),
        })
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
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: fiscalKeys.status(variables.entityId),
          }),
          queryClient.invalidateQueries({
            queryKey: fiscalKeys.establishments(variables.entityId),
          }),
        ]),
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
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: fiscalKeys.status(variables.entityId),
          }),
          queryClient.invalidateQueries({
            queryKey: fiscalKeys.establishments(variables.entityId),
          }),
        ]),
    }),
    createTaxMapping: useMutation({
      mutationFn: fiscalApi.createTaxMapping,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['workshop-configuration', 'taxes'],
        })
        queryClient.invalidateQueries({ queryKey: fiscalKeys.configuration() })
      },
    }),
    scheduleTaxMappingSuccessor: useMutation({
      mutationFn: ({
        mappingId,
        data,
      }: {
        mappingId: number
        data: TaxMappingSuccessorWrite
      }) => fiscalApi.scheduleTaxMappingSuccessor(mappingId, data),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['workshop-configuration', 'taxes'],
        })
        queryClient.invalidateQueries({ queryKey: fiscalKeys.configuration() })
      },
    }),
    savePreparationDefaults: useMutation({
      mutationFn: ({
        entityId,
        data,
        attemptKey,
      }: {
        entityId: number
        data: PreparationDefaultsWrite
        attemptKey: string
      }) => fiscalApi.savePreparationDefaults(entityId, data, attemptKey),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: fiscalKeys.configuration() }),
    }),
    setPaymentForm: useMutation({
      mutationFn: ({
        entityId,
        code,
        enabled,
        expectedVersion,
        attemptKey,
      }: {
        entityId: number
        code: string
        enabled: boolean
        expectedVersion: number
        attemptKey: string
      }) =>
        fiscalApi.setPaymentForm(
          entityId,
          code,
          { enabled, expected_version: expectedVersion },
          attemptKey,
        ),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: fiscalKeys.configuration() }),
    }),
    saveArchivePolicy: useMutation({
      mutationFn: fiscalApi.saveArchivePolicy,
      onSuccess: (result) =>
        queryClient.setQueryData(
          fiscalKeys.readiness(result.fiscal_entity_id),
          result,
        ),
    }),
    recordRestoration: useMutation({
      mutationFn: fiscalApi.recordRestoration,
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: [...fiscalKeys.all, 'readiness'],
        }),
    }),
  }
}
