"""Elimina archivos de logotipos sin registro vigente; idempotente y repetible."""

from typing import Any

import structlog
from django.core.management.base import BaseCommand, CommandParser

from workshop_configuration.application import logo_storage
from workshop_configuration.models import FiscalEntityLogo

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Elimina logotipos de entidades reemplazados o huérfanos más antiguos que el margen."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--older-than-minutes",
            type=int,
            default=60,
            help="Margen para no competir con cargas en curso (por omisión 60).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        minutes = max(0, int(options["older_than_minutes"]))
        referenced = set(FiscalEntityLogo.objects.values_list("storage_name", flat=True))
        orphans = [
            name for name in logo_storage.iter_logo_files(minutes * 60) if name not in referenced
        ]
        logo_storage.delete_files(*orphans)
        logger.info("entity_logos_purged", deleted=len(orphans), older_than_minutes=minutes)
        self.stdout.write(f"Archivos eliminados: {len(orphans)}")
