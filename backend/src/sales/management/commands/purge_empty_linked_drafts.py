"""Limpia borradores de venta vinculados a mantenimientos que quedaron sin líneas.

Por omisión solo informa; ``--confirm`` elimina y audita cada borrador. No toca ventas
confirmadas o anuladas, borradores directos ni borradores vinculados con líneas.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from sales.application.workshop_links import purge_empty_linked_drafts


class Command(BaseCommand):
    help = "Informa o elimina (--confirm) los borradores de venta vinculados vacíos."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Elimina los borradores listados; sin esta opción solo se informan.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        confirm = bool(options["confirm"])
        rows = purge_empty_linked_drafts(confirm=confirm)
        for row in rows:
            order = row["order_number"] or f"orden {row['order_id']}"
            self.stdout.write(f"- venta {row['sale_id']} ({order})")
        noun = "borrador vinculado vacío" if len(rows) == 1 else "borradores vinculados vacíos"
        if confirm:
            self.stdout.write(f"{len(rows)} {noun} eliminado(s).")
        else:
            self.stdout.write(
                f"{len(rows)} {noun} por eliminar. Ejecute con --confirm para eliminarlos."
            )
