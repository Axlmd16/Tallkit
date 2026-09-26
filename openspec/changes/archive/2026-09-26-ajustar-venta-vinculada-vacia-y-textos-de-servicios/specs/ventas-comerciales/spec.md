# Ventas comerciales: borrador vinculado vacío

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con A1; RN-VEN-006; RN-CON-007; spec principal `ventas-comerciales`. Solo el sistema elimina un borrador vinculado cuando queda vacío. Las acciones ordinarias de ventas siguen sin poder descartarlo, y los borradores vacíos que ya existían se limpian mediante una acción explícita.

## MODIFIED Requirements

### Requirement: Venta vinculada protegida frente a acciones ordinarias

Una venta vinculada a un mantenimiento SHALL conservar de forma inmutable su orden de origen, el RUC comercial y el cliente de la orden. Mientras esté en borrador, sus líneas SHALL modificarse únicamente mediante las acciones de repuestos de la orden. Las acciones ordinarias de edición de ventas SHALL rechazar cambios de cliente, entidad, origen o líneas, y la eliminación o el descarte del borrador. El borrador vinculado SHALL eliminarse únicamente cuando se retira su última línea desde la orden, conforme a `repuestos-del-mantenimiento`, o mediante la limpieza explícita de borradores vacíos. La condición contado o crédito SHALL elegirse en la confirmación por un usuario con `ventas.confirmar`. Después de confirmarse, la venta vinculada SHALL seguir las reglas de historia inmutable, cobro y consulta de cualquier venta, y SHALL NOT eliminarse. Las ventas directas SHALL conservar su comportamiento sin cambios. Trazabilidad: RN-TAL-012; RN-VEN-006; RF-TAL-011; RF-VEN-002; propuesta de integración P5/P7; propuesta A1.

#### Scenario: Editar una venta vinculada desde el recurso ordinario
- **DADO** una venta vinculada en borrador
- **CUANDO** un Vendedor intenta cambiar su cliente, agregar o quitar líneas o eliminarla mediante la edición ordinaria de ventas
- **ENTONCES** el sistema SHALL rechazarlo explicando que sus líneas se gestionan desde la orden, sin modificar la venta ni sus reservas.

#### Scenario: Confirmar una venta vinculada eligiendo crédito
- **DADO** una venta vinculada en borrador revisada
- **CUANDO** un Vendedor la confirma con condición crédito
- **ENTONCES** SHALL confirmarse con esa condición, conservando su orden de origen, sin registrar pagos.

#### Scenario: Venta directa conserva su comportamiento
- **DADO** una venta directa en borrador sin relación con órdenes
- **CUANDO** un Vendedor la edita, la confirma y la cobra
- **ENTONCES** SHALL comportarse como antes de esta entrega, sin reservas ni vínculos de mantenimiento, y SHALL NOT eliminarse aunque quede sin líneas.

## ADDED Requirements

### Requirement: Limpieza explícita de borradores vinculados vacíos

El sistema SHALL ofrecer una acción operativa explícita para eliminar los borradores vinculados que ya estén vacíos, sin líneas ni reservas activas. Por omisión SHALL solo informar cuáles eliminaría, con la venta y la orden de cada uno. SHALL eliminarlos únicamente con una confirmación expresa, y SHALL auditar cada eliminación. SHALL NOT eliminar ventas confirmadas o anuladas, borradores directos ni borradores vinculados con líneas. Repetirla SHALL ser seguro y no producir efectos adicionales. SHALL NOT ejecutarse automáticamente mediante migraciones. Trazabilidad: RN-CON-007; propuesta A1.

#### Scenario: Informe sin cambios por omisión
- **DADO** un borrador vinculado vacío de la orden `ART-OT-000001` y un borrador directo vacío
- **CUANDO** se ejecuta la limpieza sin confirmación
- **ENTONCES** SHALL informar únicamente el borrador vinculado vacío y SHALL NOT eliminar nada.

#### Scenario: Limpieza confirmada
- **DADO** el mismo estado
- **CUANDO** se ejecuta la limpieza con confirmación expresa
- **ENTONCES** SHALL eliminarse solo el borrador vinculado vacío, con su evento de auditoría, y una segunda ejecución SHALL informar que no hay nada por limpiar.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
