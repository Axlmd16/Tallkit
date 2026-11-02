# Referencia de glosario del diseño

| Término | Glosario de origen | Contexto |
|---|---|---|
| Perfil del emisor | [Glosario del producto](../../../docs/negocio/producto/glosario.md#perfil-del-emisor) | Guarda sus condiciones en un JSON por revisión; recibe `large_taxpayer` sin subir de formato. |
| ADR | [Glosario técnico](../../../docs/tecnico/glosario-tecnico.md#adr) | `ADR-0010` y `ADR-0003` se aplican sin cambios. |
| Plazo del comprobante | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Se guarda como `payments.term_days` y solo existe en la preparación. |
| Gran contribuyente | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Condición `large_taxpayer`; el cambio 3 la traduce a información adicional. |
| Detalle adicional | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Pares `{name, value}` validados en `fiscal/domain/additional_info.py`. |
| Detalle de servicio | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Campo `detail` en las líneas de taller y `service_detail` en la instantánea. |
