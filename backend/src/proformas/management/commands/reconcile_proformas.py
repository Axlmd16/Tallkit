"""Concilia las proformas convertidas contra los vínculos de ventas; solo lectura.

Termina con código distinto de cero si existen diferencias. No ofrece ``--fix``: una
discrepancia exige diagnóstico y un procedimiento explícito.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from proformas.application.reconciliation import reconcile


class Command(BaseCommand):
    help = "Concilia proformas convertidas y ventas vinculadas (solo lectura)."

    def handle(self, *args: Any, **options: Any) -> None:
        differences = reconcile()
        if not differences:
            self.stdout.write("Proformas conciliadas: sin diferencias.")
            return
        for difference in differences:
            self.stderr.write(difference.render())
        raise CommandError(f"Se encontraron {len(differences)} diferencias de proformas.")
