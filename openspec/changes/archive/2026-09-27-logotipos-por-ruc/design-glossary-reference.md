# Referencia de glosario del diseño

| Término | Glosario de origen | Contexto |
|---|---|---|
| Entidad fiscal | `docs/negocio/producto/glosario.md` | `FiscalEntity`; cada una con como máximo un `FiscalEntityLogo`. |
| Logotipo de entidad fiscal | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Imagen normalizada y privada, entregada por revisión; no se versiona. |
| RUC comercial / RUC artesanal | `docs/negocio/producto/glosario.md` | Valores `COMERCIAL` y `ARTESANAL` del resumen `entity-logos/` y del `scope` de la hoja. |
| Documento interno | `docs/negocio/producto/glosario.md` | Hoja `DocumentSheet` de venta, servicios e ingreso. |
| Ingreso de mercadería | `docs/negocio/producto/glosario.md` | Su vista previa toma el nombre conservado o el vigente del emisor comercial. |
| Monolito modular | `docs/tecnico/glosario-tecnico.md` | Motivo para no importar `photo_storage` desde la configuración. |
| Idempotencia | `docs/tecnico/glosario-tecnico.md` | Recibos `ConfigurationCommand` por actor, acción y clave. |
| Modal | `docs/tecnico/glosario-tecnico.md` | `EntityLogoModal` sobre `FormModal`. |
| Notificación temporal (toast) | `docs/tecnico/glosario-tecnico.md` | Confirmación de carga o retiro. |
| Limpieza recuperable | `docs/adr/0007-almacenamiento-privado-fotografias.md` | Comando `purge_entity_logos` sobre el prefijo `fiscal-logos/`. |
| ADR | `docs/tecnico/glosario-tecnico.md` | Se actualizan las consecuencias de ADR-0007; no se crea uno nuevo. |
