"""Registro cerrado de esquemas XSD del SRI conservados localmente."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from functools import cache, lru_cache
from pathlib import Path
from typing import Any, cast

from lxml import etree

_SCHEMA_DIR = Path(__file__).with_name("sri_schemas")
_MANIFEST_PATH = _SCHEMA_DIR / "manifest.json"


class SchemaNotSupportedError(ValueError):
    pass


@dataclass(frozen=True)
class LocalSchema:
    document_type: str
    version: str
    path: Path
    sha256: str
    source_url: str
    source_archive_sha256: str
    retrieved_on: date


@dataclass(frozen=True)
class SchemaDependency:
    filename: str
    path: Path
    sha256: str
    source_url: str


def _manifest() -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(_MANIFEST_PATH.read_text(encoding="utf-8")))


@lru_cache(maxsize=1)
def supported_schemas() -> tuple[LocalSchema, ...]:
    payload = _manifest()
    retrieved_on = date.fromisoformat(payload["retrieved_on"])
    return tuple(
        LocalSchema(
            document_type=item["document_type"],
            version=item["version"],
            path=_SCHEMA_DIR / item["filename"],
            sha256=item["sha256"],
            source_url=item["source_url"],
            source_archive_sha256=item["source_archive_sha256"],
            retrieved_on=retrieved_on,
        )
        for item in payload["schemas"]
    )


@lru_cache(maxsize=1)
def schema_dependencies() -> tuple[SchemaDependency, ...]:
    return tuple(
        SchemaDependency(
            filename=item["filename"],
            path=_SCHEMA_DIR / item["filename"],
            sha256=item["sha256"],
            source_url=item["source_url"],
        )
        for item in _manifest()["dependencies"]
    )


def get_local_schema(*, document_type: str, version: str) -> LocalSchema:
    for schema in supported_schemas():
        if schema.document_type == document_type and schema.version == version:
            return schema
    raise SchemaNotSupportedError(
        f"Versión de esquema no admitida: tipo={document_type}, versión={version}."
    )


class _ManifestResolver(etree.Resolver):
    def resolve(self, system_url: str, public_id: str, *args: Any) -> Any:
        del public_id
        requested = Path(system_url).name
        for dependency in schema_dependencies():
            if requested == dependency.filename:
                context = args[0] if args else None
                return self.resolve_file(
                    dependency.path.open("rb"),
                    context,
                    base_url=dependency.path.as_uri(),
                    close=True,
                )
        raise OSError("El esquema solicitó una dependencia externa no admitida.")


@cache
def compile_local_schema(*, document_type: str, version: str) -> etree.XMLSchema:
    schema = get_local_schema(document_type=document_type, version=version)
    parser = etree.XMLParser(
        load_dtd=False,
        no_network=True,
        recover=False,
        resolve_entities=False,
        huge_tree=False,
    )
    parser.resolvers.add(_ManifestResolver())
    document = etree.fromstring(
        schema.path.read_bytes(), parser=parser, base_url=schema.path.as_uri()
    )
    return etree.XMLSchema(document)
