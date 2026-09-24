"""Elimina archivos de fotografías sin registro vigente; idempotente y repetible."""

from typing import Any

import structlog
from django.core.management.base import BaseCommand, CommandParser

from workshop.application import photo_storage
from workshop.models import OrderPhoto

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Elimina fotografías huérfanas o retiradas más antiguas que el margen indicado."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--older-than-minutes",
            type=int,
            default=60,
            help="Margen para no competir con cargas en curso (por omisión 60).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        minutes = max(0, int(options["older_than_minutes"]))
        referenced: set[str] = set()
        for original, thumbnail in OrderPhoto.objects.filter(removed_at__isnull=True).values_list(
            "storage_name", "thumbnail_name"
        ):
            referenced.update((original, thumbnail))
        orphans = [
            name for name in photo_storage.iter_stored_files(minutes * 60) if name not in referenced
        ]
        photo_storage.delete_files(*orphans)
        logger.info("workshop_files_purged", deleted=len(orphans), older_than_minutes=minutes)
        self.stdout.write(f"Archivos eliminados: {len(orphans)}")
