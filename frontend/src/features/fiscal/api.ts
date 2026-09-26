import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type {
  ArchiveLinkInput,
  ArchivePolicyWrite,
  ArchiveReadiness,
  ArchiveResult,
  ArchiveFilters,
  ArchivePage,
  CorrectionCreateInput,
  CorrectionDetail,
  CorrectionResult,
  CorrectionSummary,
  DraftUpdate,
  ElectronicProfile,
  ElectronicProfileWrite,
  Establishment,
  FiscalDraft,
  FiscalPreparationDetail,
  FiscalSourceKind,
  NumberingAntecedentWrite,
  PreparationResult,
  ReviewResult,
  RestorationEvidenceWrite,
  TaxMappingWrite,
  TestIdentity,
} from './types'

const BASE = '/fiscal'
const attempt = (key: string) => ({ 'Idempotency-Key': key })

export function createFiscalApi(client: ApiClient) {
  return {
    getPreparation: (preparationId: string) =>
      client.request<FiscalPreparationDetail>(
        `${BASE}/preparations/${preparationId}/`,
      ),
    createPreparation: (
      sourceKind: FiscalSourceKind,
      sourceId: number,
      attemptKey: string,
    ) =>
      client.request<PreparationResult>(`${BASE}/preparations/`, {
        method: 'POST',
        headers: attempt(attemptKey),
        body: { source_kind: sourceKind, source_id: sourceId },
      }),
    updateDraft: (preparationId: string, data: DraftUpdate) =>
      client.request<FiscalDraft>(`${BASE}/preparations/${preparationId}/`, {
        method: 'PATCH',
        body: data,
      }),
    review: (preparationId: string) =>
      client.request<ReviewResult>(
        `${BASE}/preparations/${preparationId}/review/`,
        { method: 'POST', body: {} },
      ),
    prepare: (preparationId: string, reviewToken: string, attemptKey: string) =>
      client.request<PreparationResult>(
        `${BASE}/preparations/${preparationId}/prepare/`,
        {
          method: 'POST',
          headers: attempt(attemptKey),
          body: { review_token: reviewToken },
        },
      ),
    cancelPreparation: (
      preparationId: string,
      expectedVersion: number,
      reason: string,
    ) =>
      client.request<FiscalDraft>(
        `${BASE}/preparations/${preparationId}/cancel/`,
        {
          method: 'POST',
          body: { expected_version: expectedVersion, reason },
        },
      ),
    assignTestIdentity: (preparationId: string) =>
      client.request<TestIdentity>(
        `${BASE}/preparations/${preparationId}/test-identity/`,
        { method: 'POST', body: {} },
      ),
    listArchive: (entityId?: number, filters: ArchiveFilters = {}) => {
      const query = new URLSearchParams()
      if (entityId) query.set('fiscal_entity_id', String(entityId))
      if (filters.environment) query.set('environment', filters.environment)
      if (filters.documentType) query.set('document_type', filters.documentType)
      if (filters.issuedFrom) query.set('issued_from', filters.issuedFrom)
      if (filters.issuedTo) query.set('issued_to', filters.issuedTo)
      if (filters.page && filters.page > 1)
        query.set('page', String(filters.page))
      const search = query.toString()
      return client.request<ArchivePage>(
        `${BASE}/archive/${search ? `?${search}` : ''}`,
      )
    },
    uploadArchive: (entityId: number, sourceLabel: string, xml: File) => {
      const body = new FormData()
      body.append('fiscal_entity_id', String(entityId))
      body.append('source_label', sourceLabel)
      body.append('xml', xml)
      return client.request<ArchiveResult>(`${BASE}/archive/`, {
        method: 'POST',
        body,
      })
    },
    downloadArchive: (dossierId: string) =>
      client.requestBlob(`${BASE}/archive/${dossierId}/download/`),
    exportArchive: (dossierIds: string[]) =>
      client.requestBlob(`${BASE}/archive/export/`, {
        method: 'POST',
        body: { dossier_ids: dossierIds },
      }),
    linkArchive: (dossierId: string, data: ArchiveLinkInput) =>
      client.request(`${BASE}/archive/${dossierId}/link/`, {
        method: 'POST',
        body: data,
      }),
    createCorrection: (data: CorrectionCreateInput, attemptKey: string) =>
      client.request<CorrectionResult>(`${BASE}/corrections/`, {
        method: 'POST',
        headers: attempt(attemptKey),
        body: data,
      }),
    listCorrections: () =>
      client.request<CorrectionSummary[]>(`${BASE}/corrections/`),
    getCorrection: (requestId: string) =>
      client.request<CorrectionDetail>(`${BASE}/corrections/${requestId}/`),
    prepareCorrection: (requestId: string, expectedVersion: number) =>
      client.request<CorrectionResult>(
        `${BASE}/corrections/${requestId}/prepare/`,
        { method: 'POST', body: { expected_version: expectedVersion } },
      ),
    cancelCorrection: (
      requestId: string,
      expectedVersion: number,
      reason: string,
    ) =>
      client.request<CorrectionResult>(
        `${BASE}/corrections/${requestId}/cancel/`,
        {
          method: 'POST',
          body: { expected_version: expectedVersion, reason },
        },
      ),
    getElectronicProfile: (entityId: number) =>
      client.request<ElectronicProfile>(
        `${BASE}/configuration/entities/${entityId}/electronic-profile/`,
      ),
    saveElectronicProfile: (
      entityId: number,
      data: ElectronicProfileWrite,
      attemptKey: string,
    ) =>
      client.request<ElectronicProfile>(
        `${BASE}/configuration/entities/${entityId}/electronic-profile/`,
        { method: 'PUT', headers: attempt(attemptKey), body: data },
      ),
    listEstablishments: (entityId: number) =>
      client.request<Establishment[]>(
        `${BASE}/configuration/entities/${entityId}/establishments/`,
      ),
    createEstablishment: (entityId: number, code: string, address: string) =>
      client.request<Establishment>(
        `${BASE}/configuration/entities/${entityId}/establishments/`,
        { method: 'POST', body: { code, address } },
      ),
    setEstablishmentActive: (id: number, version: number, active: boolean) =>
      client.request<Establishment>(
        `${BASE}/configuration/establishments/${id}/`,
        {
          method: 'PATCH',
          body: { expected_version: version, active },
        },
      ),
    createPoint: (establishmentId: number, code: string) =>
      client.request(
        `${BASE}/configuration/establishments/${establishmentId}/points/`,
        {
          method: 'POST',
          body: { code },
        },
      ),
    setPointActive: (id: number, version: number, active: boolean) =>
      client.request(`${BASE}/configuration/points/${id}/`, {
        method: 'PATCH',
        body: { expected_version: version, active },
      }),
    createTaxMapping: (data: TaxMappingWrite) =>
      client.request(`${BASE}/configuration/tax-mappings/`, {
        method: 'POST',
        body: data,
      }),
    recordNumberingAntecedent: (data: NumberingAntecedentWrite) =>
      client.request(`${BASE}/configuration/numbering-antecedents/`, {
        method: 'POST',
        body: data,
      }),
    getReadiness: (entityId: number) =>
      client.request<ArchiveReadiness>(
        `${BASE}/readiness/?fiscal_entity_id=${entityId}`,
      ),
    saveArchivePolicy: (data: ArchivePolicyWrite) =>
      client.request<ArchiveReadiness>(`${BASE}/readiness/`, {
        method: 'POST',
        body: data,
      }),
    recordRestoration: (data: RestorationEvidenceWrite) =>
      client.request<{ evidence_id: number }>(
        `${BASE}/readiness/restorations/`,
        { method: 'POST', body: data },
      ),
  }
}

export const fiscalApi = createFiscalApi(new ApiClient(environment.apiBaseUrl))
