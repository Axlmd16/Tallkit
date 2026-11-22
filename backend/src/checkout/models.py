from typing import ClassVar

from django.conf import settings
from django.db import models


class CheckoutReceipt(models.Model):
    """Recibo técnico de idempotencia para solicitudes compuestas de «Cobrar y facturar».

    No almacena hechos económicos (que siguen viviendo separados en sales, workshop y fiscal).
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    action = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField(default=200)
    response_payload = models.JSONField(default=dict)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "checkout_receipt"
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["actor", "action", "idempotency_key"],
                name="uq_checkout_receipt_actor_action_key",
            )
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"
