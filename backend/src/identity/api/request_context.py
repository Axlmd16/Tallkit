from uuid import UUID

from rest_framework.request import Request


def request_id_from(request: Request) -> UUID | None:
    value = getattr(request, "request_id", None)
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None
