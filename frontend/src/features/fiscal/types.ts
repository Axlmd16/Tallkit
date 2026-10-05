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
  summary: PreparationSummary | null
  issuer: { ruc: string; legal_name: string } | null
  working: WorkingDraft | null
  payment_options: PaymentChoice[]
  missing_fields: string[]
  technical: Record<string, unknown> | null
}

export interface PreparationSummary {
  kind: FiscalSourceKind
  internal_number: string | null
  operational_date: string | null
  condition: 'CONTADO' | 'CREDITO'
  state: string
  base_total: string
  tax_total: string
  grand_total: string
  lines: Array<{
    position: number
    description: string
    quantity: string
    total: string
  }>
}

export interface FiscalReceiverValues {
  identification_type: string
  identification: string
  legal_name: string
  address?: string | null
  email?: string | null
}

export interface DeclaredPaymentForm {
  payment_code: string
  amount: string
}

export interface WorkingDraft {
  draft_format: number
  receiver: FiscalReceiverValues
  payments: {
    forms: DeclaredPaymentForm[]
    suggested: boolean
    suggestion_origin?: 'COLLECTED' | 'MIXED' | 'DEFAULT' | 'NONE' | null
  }
  additional_info: Array<Record<string, string>>
}

export interface PaymentChoice {
  code: string
  display_name: string
  description: string
  internal_method: string
}

export interface DraftValues {
  receiver?: Record<string, unknown>
  payments?: Record<string, unknown>
  additional_info?: Array<Record<string, string>>
}

export interface DraftUpdate {
  expected_version: number
  receiver: FiscalReceiverValues
  payments: { forms: DeclaredPaymentForm[] }
  additional_info?: Array<Record<string, string>>
}

export type ImpedimentAudience = 'OPERATOR' | 'ADMINISTRATOR'

export interface ReviewImpediment {
  field: string
  code: string
  audience: ImpedimentAudience
  message: string
}

export interface ReviewResult {
  impediments: ReviewImpediment[]
  review_token: string | null
}

export interface ActivePreparation {
  preparation_id: string | null
  state: 'DRAFT' | 'PREPARED' | null
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

export interface ArchiveFilters {
  environment?: FiscalEnvironment | undefined
  documentType?: '01' | '04' | undefined
  issuedFrom?: string | undefined
  issuedTo?: string | undefined
  page?: number | undefined
}

export interface ArchivePage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: ArchiveSummary[]
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

export interface CorrectionSummary {
  request_id: string
  action: CorrectionAction
  state: 'DRAFT' | 'PREPARED' | 'CANCELLED'
  version: number
  reason: string
  reference_date: string
  requested_total: string
  evaluation_outcome: 'ELIGIBLE' | 'PENDING' | 'BLOCKED'
  has_evidence: boolean
  reconciliation_pending: boolean
  officially_executed: false
}

export interface CorrectionDetail extends CorrectionSummary {
  original: { kind: 'DOSSIER' | 'TEST_IDENTITY'; id: string | number }
  normative_version: string
  facts: CorrectionFacts
  evaluation: {
    outcome: 'ELIGIBLE' | 'PENDING' | 'BLOCKED'
    reasons?: string[]
    pending_facts?: string[]
    deadline?: string | null
  }
  requested_base: string
  requested_tax: string
  lines: CorrectionLineInput[]
  evidence_dossier_id: string | null
  cancellation_reason: string
  replaces_id: string | null
}

export interface ArchivePolicyWrite {
  fiscal_entity_id: number
  responsible: string
  purpose: string
  legal_basis: string
  retention: Record<string, string>
  rights_channel: string
  rights_procedure: string
  end_of_retention_review: string
  storage_fingerprint: string
  procedure_version: string
}

export interface RestorationEvidenceWrite {
  restored_at: string
  procedure_version: string
  storage_fingerprint: string
  responsible: string
  backup_identifier: string
  report_reference: string
  destination: string
  content_hashes_ok: boolean
  identities_ok: boolean
  permissions_ok: boolean
  links_ok: boolean
  deletion_reviewed: boolean
  notes?: string
}

export interface ArchiveReadiness {
  fiscal_entity_id: number
  policy: (ArchivePolicyWrite & { version: number; recorded_at: string }) | null
  restoration:
    | (RestorationEvidenceWrite & { id: number; recorded_at: string })
    | null
  policy_ready: boolean
  restoration_ready: boolean
  productive_archive_ready: boolean
  pending: string[]
}

export type ConditionStatus = 'UNKNOWN' | 'APPLICABLE' | 'NOT_APPLICABLE'
export interface DeclaredCondition {
  status: ConditionStatus
  value?: string | null
  source?: string | null
  starts_on?: string | null
  ends_on?: string | null
  /** Solo la calificación artesanal declara el organismo que la otorgó. */
  issuing_body?: string | null
}

export interface ClosedOption {
  value: string
  label: string
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
  /** 1: condiciones en texto libre (historia, solo lectura); 2: valores cerrados. */
  conditions_format: 1 | 2
  conditions: Record<string, DeclaredCondition>
  certificate: CertificateMetadata | null
  /** Leyenda oficial derivada del régimen; solo informativa. */
  regime_legend: string | null
  options: {
    tax_regime: ClosedOption[]
    accounting_obligation: ClosedOption[]
  }
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
  catalog_entry_id: number
  starts_on: string
  ends_on?: string | null
  source: string
}

export interface TaxMappingSuccessorWrite {
  catalog_entry_id: number
  starts_on: string
  source: string
}

export type ElectronicState =
  | 'NOT_CONFIGURED'
  | 'INCOMPLETE'
  | 'NEEDS_REVIEW'
  | 'READY'

export interface StatusCause {
  code: string
  kind: 'MISSING' | 'REVIEW'
  message: string
}

export interface ElectronicStatus {
  entity_id: number
  state: ElectronicState
  causes: StatusCause[]
  warnings: StatusCause[]
  environment: 'TEST'
  profile_revision: number | null
  default_point_id: number | null
  default_payment_code: string | null
}

export interface PreparationDefaults {
  entity_id: number
  version: number
  designated_point_id: number | null
  effective_point_id: number | null
  point_issue: string | null
  default_payment_code: string | null
  payment_issue: string | null
}

export interface PreparationDefaultsWrite {
  expected_version: number
  default_point_id?: number | null
  default_payment_code?: string
}

export type CatalogKind = 'TAX_RATE' | 'PAYMENT_FORM'

export interface CatalogEntry {
  id: number
  kind: CatalogKind
  catalog_version: string
  code: string
  description: string
  display_name: string
  tax_code: string | null
  rate: string | null
  treatment: string | null
  source_document: string
  source_version: string
  source_reference: string
  source_url: string
  downloaded_on: string
  valid_from: string | null
  valid_to: string | null
  validity_note: string
  is_active: boolean
  is_selectable: boolean
  incorporated_at: string
}

export interface TaxMappingItem {
  id: number
  definition_id: number
  definition_name: string
  catalog_version: string
  percentage_code: string
  catalog_entry_id: number | null
  display_name: string | null
  rate: string | null
  treatment: string | null
  starts_on: string
  ends_on: string | null
  source: string
  is_current: boolean
}

export interface PaymentFormOption {
  code: string
  description: string
  display_name: string
  catalog_version: string
  source_document: string
  source_version: string
  source_url: string
  downloaded_on: string
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
  enableable: boolean
  enabled: boolean
  is_default: boolean
  internal_method: string | null
  version: number
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
