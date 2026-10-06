"""Interfaz pública de marca del emisor para consumidores internos ya autorizados.

Entrega la identidad visible de una entidad fiscal y los bytes normalizados de su logotipo
vigente, o la ausencia explícita de logotipo. No recibe actor ni exige el permiso
administrativo de configuración: quien consume ya autorizó su propia acción. Nunca expone la
ruta de almacenamiento.

Dos pasos, para no leer ni decodificar archivos dentro de una sección crítica:

- ``read_entity_brand``: lectura previa, sin bloqueos, que verifica tamaño e imagen;
- ``lock_brand_identity``: bajo la transacción del consumidor, bloquea la entidad (la misma
  fila que serializa la carga y el retiro del logotipo) y devuelve solo la identidad, para
  comprobar que sigue siendo la revisada.

Un logotipo configurado cuyo archivo falta o no coincide es un error corregible, no una omisión.
"""

import hashlib
from dataclasses import dataclass
from io import BytesIO

from django.db import transaction
from PIL import Image, UnidentifiedImageError

from workshop_configuration.application import logo_storage
from workshop_configuration.domain.logo_rules import MAX_BYTES
from workshop_configuration.models import FiscalEntity, FiscalEntityLogo


class BrandUnavailableError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class BrandIdentity:
    entity_id: int
    entity_type: str
    ruc: str
    legal_name: str
    trade_name: str | None
    address: str | None
    phone: str | None
    email: str | None
    logo_revision: int
    # Huella de la carga vigente (o ``None`` sin logotipo); cambia al reemplazarlo o retirarlo.
    logo_sha256: str | None


@dataclass(frozen=True)
class BrandAsset:
    content: bytes
    content_type: str
    size: int
    sha256: str


@dataclass(frozen=True)
class EntityBrand:
    identity: BrandIdentity
    asset: BrandAsset | None


def _identity(entity: FiscalEntity, logo: FiscalEntityLogo | None) -> BrandIdentity:
    return BrandIdentity(
        entity_id=entity.pk,
        entity_type=entity.entity_type,
        ruc=entity.ruc,
        legal_name=entity.legal_name,
        trade_name=entity.trade_name,
        address=entity.address,
        phone=entity.phone,
        email=entity.email,
        logo_revision=entity.logo_revision,
        logo_sha256=logo.sha256 if logo else None,
    )


def _missing(entity_type: str) -> BrandUnavailableError:
    return BrandUnavailableError("missing_entity", f"No existe la entidad fiscal {entity_type}.")


def _unreadable() -> BrandUnavailableError:
    return BrandUnavailableError(
        "logo_unreadable",
        "El logotipo configurado no puede leerse. Vuelva a cargarlo o retírelo.",
    )


def _read_asset(logo: FiscalEntityLogo) -> BrandAsset:
    """Bytes normalizados guardados al cargar el logotipo, verificados sin confiar en el disco.

    ``logo.sha256`` identifica la carga original, no el archivo normalizado: la integridad del
    archivo se comprueba con el tamaño registrado y decodificando la imagen. El hash del
    activo se calcula sobre los bytes realmente leídos.
    """
    try:
        with logo_storage.open_file(logo.storage_name) as handle:
            content = handle.read(MAX_BYTES + 1)
    except OSError:
        raise _unreadable() from None
    if not content or len(content) > MAX_BYTES or len(content) != logo.size_bytes:
        raise _unreadable()
    try:
        with Image.open(BytesIO(content)) as probe:
            probe.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise _unreadable() from None
    return BrandAsset(
        content=content,
        content_type=logo.content_type,
        size=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
    )


def read_entity_brand(entity_type: str) -> EntityBrand:
    """Identidad y bytes del logotipo vigente, sin bloqueos; se llama antes de la transacción."""
    entity = FiscalEntity.objects.filter(entity_type=entity_type).first()
    if entity is None:
        raise _missing(entity_type)
    logo = FiscalEntityLogo.objects.filter(fiscal_entity=entity).first()
    asset = _read_asset(logo) if logo is not None else None
    return EntityBrand(identity=_identity(entity, logo), asset=asset)


def lock_brand_identity(entity_type: str) -> BrandIdentity:
    """Identidad vigente bajo bloqueo de la entidad; no abre ni decodifica el archivo."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("La identidad de marca bloqueada requiere una transacción exterior.")
    entity = FiscalEntity.objects.select_for_update().filter(entity_type=entity_type).first()
    if entity is None:
        raise _missing(entity_type)
    logo = FiscalEntityLogo.objects.filter(fiscal_entity=entity).first()
    return _identity(entity, logo)
