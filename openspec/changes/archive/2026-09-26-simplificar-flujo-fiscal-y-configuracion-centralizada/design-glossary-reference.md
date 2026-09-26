# Referencia de glosario del diseño

| Término | Glosario de origen | Contexto |
|---|---|---|
| Entidad fiscal | `docs/negocio/producto/glosario.md` | Ámbito de catálogos habilitados, valores predeterminados y estado del perfil. |
| Forma de pago | `docs/negocio/producto/glosario.md` | Entrada `PAYMENT_FORM` del catálogo oficial, habilitada por entidad y sugerida desde cobros. |
| Crédito | `docs/negocio/producto/glosario.md` | Condición interna conservada solo como dato del origen; sin plazo. |
| Catálogo oficial | Nuevo término de `docs/negocio/producto/glosario.md` | `OfficialCatalogEntry` con procedencia de la ficha del SRI. |
| Punto predeterminado | Nuevo término de `docs/negocio/producto/glosario.md` | Punto efectivo resuelto desde `FiscalPreparationDefaults` o por unicidad. |
| Forma de pago predeterminada | Nuevo término de `docs/negocio/producto/glosario.md` | Forma sugerida para el importe no cubierto por cobros. |
| Preparación local | Nuevo término de `docs/negocio/producto/glosario.md` | Estado preparado con snapshot formato 2. |
| Idempotencia | `docs/tecnico/glosario-tecnico.md` | Escrituras nuevas de configuración con clave y versión esperada. |
| Monolito modular | `docs/tecnico/glosario-tecnico.md` | Fronteras entre configuración, fiscal, ventas y taller. |
| Concurrencia | `docs/tecnico/glosario-tecnico.md` | Orden de bloqueos y `review_stale`. |
