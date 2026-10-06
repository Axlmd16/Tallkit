# Referencia terminológica

| Término | Glosario de origen | Contexto |
|---|---|---|
| Monolito modular | `docs/tecnico/glosario-tecnico.md` | El módulo `home` compone lecturas de otros módulos sin tocar sus datos. |
| ADR | `docs/tecnico/glosario-tecnico.md` | Se justifica que este cambio no requiere uno nuevo. |
| API versionada | `docs/tecnico/glosario-tecnico.md` | Las tres rutas nuevas viven bajo `/api/v1/home/`. |
| Contrato OpenAPI | `docs/tecnico/glosario-tecnico.md` | Se regenera con las rutas y los filtros nuevos. |
| Concurrencia | `docs/tecnico/glosario-tecnico.md` | Cada bloque se lee en una instantánea coherente. |
| Idempotencia | `docs/tecnico/glosario-tecnico.md` | No aplica: el resumen solo lee. |
| TDD | `docs/tecnico/glosario-tecnico.md` | Guía la estrategia de pruebas. |
| Evidencia visual | `docs/tecnico/glosario-tecnico.md` | Las piezas nuevas entran al catálogo visual. |
| Entidad fiscal | `docs/negocio/producto/glosario.md` | Cada respuesta separa sus valores por ámbito. |
| Permiso efectivo | `docs/negocio/producto/glosario.md` | Decide indicador por indicador qué se calcula. |
| Saldo pendiente | `docs/negocio/producto/glosario.md` | Se reutiliza la fórmula del módulo dueño. |
| Cuentas por cobrar | `docs/negocio/producto/glosario.md` | Reciben filtros nuevos para coincidir con el inicio. |
| Pago | `docs/negocio/producto/glosario.md` | Los vigentes se agrupan por fecha de cobro. |
| Retención recibida | `docs/negocio/producto/glosario.md` | Queda fuera de los cobros por vivir en tablas propias. |
| Proforma | `docs/negocio/producto/glosario.md` | Recibe el filtro de vencimiento próximo. |
| Mantenimiento | `docs/negocio/producto/glosario.md` | Recibe el filtro de órdenes abiertas. |
