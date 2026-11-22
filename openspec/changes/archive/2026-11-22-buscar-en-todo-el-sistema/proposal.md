## Why

Hoy, para ubicar una placa, un cliente, un producto o una factura, la usuaria diaria (`DP-036`, regla 1) debe navegar primero a cada módulo y filtrar allí. En la página de inicio (U4b), el buscador grande de la banda superior solo redirige a una lista filtrada. `DP-036` (regla 5) aprobó incorporar una **búsqueda global** accesible desde cualquier pantalla, con autorización decidida por el servidor; con U4 y U4b ya cerrados, U5 habilita este acceso rápido antes de U6 («Cobrar y facturar»).

## What Changes

- **Acceso global desde cualquier pantalla (reemplaza la restricción de `interfaz-y-navegacion.md` §2.1, línea 37):**
  - Disparador visible en el marco autenticado (escritorio, tableta y teléfono) y atajo de teclado (`RNF-USA-011`) para abrir el diálogo de búsqueda global sin perder la pantalla actual.
  - El campo de búsqueda de la banda superior en **Inicio** abre o alimenta la búsqueda global en lugar de redirigir a una sola lista.
- **Búsqueda unificada en el servidor, agrupada por tipo y filtrada por permisos efectivos (`DP-036`, regla 5):**
  - **Vehículos:** búsqueda por placa (tolerando mayúsculas, espacios o ausencia de guion), marca, modelo o nombre del propietario. Muestra placa, vehículo, propietario y, solo si el usuario puede consultar mantenimientos, si el vehículo tiene un mantenimiento abierto.
  - **Clientes:** búsqueda por nombre/razón social o número de identificación (cédula/RUC). Conduce a la ficha del cliente.
  - **Facturas:** búsqueda sobre las preparaciones locales de factura de los negocios que el usuario puede consultar (coherente con U4 y `DP-034`, regla 8), por número de operación origen, número fiscal de ensayo si existe, o nombre del cliente. Muestra el nombre comercial del negocio (`DP-036`, regla 3), cliente, fecha, estado local («Borrador», «Preparada, sin enviar», «Cancelada») y total, **sin total conjunto** entre negocios y sin presentarlas como enviadas ni autorizadas.
  - **Productos:** búsqueda por nombre, código interno o código del fabricante. Muestra nombre, código, precio final de venta y existencia («Quedan n») únicamente si el usuario tiene permiso de inventario (`inventario.ver`), **nunca** costos, costo promedio ni valoración (`DP-030`).
- **Estados claros y operación con teclado:**
  - Carga, sin resultados (con sugerencia de búsqueda), error recuperable con reintento y estado inicial antes de escribir (recientes de la sesión o guía breve).
  - Navegación completa por teclado (abrir, escribir, recorrer resultados, elegir y cerrar con `Escape`), foco visible y objetivos táctiles mínimos de 44 px.
- **Operación estrictamente de solo lectura:** buscar nunca crea, modifica, reserva ni numera registros.

## Capabilities

### New Capabilities

- `busqueda-global`: consulta global de solo lectura desde cualquier pantalla sobre vehículos, clientes, facturas locales y productos, con autorización por rol y entidad fiscal en el servidor, tolerancia de formato en placas y tildes, y acceso directo a la ficha correspondiente sin mezclar totales entre negocios ni exponer costos ni estados de autorización inexistentes.

### Modified Capabilities

- `navegacion-de-uso-diario`: incorpora el acceso a la búsqueda global en el marco autenticado desde cualquier pantalla y actualiza el comportamiento del buscador de la página de inicio para usarla.

## Decisiones por aprobar

| # | Tema | Recomendación | Alternativas |
|---|---|---|---|
| 1 | `interfaz-y-navegacion.md` §2.1 (línea 37): «sin búsqueda global» | **Se reemplaza** (ya decidido en `DP-036`, regla 5; se sincroniza la documentación al archivar) | — |
| 2 | Alcance del grupo «Facturas» antes del cambio 3 | **A.** Buscar en las preparaciones locales de factura de los negocios autorizados (mismo criterio aprobado en U4 para la entrada «Facturas»), por número de operación, número fiscal de ensayo o cliente, mostrando solo estado local | **B.** Buscar además ventas y operaciones artesanales confirmadas sin preparación fiscal (mezclaría comprobantes internos con «Facturas») |
| 3 | Destino al seleccionar un vehículo | **A.** Si tiene mantenimiento abierto (`registrado` o `reabierto`) y el usuario puede ver mantenimientos, abrir ese mantenimiento; en caso contrario, abrir la ficha del vehículo (o del cliente propietario) | **B.** Abrir siempre la ficha del vehículo |
| 4 | Sección «Buscados hace poco» (prototipo pantalla 6) en PC compartida | **A.** Guardarla únicamente en la sesión actual del navegador (asociada al usuario autenticado) y limpiarla al cerrar sesión o al invalidarse la sesión; si está vacía, mostrar una guía breve | **B.** Omitir recientes en V1 y mostrar siempre la guía breve |
| 5 | Límite de resultados por grupo | **A.** Hasta 5 resultados por grupo con conteo de coincidencias por grupo y texto orientativo para afinar la búsqueda si hay más | **B.** Paginar dentro del diálogo modal |

## Impact

- **Usuarios afectados:** Administrador, Vendedor, Encargado del taller y usuaria diaria con los tres roles acumulados (`CT-001`, `DP-036` regla 1). Cada rol recibe únicamente los grupos y campos que sus permisos efectivos autorizan.
- **Backend y API:** nueva consulta de solo lectura para búsqueda global que coordina consultas existentes de clientes/vehículos, catálogo de productos/existencias, mantenimientos abiertos y preparaciones fiscales locales, aplicando autorización en el servidor por rol y por entidad fiscal, sin acoplar módulos por escritura ni crear migraciones de base de datos.
- **Frontend:** diálogo modal de búsqueda global (basado en el prototipo aprobado `docs/prototipo/Buscar.dc.html` y el sistema visual Grafito y cobre), disparador en el marco autenticado, atajo de teclado y conexión con el buscador de Inicio.
- **Datos y persistencia:** sin cambios en el modelo de dominio ni migraciones previstas (solo lectura sobre entidades existentes).
- **Nivel de riesgo y pruebas (según `AGENTS.md`):**
  - **Alto (TDD):** autorización en el servidor por rol y combinación de roles, filtrado por entidad fiscal en facturas, exclusión estricta de costos/valoración y de existencias sin permiso de inventario, y verificación de solo lectura.
  - **Medio (prueba al final):** flujo del diálogo de búsqueda, apertura con teclado y navegación a cada destino en frontend.
- **Dependencias:** U4 (`reorganizar-navegacion-y-lenguaje`) y U4b ya completados y en `master`. U6 («Cobrar y facturar») y el cambio 3 (emisión electrónica) podrán reutilizar esta búsqueda sin cambiar su contrato base; cuando exista emisión real, el cambio 3 ampliará los estados y números fiscales mostrados en «Facturas».
- **Riesgos:**
  - **Filtración entre roles o negocios:** entregar mantenimientos a un Vendedor sin acceso, facturas del negocio comercial a un Encargado del taller, o existencias/costos sin permiso (`RN-SEG-004`, `RN-FIS-009`, `DP-030`). Mitigación: autorización centralizada en el servidor con pruebas negativas por rol.
  - **Presentar preparaciones como facturas autorizadas:** el prototipo muestra «Solicitada» como ejemplo visual; debe mantenerse el estado local vigente («Borrador», «Preparada, sin enviar», «Cancelada») hasta el cambio 3 (`DP-034`, regla 8).
  - **Fuga de recientes en equipo compartido:** si se guardan búsquedas recientes en almacenamiento persistente sin limpiarlas al cerrar sesión, otro usuario podría ver placas o clientes ajenos. Mitigación: almacenamiento por sesión y limpieza obligatoria al salir.
  - **Rendimiento:** una consulta por cada pulsación podría sobrecargar el servidor si se busca en cuatro dominios a la vez. Mitigación: longitud mínima, espera breve al escribir y límite de resultados por grupo.

## Fuera de alcance

- Buscar en servicios, proformas, entradas de mercadería, proveedores, usuarios o registros de auditoría (no forman parte de `DP-036` regla 5 ni del prototipo U2).
- Crear clientes, vehículos, ventas o mantenimientos desde el diálogo de búsqueda.
- Mostrar costos, costo promedio, valoración de inventario o márgenes en los resultados de productos (`DP-030`).
- Mostrar estados de emisión real («Solicitada», «Autorizada», «Rechazada»), descargar RIDE/XML o reenviar correos desde «Facturas» (`DP-034`, regla 8; corresponde a U6 y cambio 3).
- Cambiar permisos, roles, reglas de negocio, numeración o separación entre entidades fiscales.
- Modificar los buscadores locales de cada módulo (siguen operando como filtros de su lista).

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` (completo; en especial `CT-001`, `DP-008`, `DP-030`, `DP-034` regla 8, `DP-036` reglas 1, 3, 5 y 8).
- `docs/arquitectura/modelo-dominio.md` (completo; invariantes 1, 2, 3, 5 y 25; §3 y §11.6).
- `docs/cambios-pendientes.md` (secciones U4b y U5).
- `docs/negocio/requisitos/interfaz-y-navegacion.md` (§1, §2.1 línea 37, §2.2, §3).
- `docs/negocio/requisitos/actores-y-roles.md` (§3, §4, §5 y §6).
- `docs/negocio/requisitos/requisitos-no-funcionales.md` (`RNF-USA-010`, `RNF-USA-011`, `RNF-USA-013…016`).
- `docs/negocio/requisitos/matriz-trazabilidad.md` (entrada de `DP-036`).
- `docs/prototipo/Buscar.dc.html` (pantalla 6 aprobada en U2).
- `openspec/specs/autorizacion-y-navegacion/spec.md`, `openspec/specs/navegacion-de-uso-diario/spec.md`, `openspec/specs/objetivos-de-uso-diario/spec.md` y `openspec/specs/pagina-de-inicio/spec.md`.

**Contradicciones registradas:**
1. `docs/negocio/requisitos/interfaz-y-navegacion.md` §2.1 (línea 37) indicaba «sin búsqueda global hasta U5»; queda reemplazada por `DP-036` (regla 5) al archivar este cambio.
2. El prototipo `docs/prototipo/Buscar.dc.html` muestra el estado «Solicitada» y numeración fiscal de ejemplo en «Facturas»; contradice `DP-034` (regla 8) mientras no exista emisión real, por lo que prevalecen los estados locales aprobados en U4 («Borrador», «Preparada, sin enviar», «Cancelada»).

**Información insuficiente:** no existe una definición previa sobre el límite exacto de filas por grupo ni sobre la persistencia de «Buscados hace poco» en equipos compartidos; se incluyen como decisiones 4 y 5 para aprobación antes de redactar las specs.
