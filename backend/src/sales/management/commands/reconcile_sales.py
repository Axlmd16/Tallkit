"""Concilia las ventas comerciales contra sus hechos registrados; solo lectura.

Termina con código distinto de cero si existen diferencias. No ofrece ``--fix``: una
corrección de saldos o cantidades exige diagnóstico y un procedimiento explícito.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from sales.application.reconciliation import reconcile


class Command(BaseCommand):
    help = "Concilia ventas, pagos, devoluciones y reembolsos (solo lectura)."

    def handle(self, *args: Any, **options: Any) -> None:
        differences = reconcile()
        if not differences:
            self.stdout.write("Ventas conciliadas: sin diferencias.")
            return
        for difference in differences:
            self.stderr.write(difference.render())
        raise CommandError(f"Se encontraron {len(differences)} diferencias comerciales.")
