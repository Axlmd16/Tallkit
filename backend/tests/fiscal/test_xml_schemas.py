from __future__ import annotations

import hashlib

import pytest
from tests.fiscal.xml_samples import synthetic_credit_note, synthetic_invoice

from fiscal.infrastructure.xml_schemas import (
    SchemaNotSupportedError,
    compile_local_schema,
    get_local_schema,
    schema_dependencies,
    supported_schemas,
)

EXPECTED_SCHEMAS = {
    ("01", "1.0.0"),
    ("01", "1.1.0"),
    ("01", "2.0.0"),
    ("01", "2.1.0"),
    ("04", "1.0.0"),
    ("04", "1.1.0"),
}


def test_manifest_exposes_only_the_reviewed_official_schema_versions() -> None:
    schemas = supported_schemas()

    assert {(schema.document_type, schema.version) for schema in schemas} == EXPECTED_SCHEMAS
    assert all(schema.source_url.startswith("https://www.sri.gob.ec/") for schema in schemas)
    assert all(schema.retrieved_on.isoformat() == "2026-09-26" for schema in schemas)


@pytest.mark.parametrize(("document_type", "version"), sorted(EXPECTED_SCHEMAS))
def test_manifest_hash_matches_the_exact_vendored_schema(document_type: str, version: str) -> None:
    schema = get_local_schema(document_type=document_type, version=version)

    assert schema.path.is_file()
    assert schema.path.parent.name == "sri_schemas"
    assert hashlib.sha256(schema.path.read_bytes()).hexdigest() == schema.sha256


def test_unknown_schema_version_is_rejected_without_fallback() -> None:
    with pytest.raises(SchemaNotSupportedError, match="Versión de esquema no admitida"):
        get_local_schema(document_type="01", version="9.9.9")


def test_manifest_tracks_and_verifies_the_only_local_schema_dependency() -> None:
    dependencies = schema_dependencies()

    assert len(dependencies) == 1
    dependency = dependencies[0]
    assert dependency.filename == "xmldsig-core-schema.xsd"
    assert dependency.source_url == ("https://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd")
    assert hashlib.sha256(dependency.path.read_bytes()).hexdigest() == dependency.sha256


@pytest.mark.parametrize(("document_type", "version"), sorted(EXPECTED_SCHEMAS))
def test_every_supported_official_schema_compiles_with_local_dependencies_only(
    document_type: str, version: str
) -> None:
    compiled = compile_local_schema(document_type=document_type, version=version)

    assert compiled is not None


@pytest.mark.parametrize(
    ("document_type", "version", "fixture_factory"),
    [
        ("01", "1.0.0", synthetic_invoice),
        ("01", "1.1.0", synthetic_invoice),
        ("01", "2.0.0", synthetic_invoice),
        ("01", "2.1.0", synthetic_invoice),
        ("04", "1.0.0", synthetic_credit_note),
        ("04", "1.1.0", synthetic_credit_note),
    ],
)
def test_synthetic_fixture_exists_and_validates_for_every_supported_version(
    document_type: str, version: str, fixture_factory: object
) -> None:
    from lxml import etree

    document = fixture_factory(version)  # type: ignore[operator]
    schema = compile_local_schema(document_type=document_type, version=version)

    assert schema.validate(etree.fromstring(document))
