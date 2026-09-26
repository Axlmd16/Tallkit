from __future__ import annotations

from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class StrictSerializer(serializers.Serializer[dict[str, Any]]):
    """Contrato que denuncia campos desconocidos en vez de descartarlos."""

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise serializers.ValidationError({"body": ["El cuerpo debe ser un objeto."]})
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {field: ["Campo no admitido."] for field in sorted(unknown)}
            )
        result = super().to_internal_value(data)
        return dict(result)


class Empty(StrictSerializer):
    pass


class FiscalPreparationCreate(StrictSerializer):
    source_kind = serializers.ChoiceField(choices=("COMMERCIAL", "ARTISAN"))
    source_id = serializers.IntegerField(min_value=1)


class FiscalPreparationResult(serializers.Serializer[dict[str, Any]]):
    preparation_id = serializers.UUIDField()
    replayed = serializers.BooleanField()


class FiscalDraftUpdate(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    point_id = serializers.IntegerField(min_value=1)
    receiver = serializers.DictField()
    payments = serializers.DictField()
    environment = serializers.ChoiceField(choices=("1", "2"), default="1")
    reference_date = serializers.DateField(required=False)
    additional_info = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        max_length=15,
        required=False,
    )


class FiscalDraft(serializers.Serializer[dict[str, Any]]):
    preparation_id = serializers.UUIDField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    draft = serializers.DictField()


class FiscalPreparationSource(serializers.Serializer[dict[str, Any]]):
    kind = serializers.CharField()
    id = serializers.IntegerField()
    version = serializers.IntegerField()


class FiscalDiscrepancy(serializers.Serializer[dict[str, Any]]):
    source_changed = serializers.BooleanField()
    state_changed = serializers.BooleanField()
    corrections_changed = serializers.BooleanField()
    original_state = serializers.CharField()
    current_state = serializers.CharField()
    original_source_version = serializers.IntegerField()
    current_source_version = serializers.IntegerField()
    current_correction_ids = serializers.ListField(child=serializers.IntegerField())


class FiscalPreparationDetail(serializers.Serializer[dict[str, Any]]):
    preparation_id = serializers.UUIDField()
    fiscal_entity_id = serializers.IntegerField()
    source = FiscalPreparationSource()  # type: ignore[assignment]
    state = serializers.CharField()
    version = serializers.IntegerField()
    draft = serializers.DictField(allow_null=True)
    snapshot = serializers.DictField(allow_null=True)
    discrepancy = FiscalDiscrepancy()
    cancellation_reason = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()
    prepared_at = serializers.DateTimeField(allow_null=True)
    official_status = serializers.CharField(allow_null=True)
    official_submission = serializers.CharField()


class FiscalReview(serializers.Serializer[dict[str, Any]]):
    impediments = serializers.ListField(child=serializers.DictField())
    review_token = serializers.CharField(allow_null=True)


class FiscalPrepare(StrictSerializer):
    review_token = serializers.CharField()


class FiscalCancel(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)


class FiscalReplace(StrictSerializer):
    reason = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)


class FiscalIdentity(serializers.Serializer[dict[str, Any]]):
    identity_id = serializers.IntegerField()
    access_key = serializers.CharField(min_length=49, max_length=49)
    sequential = serializers.CharField(min_length=9, max_length=9)
    replayed = serializers.BooleanField()
    official_status = serializers.CharField(allow_null=True)


@extend_schema_field(OpenApiTypes.BINARY)
class BinaryFileField(serializers.FileField):
    pass


class FiscalArchiveUpload(StrictSerializer):
    fiscal_entity_id = serializers.IntegerField(min_value=1)
    source_label = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)
    xml = BinaryFileField()


class FiscalArchiveResult(serializers.Serializer[dict[str, Any]]):
    dossier_id = serializers.UUIDField()
    replayed = serializers.BooleanField()
    evidence_added = serializers.BooleanField()
    verification = serializers.CharField(default="EXTERNAL_UNVERIFIED")


class FiscalArchiveSummary(serializers.Serializer[dict[str, Any]]):
    dossier_id = serializers.UUIDField()
    fiscal_entity_id = serializers.IntegerField()
    document_type = serializers.CharField()
    environment = serializers.CharField()
    access_key = serializers.CharField()
    issue_date = serializers.DateField()
    total = serializers.CharField()
    verification_level = serializers.CharField()
    linked_source = serializers.CharField(allow_null=True)


class FiscalArchivePage(serializers.Serializer[dict[str, Any]]):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = FiscalArchiveSummary(many=True)


class FiscalArchiveExport(StrictSerializer):
    dossier_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=100)


class FiscalArchiveLink(StrictSerializer):
    source_kind = serializers.ChoiceField(choices=("COMMERCIAL", "ARTISAN"))
    source_id = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)


class FiscalLinkResult(serializers.Serializer[dict[str, Any]]):
    dossier_id = serializers.UUIDField()
    source_kind = serializers.CharField()
    source_id = serializers.IntegerField()
    discrepancies = serializers.ListField(child=serializers.CharField())


class FiscalCorrectionFacts(StrictSerializer):
    consumer_final_transmitted = serializers.BooleanField(allow_null=True, required=False)
    supports_tax_refund = serializers.BooleanField(allow_null=True, required=False)
    negotiable_traded = serializers.BooleanField(allow_null=True, required=False)
    external_history_complete = serializers.BooleanField(allow_null=True, required=False)
    holidays_complete = serializers.BooleanField(default=False)
    holidays = serializers.ListField(child=serializers.DateField(), default=list, max_length=100)
    calendar_source = serializers.CharField(allow_blank=True, max_length=500, default="")
    calendar_version = serializers.CharField(allow_blank=True, max_length=100, default="")


class FiscalCorrectionLineWrite(StrictSerializer):
    position = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField()
    base_amount = serializers.CharField()
    tax_amount = serializers.CharField()
    total_amount = serializers.CharField()


class FiscalCorrectionCreate(StrictSerializer):
    original_dossier_id = serializers.UUIDField(required=False, allow_null=True)
    original_identity_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    action = serializers.ChoiceField(choices=("ONLINE_CANCELLATION", "CREDIT_NOTE"))
    reason = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)
    reference_date = serializers.DateField()
    facts = FiscalCorrectionFacts()
    lines: Any = serializers.ListSerializer(child=FiscalCorrectionLineWrite(), max_length=200)


class FiscalCorrectionResult(serializers.Serializer[dict[str, Any]]):
    request_id = serializers.UUIDField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    replayed = serializers.BooleanField()
    officially_executed = serializers.BooleanField(default=False)


class FiscalCorrectionSummary(serializers.Serializer[dict[str, Any]]):
    request_id = serializers.UUIDField()
    action = serializers.CharField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    reason = serializers.CharField()
    reference_date = serializers.DateField()
    requested_total = serializers.CharField()
    evaluation_outcome = serializers.CharField()
    has_evidence = serializers.BooleanField()
    reconciliation_pending = serializers.BooleanField()
    officially_executed = serializers.BooleanField()


class FiscalCorrectionDetail(serializers.Serializer[dict[str, Any]]):
    request_id = serializers.UUIDField()
    original = serializers.DictField()
    action = serializers.CharField()
    reason = serializers.CharField()
    reference_date = serializers.DateField()
    normative_version = serializers.CharField()
    facts = serializers.DictField()
    evaluation = serializers.DictField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    requested_base = serializers.CharField()
    requested_tax = serializers.CharField()
    requested_total = serializers.CharField()
    lines = serializers.ListField(child=serializers.DictField())
    evidence_dossier_id = serializers.UUIDField(allow_null=True)
    reconciliation_pending = serializers.BooleanField()
    cancellation_reason = serializers.CharField(allow_blank=True)
    replaces_id = serializers.UUIDField(allow_null=True)
    officially_executed = serializers.BooleanField()


class FiscalCorrectionPrepare(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)


class FiscalCorrectionCancel(FiscalCorrectionPrepare):
    reason = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)


class FiscalCorrectionReplace(FiscalCorrectionCreate):
    expected_version = serializers.IntegerField(min_value=1)


class FiscalCorrectionEvidence(StrictSerializer):
    evidence_dossier_id = serializers.UUIDField()


class FiscalArchivePolicyWrite(StrictSerializer):
    fiscal_entity_id = serializers.IntegerField(min_value=1)
    responsible = serializers.CharField(min_length=1, max_length=300)
    purpose = serializers.CharField(min_length=1)
    legal_basis = serializers.CharField(min_length=1)
    retention = serializers.DictField()
    rights_channel = serializers.CharField(min_length=1, max_length=500)
    rights_procedure = serializers.CharField(min_length=1)
    end_of_retention_review = serializers.CharField(min_length=1)
    storage_fingerprint = serializers.CharField(min_length=1, max_length=128)
    procedure_version = serializers.CharField(min_length=1, max_length=100)


class FiscalRestorationWrite(StrictSerializer):
    restored_at = serializers.DateTimeField()
    procedure_version = serializers.CharField(min_length=1, max_length=100)
    storage_fingerprint = serializers.CharField(min_length=1, max_length=128)
    responsible = serializers.CharField(min_length=1, max_length=300)
    backup_identifier = serializers.CharField(min_length=1, max_length=300)
    report_reference = serializers.CharField(min_length=1, max_length=500)
    destination = serializers.CharField(min_length=1, max_length=500)
    content_hashes_ok = serializers.BooleanField()
    identities_ok = serializers.BooleanField()
    permissions_ok = serializers.BooleanField()
    links_ok = serializers.BooleanField()
    deletion_reviewed = serializers.BooleanField()
    notes = serializers.CharField(required=False, allow_blank=True)


class FiscalReadiness(serializers.Serializer[dict[str, Any]]):
    fiscal_entity_id = serializers.IntegerField()
    policy = serializers.DictField(allow_null=True)
    restoration = serializers.DictField(allow_null=True)
    policy_ready = serializers.BooleanField()
    restoration_ready = serializers.BooleanField()
    productive_archive_ready = serializers.BooleanField()
    pending = serializers.ListField(child=serializers.CharField())


class FiscalElectronicProfileWrite(StrictSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    conditions = serializers.DictField(default=dict)
    certificate = serializers.DictField(required=False, allow_null=True)


class FiscalElectronicProfile(serializers.Serializer[dict[str, Any]]):
    entity_id = serializers.IntegerField()
    revision = serializers.IntegerField()
    conditions = serializers.DictField()
    certificate = serializers.DictField(allow_null=True)


class FiscalEstablishmentWrite(StrictSerializer):
    code = serializers.CharField(min_length=3, max_length=3)
    address = serializers.CharField(min_length=1, max_length=300, trim_whitespace=True)


class FiscalActiveUpdate(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    active = serializers.BooleanField()


class FiscalEstablishment(serializers.Serializer[dict[str, Any]]):
    id = serializers.IntegerField()
    entity_id = serializers.IntegerField()
    code = serializers.CharField()
    address = serializers.CharField()
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()
    points = serializers.ListField(child=serializers.DictField(), required=False)


class FiscalPointWrite(StrictSerializer):
    code = serializers.CharField(min_length=3, max_length=3)


class FiscalPoint(serializers.Serializer[dict[str, Any]]):
    id = serializers.IntegerField()
    establishment_id = serializers.IntegerField()
    code = serializers.CharField()
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()


class FiscalTaxMappingWrite(StrictSerializer):
    definition_id = serializers.IntegerField(min_value=1)
    percentage_code = serializers.CharField(max_length=4)
    starts_on = serializers.DateField()
    ends_on = serializers.DateField(required=False, allow_null=True)
    source: Any = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)


class FiscalTaxMapping(serializers.Serializer[dict[str, Any]]):
    id = serializers.IntegerField()
    definition_id = serializers.IntegerField()
    catalog_version = serializers.CharField()
    percentage_code = serializers.CharField()
    starts_on = serializers.DateField()
    ends_on = serializers.DateField(allow_null=True)
    source: Any = serializers.CharField()


class FiscalNumberingAntecedentWrite(StrictSerializer):
    entity_id = serializers.IntegerField(min_value=1)
    document_type = serializers.ChoiceField(choices=("01", "04"))
    establishment_code = serializers.CharField(min_length=3, max_length=3)
    emission_point_code = serializers.CharField(min_length=3, max_length=3)
    environment = serializers.ChoiceField(choices=("1", "2"))
    last_declared_number = serializers.IntegerField(min_value=1, max_value=999_999_999)
    declared_on = serializers.DateField()
    source: Any = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)


class FiscalNumberingAntecedent(serializers.Serializer[dict[str, Any]]):
    id = serializers.IntegerField()
    entity_id = serializers.IntegerField()
    document_type = serializers.CharField()
    establishment_code = serializers.CharField()
    emission_point_code = serializers.CharField()
    environment = serializers.CharField()
    last_declared_number = serializers.IntegerField()
    declared_on = serializers.DateField()
    source: Any = serializers.CharField()
