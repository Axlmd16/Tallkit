"""Concilia posiciones, movimientos y operaciones de inventario; solo lectura.

Termina con código distinto de cero si existen diferencias. No ofrece ``--fix``: una
reparación real exige diagnóstico y un procedimiento explícito.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from inventory.application.reconciliation import reconcile


class Command(BaseCommand):
    help = "Concilia el inventario contra su historia inmutable (solo lectura)."

    def handle(self, *args: Any, **options: Any) -> None:
        differences = reconcile()
        if not differences:
            self.stdout.write("Inventario conciliado: sin diferencias.")
            return
        for difference in differences:
            self.stderr.write(difference.render())
        raise CommandError(f"Se encontraron {len(differences)} diferencias de inventario.")
