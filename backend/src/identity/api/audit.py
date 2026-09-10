from math import ceil

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, problem_response
from identity.api.permissions import HasBusinessPermission
from identity.models import AuditEvent, AuditResult


class AuditActorSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    username = serializers.CharField()


class AuditEventReadSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    actor = AuditActorSerializer(allow_null=True)
    action = serializers.CharField()
    target_type = serializers.CharField()
    target_id = serializers.CharField()
    result = serializers.ChoiceField(choices=AuditResult.choices)
    occurred_at = serializers.DateTimeField()
    reason = serializers.CharField(allow_null=True)
    request_id = serializers.UUIDField(allow_null=True)
    operation_id = serializers.UUIDField(allow_null=True)
    metadata = serializers.JSONField()


class AuditEventPageSerializer(serializers.Serializer[dict[str, object]]):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = AuditEventReadSerializer(many=True)


def _event_data(event: AuditEvent) -> dict[str, object]:
    return {
        "id": event.pk,
        "actor": (
            {"id": event.actor_id, "username": event.actor.username}
            if event.actor is not None
            else None
        ),
        "action": event.action,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "result": event.result,
        "occurred_at": timezone.localtime(event.occurred_at).isoformat(),
        "reason": event.reason or None,
        "request_id": str(event.request_id) if event.request_id else None,
        "operation_id": str(event.operation_id) if event.operation_id else None,
        "metadata": event.metadata,
    }


def _invalid_filters(request: Request, detail: str) -> Response:
    return problem_response(
        request=request,
        status_code=400,
        title="Filtros inválidos",
        code="invalid_filters",
        detail=detail,
    )


class AuditEventListView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "auditoria.ver"

    @extend_schema(
        operation_id="identity_audit_list",
        parameters=[
            OpenApiParameter("user", OpenApiTypes.INT),
            OpenApiParameter("from", OpenApiTypes.DATETIME),
            OpenApiParameter("to", OpenApiTypes.DATETIME),
            OpenApiParameter("action", OpenApiTypes.STR),
            OpenApiParameter("target_type", OpenApiTypes.STR),
            OpenApiParameter("target_id", OpenApiTypes.STR),
            OpenApiParameter(
                "result",
                OpenApiTypes.STR,
                enum=[result.value for result in AuditResult],
            ),
            OpenApiParameter("page", OpenApiTypes.INT),
            OpenApiParameter("page_size", OpenApiTypes.INT),
        ],
        responses={
            200: AuditEventPageSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
    )
    def get(self, request: Request) -> Response:
        events = AuditEvent.objects.select_related("actor").all()
        try:
            if user_id := request.query_params.get("user"):
                events = events.filter(actor_id=int(user_id))
            if action := request.query_params.get("action"):
                events = events.filter(action=action)
            if target_type := request.query_params.get("target_type"):
                events = events.filter(target_type=target_type)
            if target_id := request.query_params.get("target_id"):
                events = events.filter(target_id=target_id)
            if result := request.query_params.get("result"):
                events = events.filter(result=AuditResult(result))
            if start_text := request.query_params.get("from"):
                start = parse_datetime(start_text)
                if start is None:
                    raise ValueError("La fecha inicial no es válida.")
                events = events.filter(occurred_at__gte=start)
            if end_text := request.query_params.get("to"):
                end = parse_datetime(end_text)
                if end is None:
                    raise ValueError("La fecha final no es válida.")
                events = events.filter(occurred_at__lte=end)
            page = int(request.query_params.get("page", "1"))
            page_size = min(int(request.query_params.get("page_size", "20")), 100)
            if page < 1 or page_size < 1:
                raise ValueError("La página y su tamaño deben ser positivos.")
        except (TypeError, ValueError) as exc:
            return _invalid_filters(request, str(exc))

        total = events.count()
        start_index = (page - 1) * page_size
        page_events = events[start_index : start_index + page_size]
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "total_pages": ceil(total / page_size),
                "results": [_event_data(event) for event in page_events],
            }
        )


class AuditEventDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "auditoria.ver"

    @extend_schema(
        operation_id="identity_audit_retrieve",
        responses={200: AuditEventReadSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request, event_id: int) -> Response:
        event = get_object_or_404(AuditEvent.objects.select_related("actor"), pk=event_id)
        return Response(_event_data(event))
