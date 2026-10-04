# Glossary Reference

| Term | Source Glossary | Context |
| --- | --- | --- |
| Costo promedio ponderado | `docs/arquitectura/modelo-dominio.md` §4 (Costo promedio) | Valor que la valoración conserva cuando la entrada no trae costo. |
| Entrada de stock | `docs/negocio/producto/glosario.md` (Ingreso de mercadería) | Flujo `SIMPLE` del ingreso de mercadería; término que este cambio introduce. |
| Idempotencia | `docs/tecnico/glosario-tecnico.md` | Recibo `PurchaseCommand` que impide duplicar una entrada por reintento. |
| Kardex | `docs/arquitectura/modelo-dominio.md` §4 | Historia donde se muestran movimientos sin costo y regularizaciones. |
| Monolito modular | `docs/tecnico/glosario-tecnico.md` | Frontera entre `purchasing`, `inventory`, `supplier_registry` y `sales`. |
| Movimiento inverso | `docs/negocio/producto/glosario.md` | Compensación que restituye también el estado de valoración. |
| Proveedor | `docs/negocio/producto/glosario.md` | Referencia opcional de la entrada y selección mínima para el Vendedor. |
| Sin costo registrado | `docs/negocio/producto/glosario.md` | Estado de posición y movimiento representado por las banderas `valued` y `cost_known`; término que este cambio introduce. |
