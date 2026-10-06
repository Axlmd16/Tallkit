# Glossary Reference

| Term | Source Glossary | Context |
| --- | --- | --- |
| Cliente | `docs/negocio/producto/glosario.md` | Entidad titular de datos de contacto y persona natural o jurídica en el registro. |
| Vehículo | `docs/negocio/producto/glosario.md` | Entidad con placa, marca, modelo y períodos de propiedad en el registro. |
| Marca de vehículo | `docs/negocio/producto/glosario.md` | Catálogo administrable asociado a los vehículos. |
| Período de propiedad | `docs/negocio/producto/glosario.md` | Intervalo temporal que vincula un vehículo con su cliente propietario. |
| Entidad fiscal | `docs/negocio/producto/glosario.md` | Separación legal del taller; el registro de clientes y vehículos es compartido. |
| RUC | `docs/negocio/producto/glosario.md` | Tipo de identificación tributaria admitida (13 caracteres) y contribuyentes del taller. |
| Modelo de dominio | `docs/tecnico/glosario-tecnico.md` | Base conceptual previa aprobada que guía este diseño de persistencia. |
| Monolito modular | `docs/tecnico/glosario-tecnico.md` | Frontera arquitectónica donde reside el módulo customer_registry. |
| Producto / Servicio / Proveedor | `docs/negocio/producto/glosario.md` | Catálogos persistentes de los módulos `catalog` y `supplier_registry`. |
| Idempotencia | `docs/tecnico/glosario-tecnico.md` | Recibo por actor, acción y clave que reproduce el resultado original de un comando. |
| Posición de inventario / Corte de consulta | `docs/negocio/producto/glosario.md` | Proyección conciliable y lectura estable de los módulos `inventory` y `purchasing`. |
| Orden total de bloqueos | `docs/tecnico/glosario-tecnico.md` | Protocolo de concurrencia de las confirmaciones. |
| Logotipo de entidad fiscal | `docs/negocio/producto/glosario.md` | Tabla `workshop_configuration_fiscalentitylogo` y archivos en `fiscal-logos/`. |
| Entrada de stock | `docs/negocio/producto/glosario.md` | Flujo `SIMPLE` de `purchasing_purchase`. |
| Sin costo registrado | `docs/negocio/producto/glosario.md` | Estado `valued = false` de la posición. |
| Perfil del emisor | `docs/negocio/producto/glosario.md` | Tabla `workshop_configuration_electronicprofilerevision` y su `conditions_format`. |
| Calificación artesanal | `docs/negocio/producto/glosario.md` | Clave `artisan_qualification` del formato 2 del perfil. |
| Código de servicio | `docs/negocio/producto/glosario.md` | Columna `catalog_service.code`, contador `catalog_servicecodecounter` y `service_code` de las líneas. |
| Retención recibida | `docs/negocio/producto/glosario.md` | Tablas `sales_commercialwithholding`, `workshop_artisanwithholding` y `workshop_configuration_receivedwithholdingsetting`. |
| Comprobante de retención | `docs/negocio/producto/glosario.md` | Columnas `voucher_number`, `voucher_date` y desglose de las tablas de retención. |
