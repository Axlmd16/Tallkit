from collections.abc import Iterable, Mapping
from enum import StrEnum


class Role(StrEnum):
    ADMINISTRADOR = "ADMINISTRADOR"
    VENDEDOR = "VENDEDOR"
    ENCARGADO_TALLER = "ENCARGADO_TALLER"


_SHARED_CATALOG_PERMISSIONS = frozenset(
    {
        "clientes.gestionar",
        "clientes.ver",
        "inventario.ver",
        "marcas_vehiculo.ver",
        "productos.ver",
        "reportes.inventario",
        "servicios.ver",
        "vehiculos.ver",
    }
)

ROLE_PERMISSIONS: Mapping[Role, frozenset[str]] = {
    Role.ADMINISTRADOR: frozenset(
        {
            "auditoria.ver",
            "cierres.gestionar",
            "clientes.desactivar",
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
            "roles.asignar",
            "roles.ver",
            "servicios.gestionar",
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
            "ventas.anular",
            "ventas.confirmar",
            "ventas.crear",
            "ventas.devolver",
            "ventas.preparar_vinculada",
            "ventas.ver",
        }
    )
    | _SHARED_CATALOG_PERMISSIONS,
    Role.VENDEDOR: frozenset(
        {
            "inventario.consumo_interno",
            "pagos_comerciales.registrar",
            "pagos_comerciales.ver",
            "proformas.anular",
            "proformas.convertir",
            "proformas.gestionar",
            "proformas.ver",
            "reportes.comerciales",
            "ventas.confirmar",
            "ventas.crear",
            "ventas.ver",
        }
    )
    | _SHARED_CATALOG_PERMISSIONS,
    Role.ENCARGADO_TALLER: frozenset(
        {
            "mantenimientos.cambiar_precio_servicio",
            "mantenimientos.cancelar",
            "mantenimientos.finalizar",
            "mantenimientos.gestionar",
            "mantenimientos.gestionar_fotos",
            "mantenimientos.gestionar_repuestos",
            "mantenimientos.reabrir",
            "mantenimientos.ver",
            "marcas_vehiculo.gestionar",
            "pagos_artesanales.registrar",
            "pagos_artesanales.ver",
            "reportes.artesanales",
            "servicios.gestionar",
            "servicios_economicos.confirmar",
            "servicios_economicos.ver",
            "vehiculos.gestionar",
            "ventas.preparar_vinculada",
        }
    )
    | _SHARED_CATALOG_PERMISSIONS,
}


def effective_permissions(roles: Iterable[Role]) -> frozenset[str]:
    permissions: set[str] = set()
    for role in roles:
        permissions.update(ROLE_PERMISSIONS.get(role, frozenset()))
    return frozenset(permissions)
