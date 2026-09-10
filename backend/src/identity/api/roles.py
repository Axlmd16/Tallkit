from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from identity.api.permissions import HasBusinessPermission
from identity.domain.authorization import ROLE_PERMISSIONS, Role


class RoleReadSerializer(serializers.Serializer[dict[str, object]]):
    code = serializers.ChoiceField(choices=[role.value for role in Role])
    permissions = serializers.ListField(child=serializers.CharField())


class RoleListView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "roles.ver"

    @extend_schema(responses={200: RoleReadSerializer(many=True)})
    def get(self, request: Request) -> Response:
        return Response(
            [
                {
                    "code": role.value,
                    "permissions": sorted(ROLE_PERMISSIONS[role]),
                }
                for role in Role
            ]
        )
