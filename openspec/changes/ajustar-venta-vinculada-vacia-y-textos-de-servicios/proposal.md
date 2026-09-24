# Ajustar la venta vinculada vacía y los textos del comprobante de servicios

Estado: **propuesta aprobada para crear specs**, incluida la recomendación A1. El usuario respondió: «está bien que lo borres físicamente totalmente porque como es un borrador que nunca tuvo, nunca afectó al inventario ni nada». Fecha: 2026-09-24, America/Guayaquil. Los logotipos por RUC en los comprobantes se tratarán en un cambio aparte. Esta aprobación no abarca specs, diseño, tareas ni implementación.

## Why

Hay dos problemas de uso en la integración recién entregada:

- **Borrador vacío.** Al retirar el último repuesto de una orden, la venta vinculada en borrador sigue existiendo sin líneas. Aparece en la lista de ventas del Vendedor como pendiente, y al intentar confirmarla muestra «Agregue al menos una línea», un error sin utilidad para el usuario. La regla vigente (spec `repuestos-del-mantenimiento`: «Retirar todas las líneas SHALL dejar la venta abierta sin líneas y sin reservas») causa este efecto.
- **Textos confusos.** «Documentar servicios» y «Pendiente de documentar» no explican al usuario que se trata de generar el comprobante de cobro de los servicios.

## What Changes

- **Borrador vacío.** Al retirar el último repuesto de una venta vinculada en borrador, en la misma acción atómica y bajo el bloqueo de la orden:
  - el sistema elimina ese borrador vacío, que nunca tuvo número, deuda, reservas ni movimientos;
  - la acción queda auditada con la venta y la orden afectadas;
  - agregar otro repuesto después crea un borrador nuevo, igual que la primera vez.

  Nunca se eliminan ventas confirmadas ni anuladas, ni borradores directos, ni borradores vinculados con líneas.
- **Borradores vacíos existentes.** Se limpian solo mediante un comando explícito. Muestra por defecto lo que eliminaría y solo borra con una confirmación; no hay migración automática.
- **Textos de la interfaz** (sin cambiar la API ni los códigos internos):

  | Hoy | Nuevo |
  |---|---|
  | «Documentar servicios» | «Generar comprobante de servicios» |
  | «Pendiente de documentar» | «Sin comprobante» |
  | «Documentado en ART-SER-…» | «En comprobante ART-SER-…» |
  | «Confirmar operación de servicios» | «Generar comprobante» |

  Los avisos del resumen y de la vista previa se ajustan en coherencia, aclarando que es un comprobante interno y no una factura del SRI.

### Decisiones y límites que se conservan

DP-012/021 (una venta abierta por orden; finalizar exige que no tenga líneas), DP-018 (documentos internos, no facturas), RN-VEN-006 (las ventas confirmadas no se editan ni eliminan) y RN-CON-007 (las operaciones transaccionales no se eliminan físicamente). El borrador vinculado vacío no es una operación transaccional: el sistema lo creó al agregar el primer repuesto y sus líneas ya se eliminaban al retirarlas. La auditoría conserva el rastro de su creación y su eliminación.

### Recomendación aprobada

| ID | Punto | Recomendación | Alternativa |
|---|---|---|---|
| A1 | Qué hacer con el borrador vacío | Eliminarlo físicamente dentro de la acción de retirar la última línea, con evento de auditoría. | Marcarlo con un nuevo estado «descartado». Obliga a añadir un estado a `Sale`, filtros y reglas nuevas en ventas, sin beneficio práctico. |

## Fuera de alcance

Facturación electrónica, cambios en ventas directas, cambios en los cálculos, en los cobros o en los permisos, y renombrar códigos de API (`document_services`, `nothing_to_document`), modelos o endpoints.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `repuestos-del-mantenimiento`: el requisito «Modificar y retirar líneas pendientes» pasa a eliminar el borrador vinculado cuando queda vacío.
- `ventas-comerciales`: el requisito «Venta vinculada protegida frente a acciones ordinarias» aclara que solo el sistema elimina un borrador vinculado vacío; las acciones ordinarias siguen sin poder descartarlo.

Los textos de la interfaz no cambian requisitos: las specs exigen distinguir líneas con y sin comprobante, no un rótulo literal.

## Impact

- Backend: `sales/application/workshop_links.py` (`remove_linked_line`), un comando de gestión nuevo en `sales` para limpiar los borradores vacíos existentes, y las pruebas de `tests/sales` y `tests/workshop` afectadas.
- Frontend: textos en `features/maintenance/EconomicSummary.tsx`, `BillingDialogs.tsx`, `ServiceLines.tsx`, `PartsSection.tsx` y las páginas de operación, más sus pruebas y el E2E `maintenance-billing.spec.ts`.
- Documentación: glosario («Pendiente de documentar»), la nota de UI en `interfaz-y-navegacion.md` y la cobertura.
- Sin migraciones ni cambios de API.

## Fuentes consultadas

Specs principales `repuestos-del-mantenimiento`, `ventas-comerciales`, `servicios-aplicados-al-mantenimiento`, `operacion-artesanal-de-servicios` y `resumen-economico-del-mantenimiento`; `decisiones-confirmadas.yaml` (DP-012, DP-018, DP-021, DP-029); `reglas-negocio.md` (RN-VEN-006, RN-CON-007); el cambio archivado de integración y `sales/application/workshop_links.py`.

## Límite de aprobación

Propuesta y A1 aprobadas; se registran en `master` antes de redactar las specs.
