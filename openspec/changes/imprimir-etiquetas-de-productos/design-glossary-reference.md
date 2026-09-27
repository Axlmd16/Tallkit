# Referencia de glosario del diseño

| Término | Glosario de origen | Contexto |
|---|---|---|
| Etiqueta de producto | `docs/negocio/producto/glosario.md` | Unidad física compuesta por `ProductLabel`, sin precio ni efectos de inventario. |
| Producto | `docs/negocio/producto/glosario.md` | Origen de código interno, nombre, código del fabricante y marca en `ProductLabelData`. |
| Código interno | `docs/negocio/producto/glosario.md`, dentro de Producto | Texto identificador que se muestra y se codifica sin alteraciones. |
| Marca de producto | `docs/negocio/producto/glosario.md` | Dato opcional de la proyección mínima de etiquetas. |
| Entidad fiscal | `docs/negocio/producto/glosario.md` | Origen de `display_name` y del logotipo vigente. |
| RUC comercial | `docs/negocio/producto/glosario.md` | Único ámbito de identidad usado por las etiquetas. |
| Logotipo de entidad fiscal | `docs/negocio/producto/glosario.md` | Imagen comercial opcional obtenida mediante `entity-logos/`. |
| Code 128 | `docs/tecnico/glosario-tecnico.md` | Simbología SVG generada con juegos B/C, checksum y zonas silenciosas. |
| API REST | `docs/tecnico/glosario-tecnico.md` | Ruta GET `products/label-data/` para la proyección completa filtrada. |
| OpenAPI | `docs/tecnico/glosario-tecnico.md` | Contrato actualizado con la ruta y el campo `display_name`. |
| Idempotencia | `docs/tecnico/glosario-tecnico.md` | No aplica como mecanismo: todas las operaciones nuevas son lecturas o impresión local sin escritura. |
| Documento interno | `docs/negocio/producto/glosario.md` | Contraste con `DocumentSheet`; la hoja de etiquetas no es un documento económico. |

No se introducen sinónimos locales. `nombre visible`, usado en el diseño técnico, significa el valor calculado `display_name`: nombre comercial vigente o, en su ausencia, razón social vigente.
