import pytest

from identity.domain.authorization import ROLE_PERMISSIONS, Role, effective_permissions

ADMINISTRATOR_PERMISSIONS = {
    "auditoria.ver",
    "cierres.gestionar",
    "clientes.desactivar",
    "clientes.gestionar",
    "clientes.ver",
    "entidades_fiscales.editar",
    "entidades_fiscales.ver",
    "ingresos.anular",
    "ingresos.confirmar",
    "ingresos.crear",
    "ingresos.ver",
    "inventario.ajustar",
    "inventario.configurar_alertas",
    "inventario.consumo_interno",
    "inventario.desarmar_kit",
    "inventario.devolver_proveedor",
    "inventario.reposicion_correccion",
    "inventario.ver",
    "inventario.ver_valorizacion",
    "mantenimientos.cambiar_precio_servicio",
    "mantenimientos.cancelar",
    "mantenimientos.finalizar",
    "mantenimientos.gestionar",
    "mantenimientos.gestionar_fotos",
    "mantenimientos.gestionar_repuestos",
    "mantenimientos.reabrir",
    "mantenimientos.ver",
    "marcas_vehiculo.desactivar",
    "marcas_vehiculo.gestionar",
    "marcas_vehiculo.ver",
    "operacion.actualizar",
    "operacion.respaldar",
    "operacion.restaurar",
    "operacion.ver_estado",
    "pagos_artesanales.anular",
    "pagos_artesanales.registrar",
    "pagos_artesanales.ver",
    "pagos_comerciales.anular",
    "pagos_comerciales.registrar",
    "pagos_comerciales.ver",
    "parametros.gestionar",
    "productos.cambiar_precio",
    "productos.desactivar",
    "productos.gestionar",
    "productos.ver",
    "productos.ver_costos",
    "proformas.anular",
    "proformas.convertir",
    "proformas.gestionar",
    "proformas.ver",
    "proveedores.gestionar",
    "proveedores.ver",
    "reportes.artesanales",
    "reportes.auditoria",
    "reportes.comerciales",
    "reportes.inventario",
    "roles.asignar",
    "roles.ver",
    "servicios.gestionar",
    "servicios.ver",
    "servicios_economicos.anular",
    "servicios_economicos.confirmar",
    "servicios_economicos.ver",
    "usuarios.crear",
    "usuarios.desactivar",
    "usuarios.editar",
    "usuarios.restablecer_clave",
    "usuarios.ver",
    "vehiculos.desactivar",
    "vehiculos.gestionar",
    "vehiculos.ver",
    "ventas.anular",
    "ventas.confirmar",
    "ventas.crear",
    "ventas.devolver",
    "ventas.preparar_vinculada",
    "ventas.ver",
}

EXPECTED_PERMISSIONS = {
    Role.ADMINISTRADOR: ADMINISTRATOR_PERMISSIONS,
    Role.VENDEDOR: {
        "clientes.gestionar",
        "clientes.ver",
        "inventario.consumo_interno",
        "inventario.ver",
        "pagos_comerciales.registrar",
        "pagos_comerciales.ver",
        "productos.ver",
        "proformas.anular",
        "proformas.convertir",
        "proformas.gestionar",
        "proformas.ver",
        "reportes.comerciales",
        "reportes.inventario",
        "servicios.ver",
        "marcas_vehiculo.ver",
        "vehiculos.ver",
        "ventas.confirmar",
        "ventas.crear",
        "ventas.ver",
    },
    Role.ENCARGADO_TALLER: {
        "clientes.gestionar",
        "clientes.ver",
        "inventario.ver",
        "mantenimientos.cambiar_precio_servicio",
        "mantenimientos.cancelar",
        "mantenimientos.finalizar",
        "mantenimientos.gestionar",
        "mantenimientos.gestionar_fotos",
        "mantenimientos.gestionar_repuestos",
        "mantenimientos.reabrir",
        "mantenimientos.ver",
        "marcas_vehiculo.gestionar",
        "marcas_vehiculo.ver",
        "pagos_artesanales.registrar",
        "pagos_artesanales.ver",
        "productos.ver",
        "reportes.artesanales",
        "reportes.inventario",
        "servicios.gestionar",
        "servicios.ver",
        "servicios_economicos.confirmar",
        "servicios_economicos.ver",
        "vehiculos.gestionar",
        "vehiculos.ver",
        "ventas.preparar_vinculada",
    },
}


def test_roles_are_the_closed_v1_catalog() -> None:
    assert {role.value for role in Role} == {
        "ADMINISTRADOR",
        "VENDEDOR",
        "ENCARGADO_TALLER",
    }


def test_permission_catalog_matches_the_approved_business_matrix() -> None:
    assert {role: set(permissions) for role, permissions in ROLE_PERMISSIONS.items()} == (
        EXPECTED_PERMISSIONS
    )


def test_effective_permissions_are_the_union_of_assigned_roles() -> None:
    permissions = effective_permissions({Role.VENDEDOR, Role.ENCARGADO_TALLER})

    assert "ventas.confirmar" in permissions
    assert "mantenimientos.finalizar" in permissions
    assert "usuarios.crear" not in permissions


def test_removing_a_role_removes_its_exclusive_permissions() -> None:
    before = effective_permissions({Role.VENDEDOR, Role.ENCARGADO_TALLER})
    after = effective_permissions({Role.ENCARGADO_TALLER})

    assert "ventas.confirmar" in before
    assert "ventas.confirmar" not in after


def test_no_roles_and_unknown_permissions_are_denied_by_default() -> None:
    assert effective_permissions(set()) == frozenset()
    assert "permiso.inexistente" not in effective_permissions({Role.ADMINISTRADOR})


@pytest.mark.parametrize(
    ("role", "permission"),
    [
        (Role.ENCARGADO_TALLER, "ventas.ver"),
        (Role.VENDEDOR, "mantenimientos.ver"),
    ],
)
def test_linked_access_is_not_granted_as_a_global_permission(role: Role, permission: str) -> None:
    assert permission not in effective_permissions({role})


def test_vehicle_brand_permissions_grants_and_denials() -> None:
    admin_perms = effective_permissions({Role.ADMINISTRADOR})
    vendedor_perms = effective_permissions({Role.VENDEDOR})
    encargado_perms = effective_permissions({Role.ENCARGADO_TALLER})

    # Consulta permitida a los tres roles
    assert "marcas_vehiculo.ver" in admin_perms
    assert "marcas_vehiculo.ver" in vendedor_perms
    assert "marcas_vehiculo.ver" in encargado_perms

    # Gestionar (crear/editar) permitido a Administrador y Encargado del taller
    assert "marcas_vehiculo.gestionar" in admin_perms
    assert "marcas_vehiculo.gestionar" in encargado_perms
    assert "marcas_vehiculo.gestionar" not in vendedor_perms

    # Desactivar/reactivar permitido únicamente a Administrador
    assert "marcas_vehiculo.desactivar" in admin_perms
    assert "marcas_vehiculo.desactivar" not in encargado_perms
    assert "marcas_vehiculo.desactivar" not in vendedor_perms


def test_vehicle_brand_permissions_in_role_combinations() -> None:
    # Vendedor + Encargado adquiere ver y gestionar, pero no desactivar
    combo = effective_permissions({Role.VENDEDOR, Role.ENCARGADO_TALLER})
    assert "marcas_vehiculo.ver" in combo
    assert "marcas_vehiculo.gestionar" in combo
    assert "marcas_vehiculo.desactivar" not in combo

    # Unión con Administrador adquiere los tres permisos
    combo_admin = effective_permissions({Role.VENDEDOR, Role.ADMINISTRADOR})
    assert "marcas_vehiculo.ver" in combo_admin
    assert "marcas_vehiculo.gestionar" in combo_admin
    assert "marcas_vehiculo.desactivar" in combo_admin
