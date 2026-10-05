from __future__ import annotations

import tempfile
import zipfile
from collections.abc import Callable
from dataclasses import asdict
from datetime import date
from typing import Any, ClassVar
from uuid import UUID

from django.core.exceptions import ObjectDoesNotExist
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, problem_response
from fiscal.api import serializers as sz
from fiscal.application import corrections, preparations, readiness, xml_archive
from fiscal.application.corrections import (
    CorrectionApplicationError,
    CorrectionConflictError,
    CorrectionImpedimentError,
    CorrectionRemainderError,
    CorrectionStateError,
)
from fiscal.application.identity import IdentityError, assign_test_identity
from fiscal.application.preparations import (
    ActivePreparationConflictError,
    FiscalPreparationError,
    FiscalPreparationNotFoundError,
    IdempotencyConflictError,
    PreparationImpedimentError,
    PreparationStateError,
    PreparationVersionConflictError,
    StaleReviewError,
)
from fiscal.application.xml_archive import FiscalArchiveError
from fiscal.domain.corrections import CorrectionAction, CorrectionFacts
from fiscal.infrastructure.xml_parser import MAX_XML_BYTES, FiscalXmlError
from identity.api.permissions import HasBusinessPermission
from identity.application.authorization import BusinessPermissionDeniedError, require_permission
from identity.models import User
from workshop_configuration.application.electronic_profiles import (
    describe_profile,
    get_profile,
    save_profile,
)
from workshop_configuration.application.electronic_status import get_electronic_status
from workshop_configuration.application.emission_locations import (
    create_establishment,
    create_point,
    list_establishments,
    set_establishment_active,
    set_point_active,
)
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityNotFoundError,
    StaleRecordError,
)
from workshop_configuration.application.fiscal_tax_mapping import (
    create_mapping,
    list_mappings,
    schedule_mapping_successor,
)
from workshop_configuration.application.initialization import (
    IdempotencyConflictError as ConfigurationIdempotencyConflictError,
)
from workshop_configuration.application.official_catalog import (
    CatalogManifestError,
    get_catalog,
    is_current,
)
from workshop_configuration.application.preparation_settings import (
    get_payment_forms,
    get_preparation_defaults,
    set_payment_form_enabled,
    set_preparation_defaults,
)
from workshop_configuration.domain.validation import ConfigurationValidationError

_PROBLEMS = {
    400: ProblemSerializer,
    403: ProblemSerializer,
    404: ProblemSerializer,
    409: ProblemSerializer,
}
_TAG = "Fiscal"
_ARCHIVE_LIST_PARAMETERS = [
    OpenApiParameter("fiscal_entity_id", OpenApiTypes.INT, description="Emisor."),
    OpenApiParameter("environment", OpenApiTypes.STR, enum=["1", "2"]),
    OpenApiParameter("document_type", OpenApiTypes.STR, enum=["01", "04"]),
    OpenApiParameter("issued_from", OpenApiTypes.DATE, description="Emisión desde (AAAA-MM-DD)."),
    OpenApiParameter("issued_to", OpenApiTypes.DATE, description="Emisión hasta (AAAA-MM-DD)."),
    OpenApiParameter("page", OpenApiTypes.INT, description="Desde 1; omisión 1."),
    OpenApiParameter(
        "page_size",
        OpenApiTypes.INT,
        description=f"1 a {xml_archive.ARCHIVE_PAGE_SIZE_MAX}; omisión "
        f"{xml_archive.ARCHIVE_PAGE_SIZE_DEFAULT}.",
    ),
]


def _query_int(params: Any, name: str) -> int | None:
    raw = params.get(name)
    if raw in (None, ""):
        return None
    if not str(raw).isdigit():
        raise FiscalArchiveError(f"Parámetro inválido: {name}.")
    return int(raw)


def _query_date(params: Any, name: str) -> date | None:
    raw = params.get(name)
    if raw in (None, ""):
        return None
    try:
        return date.fromisoformat(str(raw))
    except ValueError:
        raise FiscalArchiveError(f"Parámetro inválido: {name} (AAAA-MM-DD).") from None


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La sesión no resolvió un usuario.")
    return request.user


def _idempotency_key(request: Request) -> str:
    key = request.headers.get("Idempotency-Key", "").strip()
    if not key:
        raise CorrectionApplicationError("Falta el encabezado Idempotency-Key.")
    return key


def _validated(serializer_class: type[sz.StrictSerializer], request: Request) -> dict[str, Any]:
    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def _problem(request: Request, exc: Exception) -> Response:
    code = "fiscal_invalid_request"
    response_status: int = status.HTTP_400_BAD_REQUEST
    title = "Solicitud fiscal inválida"
    details: dict[str, Any] | None = None
    errors: dict[str, list[str]] | None = None
    if isinstance(exc, BusinessPermissionDeniedError):
        code, response_status, title = "permission_denied", 403, "Acceso denegado"
    elif isinstance(
        exc, (FiscalPreparationNotFoundError, FiscalEntityNotFoundError, ObjectDoesNotExist)
    ):
        code, response_status, title = "not_found", 404, "Recurso no encontrado"
    elif isinstance(exc, FiscalXmlError):
        code = exc.code
        if exc.code == "xml_too_large":
            response_status, title = 413, "Contenido demasiado grande"
    elif isinstance(exc, StaleReviewError):
        code, response_status, title = "review_stale", 409, "Revisión desactualizada"
    elif isinstance(exc, PreparationImpedimentError):
        code, response_status, title = "preparation_impediments", 409, "Preparación impedida"
        details = {"impediments": exc.impediments}
    elif isinstance(exc, CorrectionImpedimentError):
        code, response_status, title = "correction_impediments", 409, "Corrección impedida"
        details = {"evaluation": exc.evaluation}
    elif isinstance(
        exc,
        (
            ActivePreparationConflictError,
            IdempotencyConflictError,
            ConfigurationIdempotencyConflictError,
            PreparationStateError,
            PreparationVersionConflictError,
            StaleReviewError,
            CorrectionConflictError,
            CorrectionRemainderError,
            CorrectionStateError,
        ),
    ):
        code, response_status, title = "stale_record", 409, "Conflicto con el estado actual"
    elif isinstance(exc, readiness.FiscalReadinessError):
        code, response_status, title = (
            "fiscal_readiness_required",
            409,
            "Preparación operativa pendiente",
        )
    elif isinstance(exc, (FiscalPreparationError, FiscalArchiveError, IdentityError)):
        code = "fiscal_invalid_request"
    if isinstance(exc, ConfigurationValidationError):
        code = "validation_error"
        details = None
        errors = exc.errors or None
    elif isinstance(exc, StaleRecordError):
        code, response_status, title = "stale_record", 409, "Conflicto con el estado actual"
    return problem_response(
        request=request,
        status_code=response_status,
        title=title,
        code=code,
        detail=str(exc),
        errors=errors,
        details=details,
    )


def _respond(request: Request, operation: Callable[[], Response]) -> Response:
    try:
        return operation()
    except (
        BusinessPermissionDeniedError,
        FiscalPreparationError,
        FiscalArchiveError,
        FiscalXmlError,
        IdentityError,
        CorrectionApplicationError,
        readiness.FiscalReadinessError,
        ConfigurationValidationError,
        ConfigurationIdempotencyConflictError,
        CatalogManifestError,
        StaleRecordError,
        FiscalEntityNotFoundError,
        ObjectDoesNotExist,
    ) as exc:
        return _problem(request, exc)


class PreparationCreateView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="fiscal_preparation_active",
        parameters=[
            OpenApiParameter("source_kind", OpenApiTypes.STR, enum=["COMMERCIAL", "ARTISAN"]),
            OpenApiParameter("source_id", OpenApiTypes.INT),
        ],
        responses={200: sz.FiscalActivePreparation, **_PROBLEMS},
        description="Preparación local activa de una operación; no indica emisión.",
    )
    def get(self, request: Request) -> Response:
        def operation() -> Response:
            kind = request.query_params.get("source_kind", "")
            source_id = _query_int(request.query_params, "source_id")
            if kind not in ("COMMERCIAL", "ARTISAN") or source_id is None:
                raise preparations.InvalidSourceKindError("Indique el tipo y la operación.")
            found = preparations.find_active_preparation(
                actor=_actor(request), source_kind=kind, source_id=source_id
            )
            return Response(
                {
                    "preparation_id": str(found.preparation_id) if found else None,
                    "state": found.state if found else None,
                }
            )

        return _respond(request, operation)

    @extend_schema(
        tags=[_TAG],
        operation_id="fiscal_preparation_create",
        request=sz.FiscalPreparationCreate,
        responses={201: sz.FiscalPreparationResult, **_PROBLEMS},
        description="Crea un borrador fiscal local; no transmite ni autoriza un comprobante.",
    )
    def post(self, request: Request) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalPreparationCreate, request)
            result = preparations.create_draft(
                actor=_actor(request),
                source_kind=data["source_kind"],
                source_id=data["source_id"],
                idempotency_key=_idempotency_key(request),
            )
            return Response(
                {"preparation_id": str(result.preparation_id), "replayed": result.replayed},
                status=201,
            )

        return _respond(request, operation)


class PreparationDetailView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="fiscal_preparation_retrieve",
        responses={200: sz.FiscalPreparationDetail, **_PROBLEMS},
        description=(
            "Consulta el borrador o snapshot histórico y su discrepancia actual. "
            "No representa envío ni estado oficial del SRI."
        ),
    )
    def get(self, request: Request, preparation_id: UUID) -> Response:
        def operation() -> Response:
            result = preparations.get_preparation(
                actor=_actor(request), preparation_id=preparation_id
            )
            return Response(
                {
                    "preparation_id": str(result.preparation_id),
                    "fiscal_entity_id": result.fiscal_entity_id,
                    "source": {
                        "kind": result.source_kind,
                        "id": result.source_id,
                        "version": result.source_version,
                    },
                    "state": result.state,
                    "version": result.version,
                    "draft": result.draft,
                    "snapshot": result.snapshot,
                    "discrepancy": {
                        **asdict(result.discrepancy),
                        "current_correction_ids": list(result.discrepancy.current_correction_ids),
                    },
                    "cancellation_reason": result.cancellation_reason,
                    "created_at": result.created_at,
                    "prepared_at": result.prepared_at,
                    "official_status": None,
                    "official_submission": "NOT_PERFORMED",
                    "summary": result.summary,
                    "issuer": result.issuer,
                    "working": result.working,
                    "payment_options": list(result.payment_options),
                    "missing_fields": list(result.missing_fields),
                    "technical": result.technical,
                }
            )

        return _respond(request, operation)

    @extend_schema(
        tags=[_TAG],
        operation_id="fiscal_preparation_update",
        request=sz.FiscalDraftUpdate,
        responses={200: sz.FiscalDraft, **_PROBLEMS},
    )
    def patch(self, request: Request, preparation_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalDraftUpdate, request)
            result = preparations.update_draft(
                actor=_actor(request), preparation_id=preparation_id, **data
            )
            return Response(
                {
                    "preparation_id": str(result.pk),
                    "state": result.state,
                    "version": result.version,
                    "draft": result.draft,
                }
            )

        return _respond(request, operation)


class PreparationReviewView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="fiscal_preparation_review",
        request=sz.Empty,
        responses={200: sz.FiscalReview, **_PROBLEMS},
    )
    def post(self, request: Request, preparation_id: UUID) -> Response:
        return _respond(
            request,
            lambda: Response(
                {
                    "impediments": list(
                        (
                            result := preparations.review(
                                actor=_actor(request), preparation_id=preparation_id
                            )
                        ).impediments
                    ),
                    "review_token": result.token,
                }
            ),
        )


class PreparationPrepareView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="fiscal_preparation_prepare",
        request=sz.FiscalPrepare,
        responses={200: sz.FiscalPreparationResult, **_PROBLEMS},
        description="Prepara una instantánea local; no comunica ni obtiene estado oficial del SRI.",
    )
    def post(self, request: Request, preparation_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalPrepare, request)
            result = preparations.prepare(
                actor=_actor(request),
                preparation_id=preparation_id,
                review_token=data["review_token"],
                idempotency_key=_idempotency_key(request),
            )
            return Response(
                {"preparation_id": str(result.preparation_id), "replayed": result.replayed}
            )

        return _respond(request, operation)


class PreparationCancelView(APIView):
    @extend_schema(
        tags=[_TAG], request=sz.FiscalCancel, responses={200: sz.FiscalDraft, **_PROBLEMS}
    )
    def post(self, request: Request, preparation_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalCancel, request)
            result = preparations.cancel(
                actor=_actor(request), preparation_id=preparation_id, **data
            )
            return Response(
                {
                    "preparation_id": str(result.pk),
                    "state": result.state,
                    "version": result.version,
                    "draft": result.draft,
                }
            )

        return _respond(request, operation)


class PreparationIdentityView(APIView):
    @extend_schema(tags=[_TAG], request=sz.Empty, responses={200: sz.FiscalIdentity, **_PROBLEMS})
    def post(self, request: Request, preparation_id: UUID) -> Response:
        return _respond(
            request,
            lambda: Response(
                {
                    **asdict(
                        assign_test_identity(actor=_actor(request), preparation_id=preparation_id)
                    ),
                    "official_status": None,
                }
            ),
        )


class ArchiveListUploadView(APIView):
    @extend_schema(
        tags=[_TAG],
        parameters=_ARCHIVE_LIST_PARAMETERS,
        responses={200: sz.FiscalArchivePage, **_PROBLEMS},
        description=(
            "Lista paginada de evidencia externa no verificada ante el SRI según el ámbito "
            "del usuario; admite filtros por emisor, ambiente, tipo y fecha de emisión."
        ),
    )
    def get(self, request: Request) -> Response:
        def operation() -> Response:
            params = request.query_params
            result = xml_archive.list_archived_documents(
                actor=_actor(request),
                fiscal_entity_id=_query_int(params, "fiscal_entity_id"),
                environment=params.get("environment") or None,
                document_type=params.get("document_type") or None,
                issued_from=_query_date(params, "issued_from"),
                issued_to=_query_date(params, "issued_to"),
                page=_query_int(params, "page") or 1,
                page_size=_query_int(params, "page_size") or xml_archive.ARCHIVE_PAGE_SIZE_DEFAULT,
            )
            return Response(
                {
                    "count": result.count,
                    "page": result.page,
                    "page_size": result.page_size,
                    "total_pages": result.total_pages,
                    "results": [item._asdict() for item in result.results],
                }
            )

        return _respond(request, operation)

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalArchiveUpload,
        responses={201: sz.FiscalArchiveResult, 413: ProblemSerializer, **_PROBLEMS},
        description="Incorpora XML (máximo 2 MiB) como evidencia externa no verificada.",
    )
    def post(self, request: Request) -> Response:
        def operation() -> Response:
            require_permission(actor=_actor(request), permission="fiscal.archivo.gestionar")
            data = _validated(sz.FiscalArchiveUpload, request)
            content = data["xml"].read(MAX_XML_BYTES + 1)
            if len(content) > MAX_XML_BYTES:
                raise FiscalXmlError("xml_too_large", "El XML excede el tamaño máximo de 2 MiB.")
            result = xml_archive.archive_xml(
                actor=_actor(request),
                fiscal_entity_id=data["fiscal_entity_id"],
                original_bytes=content,
                source_label=data["source_label"],
            )
            return Response({**result._asdict(), "verification": "EXTERNAL_UNVERIFIED"}, status=201)

        return _respond(request, operation)


class ArchiveDownloadView(APIView):
    @extend_schema(tags=[_TAG], responses={(200, "application/xml"): bytes, **_PROBLEMS})
    def get(self, request: Request, dossier_id: UUID) -> HttpResponse:
        try:
            result = xml_archive.download_document(actor=_actor(request), dossier_id=dossier_id)
            response = HttpResponse(result.content, content_type="application/xml")
            response["Content-Disposition"] = f'attachment; filename="{result.filename}"'
            response["Cache-Control"] = "private, no-store"
            response["X-Content-SHA256"] = result.sha256
            return response
        except Exception as exc:
            if isinstance(
                exc,
                (BusinessPermissionDeniedError, FiscalArchiveError, ObjectDoesNotExist),
            ):
                return _problem(request, exc)
            raise


class ArchiveExportView(APIView):
    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalArchiveExport,
        responses={(200, "application/zip"): bytes, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response | FileResponse:
        try:
            data = _validated(sz.FiscalArchiveExport, request)
            # El ZIP se arma en un temporal de disco: los documentos se leen por lotes y
            # el paquete completo no se retiene en memoria. FileResponse cierra (y el
            # sistema elimina) el temporal al terminar de enviarlo.
            # FileResponse asume el cierre del temporal; un `with` lo cerraría antes.
            output = tempfile.TemporaryFile()  # noqa: SIM115
            try:
                with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                    for entry in xml_archive.iter_export_entries(
                        actor=_actor(request), dossier_ids=data["dossier_ids"]
                    ):
                        archive.writestr(entry.filename, entry.content)
                output.seek(0)
            except BaseException:
                output.close()
                raise
            response = FileResponse(output, as_attachment=True, filename="archivo-fiscal.zip")
            response["Cache-Control"] = "private, no-store"
            return response
        except (
            BusinessPermissionDeniedError,
            FiscalArchiveError,
            ObjectDoesNotExist,
        ) as exc:
            return _problem(request, exc)


class ArchiveLinkView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.archivo.gestionar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG], request=sz.FiscalArchiveLink, responses={200: sz.FiscalLinkResult, **_PROBLEMS}
    )
    def post(self, request: Request, dossier_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalArchiveLink, request)
            result = xml_archive.link_dossier(actor=_actor(request), dossier_id=dossier_id, **data)
            return Response(result._asdict())

        return _respond(request, operation)


class CorrectionCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.correcciones.gestionar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        responses={200: sz.FiscalCorrectionSummary(many=True), **_PROBLEMS},
        description="Lista solicitudes locales; ninguna implica ejecución oficial.",
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: Response(
                [
                    item._asdict()
                    for item in corrections.list_correction_requests(actor=_actor(request))
                ]
            ),
        )

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalCorrectionCreate,
        responses={201: sz.FiscalCorrectionResult, **_PROBLEMS},
        description="Registra una solicitud local; no ejecuta una corrección oficial.",
    )
    def post(self, request: Request) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalCorrectionCreate, request)
            facts_data = data.pop("facts")
            lines = data.pop("lines")
            holidays = tuple(facts_data.pop("holidays", []))
            facts = CorrectionFacts(**facts_data, holidays=holidays)
            result = corrections.create_correction_request(
                actor=_actor(request),
                action=CorrectionAction(data.pop("action")),
                requested_lines=lines,
                idempotency_key=_idempotency_key(request),
                facts=facts,
                **data,
            )
            return Response({**result._asdict(), "officially_executed": False}, status=201)

        return _respond(request, operation)


class CorrectionDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.correcciones.gestionar"

    @extend_schema(tags=[_TAG], responses={200: sz.FiscalCorrectionDetail, **_PROBLEMS})
    def get(self, request: Request, request_id: UUID) -> Response:
        return _respond(
            request,
            lambda: Response(
                corrections.get_correction_request(
                    actor=_actor(request), request_id=request_id
                )._asdict()
            ),
        )


class FiscalReadinessView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.archivo.gestionar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(tags=[_TAG], responses={200: sz.FiscalReadiness, **_PROBLEMS})
    def get(self, request: Request) -> Response:
        def operation() -> Response:
            raw_entity_id = request.query_params.get("fiscal_entity_id", "")
            if not raw_entity_id.isdigit() or int(raw_entity_id) < 1:
                raise FiscalArchiveError("La entidad fiscal consultada es inválida.")
            entity_id = int(raw_entity_id)
            return Response(
                readiness.get_readiness(actor=_actor(request), fiscal_entity_id=entity_id).__dict__
            )

        return _respond(request, operation)

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalArchivePolicyWrite,
        responses={200: sz.FiscalReadiness, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalArchivePolicyWrite, request)
            entity_id = data.pop("fiscal_entity_id")
            result = readiness.record_policy(
                actor=_actor(request), fiscal_entity_id=entity_id, data=data
            )
            return Response(result.__dict__)

        return _respond(request, operation)


class FiscalRestorationEvidenceView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.archivo.gestionar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG], request=sz.FiscalRestorationWrite, responses={201: None, **_PROBLEMS}
    )
    def post(self, request: Request) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalRestorationWrite, request)
            restored_at = data.pop("restored_at")
            evidence = readiness.record_restoration(
                actor=_actor(request), restored_at=restored_at, data=data
            )
            return Response({"evidence_id": evidence.id}, status=201)

        return _respond(request, operation)


class CorrectionPrepareView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.correcciones.gestionar"

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalCorrectionPrepare,
        responses={200: sz.FiscalCorrectionResult, **_PROBLEMS},
    )
    def post(self, request: Request, request_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalCorrectionPrepare, request)
            result = corrections.prepare_correction_request(
                actor=_actor(request), request_id=request_id, **data
            )
            return Response({**result._asdict(), "officially_executed": False})

        return _respond(request, operation)


class CorrectionCancelView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.correcciones.gestionar"

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalCorrectionCancel,
        responses={200: sz.FiscalCorrectionResult, **_PROBLEMS},
    )
    def post(self, request: Request, request_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalCorrectionCancel, request)
            result = corrections.cancel_correction_request(
                actor=_actor(request), request_id=request_id, **data
            )
            return Response({**result._asdict(), "officially_executed": False})

        return _respond(request, operation)


def _correction_create_values(data: dict[str, Any]) -> tuple[CorrectionFacts, list[Any]]:
    facts_data = data.pop("facts")
    lines = data.pop("lines")
    holidays = tuple(facts_data.pop("holidays", []))
    return CorrectionFacts(**facts_data, holidays=holidays), lines


class CorrectionReplaceView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.correcciones.gestionar"

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalCorrectionReplace,
        responses={201: sz.FiscalCorrectionResult, **_PROBLEMS},
    )
    def post(self, request: Request, request_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalCorrectionReplace, request)
            facts, lines = _correction_create_values(data)
            data.pop("original_dossier_id", None)
            data.pop("original_identity_id", None)
            result = corrections.replace_correction_request(
                actor=_actor(request),
                request_id=request_id,
                action=CorrectionAction(data.pop("action")),
                requested_lines=lines,
                idempotency_key=_idempotency_key(request),
                facts=facts,
                **data,
            )
            return Response({**result._asdict(), "officially_executed": False}, status=201)

        return _respond(request, operation)


class CorrectionEvidenceView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "fiscal.correcciones.gestionar"

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalCorrectionEvidence,
        responses={204: None, **_PROBLEMS},
    )
    def post(self, request: Request, request_id: UUID) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalCorrectionEvidence, request)
            corrections.link_correction_evidence(
                actor=_actor(request), request_id=request_id, **data
            )
            return Response(status=204)

        return _respond(request, operation)


class _FiscalConfigurationView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset(
        {"POST", "PUT", "PATCH"}
    )


def _profile_payload(profile: Any, entity_id: int) -> dict[str, Any]:
    if profile is None:
        base: dict[str, Any] = {
            "entity_id": entity_id,
            "revision": 0,
            "conditions": {},
            "certificate": None,
        }
    else:
        base = {
            "entity_id": entity_id,
            "revision": profile.revision,
            "conditions": profile.conditions,
            "certificate": profile.certificate,
        }
    return {**base, **describe_profile(profile)}


class ElectronicProfileView(_FiscalConfigurationView):
    @extend_schema(tags=[_TAG], responses={200: sz.FiscalElectronicProfile, **_PROBLEMS})
    def get(self, request: Request, entity_id: int) -> Response:
        return _respond(
            request,
            lambda: Response(
                _profile_payload(get_profile(actor=_actor(request), entity_id=entity_id), entity_id)
            ),
        )

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalElectronicProfileWrite,
        responses={200: sz.FiscalElectronicProfile, **_PROBLEMS},
        description="Conserva metadatos declarados; rechaza certificados o claves privadas.",
    )
    def put(self, request: Request, entity_id: int) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalElectronicProfileWrite, request)
            expected_revision = data.pop("expected_revision")
            profile = save_profile(
                actor=_actor(request),
                entity_id=entity_id,
                expected_revision=expected_revision,
                idempotency_key=_idempotency_key(request),
                payload=data,
            )
            return Response(_profile_payload(profile, entity_id))

        return _respond(request, operation)


def _point_payload(point: Any) -> dict[str, Any]:
    return {
        "id": point.id,
        "establishment_id": point.establishment_id,
        "code": point.code,
        "is_active": point.is_active,
        "version": point.version,
    }


def _establishment_payload(establishment: Any) -> dict[str, Any]:
    return {
        "id": establishment.id,
        "entity_id": establishment.fiscal_entity_id,
        "code": establishment.code,
        "address": establishment.address,
        "is_active": establishment.is_active,
        "version": establishment.version,
        "points": [_point_payload(point) for point in establishment.emission_points.all()],
    }


class EstablishmentListCreateView(_FiscalConfigurationView):
    @extend_schema(tags=[_TAG], responses={200: sz.FiscalEstablishment(many=True), **_PROBLEMS})
    def get(self, request: Request, entity_id: int) -> Response:
        return _respond(
            request,
            lambda: Response(
                [
                    _establishment_payload(item)
                    for item in list_establishments(actor=_actor(request), entity_id=entity_id)
                ]
            ),
        )

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalEstablishmentWrite,
        responses={201: sz.FiscalEstablishment, **_PROBLEMS},
    )
    def post(self, request: Request, entity_id: int) -> Response:
        def operation() -> Response:
            result = create_establishment(
                actor=_actor(request),
                entity_id=entity_id,
                **_validated(sz.FiscalEstablishmentWrite, request),
            )
            return Response(_establishment_payload(result), status=201)

        return _respond(request, operation)


class EstablishmentDetailView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalActiveUpdate,
        responses={200: sz.FiscalEstablishment, **_PROBLEMS},
    )
    def patch(self, request: Request, establishment_id: int) -> Response:
        def operation() -> Response:
            result = set_establishment_active(
                actor=_actor(request),
                establishment_id=establishment_id,
                **_validated(sz.FiscalActiveUpdate, request),
            )
            return Response(_establishment_payload(result))

        return _respond(request, operation)


class PointCreateView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG], request=sz.FiscalPointWrite, responses={201: sz.FiscalPoint, **_PROBLEMS}
    )
    def post(self, request: Request, establishment_id: int) -> Response:
        def operation() -> Response:
            result = create_point(
                actor=_actor(request),
                establishment_id=establishment_id,
                **_validated(sz.FiscalPointWrite, request),
            )
            return Response(_point_payload(result), status=201)

        return _respond(request, operation)


class PointDetailView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG], request=sz.FiscalActiveUpdate, responses={200: sz.FiscalPoint, **_PROBLEMS}
    )
    def patch(self, request: Request, point_id: int) -> Response:
        def operation() -> Response:
            result = set_point_active(
                actor=_actor(request),
                point_id=point_id,
                **_validated(sz.FiscalActiveUpdate, request),
            )
            return Response(_point_payload(result))

        return _respond(request, operation)


def _mapping_response(result: Any) -> dict[str, Any]:
    return {
        "id": result.id,
        "definition_id": result.tax_definition_id,
        "catalog_version": result.catalog_version,
        "percentage_code": result.percentage_code,
        "catalog_entry_id": result.catalog_entry_id,
        "display_name": result.catalog_entry.display_name if result.catalog_entry else None,
        "starts_on": result.starts_on,
        "ends_on": result.ends_on,
        "source": result.source,
    }


class TaxMappingCreateView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalTaxMappingWrite,
        responses={201: sz.FiscalTaxMapping, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        def operation() -> Response:
            result = create_mapping(
                actor=_actor(request), **_validated(sz.FiscalTaxMappingWrite, request)
            )
            return Response(_mapping_response(result), status=201)

        return _respond(request, operation)


class TaxMappingSuccessorView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalTaxMappingSuccessorWrite,
        responses={201: sz.FiscalTaxMapping, **_PROBLEMS},
        description=(
            "Programa el cambio del código del SRI de una correspondencia abierta: la cierra "
            "el día anterior y abre la sucesora. La tarifa interna sucesora debe programarse antes."
        ),
    )
    def post(self, request: Request, mapping_id: int) -> Response:
        def operation() -> Response:
            result = schedule_mapping_successor(
                actor=_actor(request),
                mapping_id=mapping_id,
                **_validated(sz.FiscalTaxMappingSuccessorWrite, request),
            )
            return Response(_mapping_response(result), status=201)

        return _respond(request, operation)


class NumberingAntecedentCreateView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalNumberingAntecedentWrite,
        responses={201: sz.FiscalNumberingAntecedent, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        from fiscal.application.identity import record_numbering_antecedent

        def operation() -> Response:
            result = record_numbering_antecedent(
                actor=_actor(request),
                **_validated(sz.FiscalNumberingAntecedentWrite, request),
            )
            return Response(
                {
                    "id": result.id,
                    "entity_id": result.fiscal_entity_id,
                    "document_type": result.document_type,
                    "establishment_code": result.establishment_code,
                    "emission_point_code": result.emission_point_code,
                    "environment": result.environment,
                    "last_declared_number": result.last_declared_number,
                    "declared_on": result.declared_on,
                    "source": result.source,
                },
                status=201,
            )

        return _respond(request, operation)


def _cause(cause: Any) -> dict[str, str]:
    return {"code": cause.code, "kind": cause.kind, "message": cause.message}


class ElectronicStatusView(_FiscalConfigurationView):
    @extend_schema(tags=[_TAG], responses={200: sz.FiscalElectronicStatus, **_PROBLEMS})
    def get(self, request: Request, entity_id: int) -> Response:
        def operation() -> Response:
            result = get_electronic_status(actor=_actor(request), entity_id=entity_id)
            return Response(
                {
                    "entity_id": result.entity_id,
                    "state": result.state,
                    "causes": [_cause(cause) for cause in result.causes],
                    "warnings": [_cause(cause) for cause in result.warnings],
                    "environment": "TEST",
                    "profile_revision": result.profile_revision,
                    "default_point_id": result.defaults.point_id,
                    "default_payment_code": result.defaults.payment_code,
                }
            )

        return _respond(request, operation)


def _defaults_payload(defaults: Any) -> dict[str, Any]:
    return {
        "entity_id": defaults.entity_id,
        "version": defaults.version,
        "designated_point_id": defaults.designated_point_id,
        "effective_point_id": defaults.point_id,
        "point_issue": defaults.point_issue,
        "default_payment_code": defaults.payment_code,
        "payment_issue": defaults.payment_issue,
    }


class PreparationDefaultsView(_FiscalConfigurationView):
    @extend_schema(tags=[_TAG], responses={200: sz.FiscalPreparationDefaults, **_PROBLEMS})
    def get(self, request: Request, entity_id: int) -> Response:
        return _respond(
            request,
            lambda: Response(
                _defaults_payload(
                    get_preparation_defaults(actor=_actor(request), entity_id=entity_id)
                )
            ),
        )

    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalPreparationDefaultsWrite,
        responses={200: sz.FiscalPreparationDefaults, **_PROBLEMS},
    )
    def put(self, request: Request, entity_id: int) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalPreparationDefaultsWrite, request)
            actor = _actor(request)
            set_preparation_defaults(
                actor=actor,
                entity_id=entity_id,
                idempotency_key=_idempotency_key(request),
                **data,
            )
            return Response(
                _defaults_payload(get_preparation_defaults(actor=actor, entity_id=entity_id))
            )

        return _respond(request, operation)


def _entry_payload(entry: Any) -> dict[str, Any]:
    return {
        "id": entry.id,
        "kind": entry.kind,
        "catalog_version": entry.catalog_version,
        "code": entry.code,
        "description": entry.description,
        "display_name": entry.display_name,
        "tax_code": entry.tax_code,
        "rate": str(entry.rate.normalize()) if entry.rate is not None else None,
        "treatment": entry.treatment,
        "source_document": entry.source_document,
        "source_version": entry.source_version,
        "source_reference": entry.source_reference,
        "source_url": entry.source_url,
        "downloaded_on": entry.downloaded_on,
        "valid_from": entry.valid_from,
        "valid_to": entry.valid_to,
        "validity_note": entry.validity_note,
        "is_active": entry.is_active,
        "is_selectable": entry.is_selectable,
        "incorporated_at": entry.incorporated_at,
    }


class CatalogView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG],
        parameters=[
            OpenApiParameter(
                "selectable", OpenApiTypes.BOOL, description="Solo entradas seleccionables."
            )
        ],
        responses={200: sz.FiscalCatalogEntry(many=True), **_PROBLEMS},
    )
    def get(self, request: Request, kind: str) -> Response:
        def operation() -> Response:
            entries = get_catalog(
                actor=_actor(request),
                kind=kind.upper().replace("-", "_"),
                selectable_only=request.query_params.get("selectable") in ("1", "true"),
            )
            return Response([_entry_payload(entry) for entry in entries])

        return _respond(request, operation)


class EntityTaxMappingListView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG], responses={200: sz.FiscalTaxMappingListItem(many=True), **_PROBLEMS}
    )
    def get(self, request: Request, entity_id: int) -> Response:
        def operation() -> Response:
            today = timezone.localdate()
            rows = []
            for mapping in list_mappings(actor=_actor(request), entity_id=entity_id):
                entry = mapping.catalog_entry
                covers = mapping.starts_on <= today and (
                    mapping.ends_on is None or mapping.ends_on >= today
                )
                rows.append(
                    {
                        "id": mapping.id,
                        "definition_id": mapping.tax_definition_id,
                        "definition_name": mapping.tax_definition.name,
                        "catalog_version": mapping.catalog_version,
                        "percentage_code": mapping.percentage_code,
                        "catalog_entry_id": mapping.catalog_entry_id,
                        "display_name": entry.display_name if entry else None,
                        "rate": str(entry.rate.normalize()) if entry and entry.rate else None,
                        "treatment": entry.treatment if entry else None,
                        "starts_on": mapping.starts_on,
                        "ends_on": mapping.ends_on,
                        "source": mapping.source,
                        "is_current": bool(covers and entry and is_current(entry, today)),
                    }
                )
            return Response(rows)

        return _respond(request, operation)


def _payment_option(option: Any) -> dict[str, Any]:
    return {
        "code": option.code,
        "description": option.description,
        "display_name": option.display_name,
        "catalog_version": option.catalog_version,
        "source_document": option.source_document,
        "source_version": option.source_version,
        "source_url": option.source_url,
        "downloaded_on": option.downloaded_on,
        "valid_from": option.valid_from,
        "valid_to": option.valid_to,
        "is_current": option.is_current,
        "enableable": option.enableable,
        "enabled": option.enabled,
        "is_default": option.is_default,
        "internal_method": option.internal_method,
        "version": option.version,
    }


class PaymentFormListView(_FiscalConfigurationView):
    @extend_schema(tags=[_TAG], responses={200: sz.FiscalPaymentFormOption(many=True), **_PROBLEMS})
    def get(self, request: Request, entity_id: int) -> Response:
        return _respond(
            request,
            lambda: Response(
                [
                    _payment_option(option)
                    for option in get_payment_forms(actor=_actor(request), entity_id=entity_id)
                ]
            ),
        )


class PaymentFormDetailView(_FiscalConfigurationView):
    @extend_schema(
        tags=[_TAG],
        request=sz.FiscalPaymentFormWrite,
        responses={200: sz.FiscalPaymentFormOption(many=True), **_PROBLEMS},
    )
    def put(self, request: Request, entity_id: int, code: str) -> Response:
        def operation() -> Response:
            data = _validated(sz.FiscalPaymentFormWrite, request)
            actor = _actor(request)
            set_payment_form_enabled(
                actor=actor,
                entity_id=entity_id,
                code=code,
                idempotency_key=_idempotency_key(request),
                **data,
            )
            return Response(
                [_payment_option(o) for o in get_payment_forms(actor=actor, entity_id=entity_id)]
            )

        return _respond(request, operation)
