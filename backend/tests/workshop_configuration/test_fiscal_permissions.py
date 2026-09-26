"""El resumen comercial del Encargado no habilita acceso fiscal comercial."""

from itertools import combinations

import pytest

from identity.domain.authorization import Role, effective_permissions


@pytest.mark.parametrize("roles", [frozenset(c) for n in range(4) for c in combinations(Role, n)])
def test_fiscal_access_is_union_of_authorized_issuer_roles(roles: frozenset[Role]) -> None:
    permissions = effective_permissions(roles)
    commercial = bool(roles & {Role.ADMINISTRADOR, Role.VENDEDOR})
    artisan = bool(roles & {Role.ADMINISTRADOR, Role.ENCARGADO_TALLER})
    assert ("fiscal.comercial.preparar" in permissions) == commercial
    assert ("fiscal.comercial.ver" in permissions) == commercial
    assert ("fiscal.artesanal.preparar" in permissions) == artisan
    assert ("fiscal.artesanal.ver" in permissions) == artisan
    assert ("fiscal.archivo.gestionar" in permissions) == (Role.ADMINISTRADOR in roles)
    assert ("fiscal.correcciones.gestionar" in permissions) == (Role.ADMINISTRADOR in roles)
