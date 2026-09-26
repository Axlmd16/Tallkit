export type FiscalSourceKind = 'COMMERCIAL' | 'ARTISAN'
export type FiscalEnvironment = '1' | '2'
export type CorrectionAction = 'ONLINE_CANCELLATION' | 'CREDIT_NOTE'

export interface PreparationResult {
  preparation_id: string
  replayed: boolean
}

export interface FiscalDraft {
  preparation_id: string
  state: 'DRAFT' | 'PREPARED' | 'CANCELLED'
  version: number
  draft: Record<string, unknown>
}

export interface FiscalDiscrepancy {
  source_changed: boolean
  state_changed: boolean
  corrections_changed: boolean
  original_state: string
  current_state: string
  original_source_version: number
  current_source_version: number
  current_correction_ids: number[]
}

export interface FiscalPreparationDetail {
  preparation_id: string
  fiscal_entity_id: number
  source: {
    kind: FiscalSourceKind
    id: number
    version: number
  }
  state: 'DRAFT' | 'PREPARED' | 'CANCELLED'
  version: number
  draft: DraftValues | null
  snapshot: Record<string, unknown> | null
  discrepancy: FiscalDiscrepancy
  cancellation_reason: string
  created_at: string
  prepared_at: string | null
  official_status: null
  official_submission: 'NOT_PERFORMED'
}

export interface DraftValues {
  point_id?: number
  environment?: FiscalEnvironment
  receiver?: Record<string, unknown>
  payments?: Record<string, unknown>
  reference_date?: string
  additional_info?: Array<Record<string, string>>
}

export interface DraftUpdate {
  expected_version: number
  point_id: number
  receiver: Record<string, unknown>
  payments: Record<string, unknown>
  environment: FiscalEnvironment
  reference_date?: string
  additional_info?: Array<Record<string, string>>
}

export interface ReviewResult {
  impediments: Array<{ field: string; message: string }>
  review_token: string | null
}

export interface TestIdentity {
  identity_id: number
  access_key: string
  sequential: string
  replayed: boolean
  official_status: null
}

export interface ArchiveSummary {
  dossier_id: string
  fiscal_entity_id: number
  document_type: string
  environment: FiscalEnvironment
  access_key: string
  issue_date: string
  total: string
  verification_level: 'EXTERNAL_UNVERIFIED'
  linked_source: string | null
}

export interface ArchiveResult {
  dossier_id: string
  replayed: boolean
  evidence_added: boolean
  verification: 'EXTERNAL_UNVERIFIED'
}

export interface ArchiveLinkInput {
  source_kind: FiscalSourceKind
  source_id: number
  reason: string
}

export interface CorrectionFacts {
  consumer_final_transmitted: boolean | null
  supports_tax_refund: boolean | null
  negotiable_traded: boolean | null
  external_history_complete: boolean | null
  holidays_complete: boolean
  holidays: string[]
  calendar_source: string
  calendar_version: string
}

export interface CorrectionLineInput {
  position: number
  quantity: string
  base_amount: string
  tax_amount: string
  total_amount: string
}

export interface CorrectionCreateInput {
  original_dossier_id?: string | null
  original_identity_id?: number | null
  action: CorrectionAction
  reason: string
  reference_date: string
  facts: CorrectionFacts
  lines: CorrectionLineInput[]
}

export interface CorrectionResult {
  request_id: string
  state: 'DRAFT' | 'PREPARED' | 'CANCELLED'
  version: number
  replayed: boolean
  officially_executed: false
}

export type ConditionStatus = 'UNKNOWN' | 'APPLICABLE' | 'NOT_APPLICABLE'
export interface DeclaredCondition {
  status: ConditionStatus
  value?: string | null
  source?: string | null
  starts_on?: string | null
  ends_on?: string | null
}

export interface CertificateMetadata {
  holder: string
  issuer: string
  reference: string
  source: string
  starts_on: string
  ends_on: string
}

export interface ElectronicProfile {
  entity_id: number
  revision: number
  conditions: Record<string, DeclaredCondition>
  certificate: CertificateMetadata | null
}

export interface ElectronicProfileWrite {
  expected_revision: number
  conditions: Record<string, DeclaredCondition>
  certificate: CertificateMetadata | null
}

export interface EmissionPoint {
  id: number
  establishment_id: number
  code: string
  is_active: boolean
  version: number
}

export interface Establishment {
  id: number
  entity_id: number
  code: string
  address: string
  is_active: boolean
  version: number
  points: EmissionPoint[]
}

export interface TaxMappingWrite {
  definition_id: number
  percentage_code: string
  starts_on: string
  ends_on?: string | null
  source: string
}

export interface NumberingAntecedentWrite {
  entity_id: number
  document_type: '01' | '04'
  establishment_code: string
  emission_point_code: string
  environment: FiscalEnvironment
  last_declared_number: number
  declared_on: string
  source: string
}
