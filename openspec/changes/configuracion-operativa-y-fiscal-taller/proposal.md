## Why

El sistema todavía no dispone de la configuración mínima que permita iniciar operaciones económicas y de inventario sin fijar datos fiscales en el código ni mezclar los dos contribuyentes. Esta capacidad debe establecer primero los dos **RUC**, las vigencias de **impuestos**, la **bodega** única de V1 y los **secuenciales** internos para que ventas, servicios, ingresos y documentos posteriores consuman parámetros coherentes y auditables.

## What Changes

- Incorporar la administración, exclusiva del **Administrador**, de exactamente dos **entidades fiscales** diferenciadas: **RUC comercial** y **RUC artesanal**, cada una con su RUC, tipo e información oficial de identificación permitida (`CT-001`, `RN-FIS-001…010`, `RF-ACC-010`, `CU-003`).
- Configurar **impuestos** y tarifas por entidad fiscal mediante períodos de vigencia no ambiguos, sin modificar configuraciones ni valores históricos ya aplicados (`RN-FIS-010`, `RN-CON-001…002`, `RF-ACC-011`).
- Registrar y habilitar una sola **bodega** operativa para V1, de modo que las futuras existencias y movimientos tengan una referencia explícita sin habilitar transferencias ni operación multibodega (`DP-001`, `RN-INV-016`, `RF-INV-013`).
- Configurar series y **secuenciales** por entidad fiscal y tipo de **documento interno**, con unicidad, asignación al confirmar, protección ante concurrencia, auditoría de cambios y prohibición de reutilizar números (`RN-VEN-018`, `RN-CON-009`, `RF-ACC-012`, `RNF-INT-003…005`, `CU-003`).
- Presentar fichas separadas de entidades fiscales, vigencias tributarias, bodega y numeración, reutilizando autorización, auditoría y componentes visuales existentes (`UI-014…016`).
- Reutilizar los roles, permisos efectivos, sesiones, auditoría y estructura visual vigentes; introducir una capacidad funcional nueva para configuración, sin sustituir comportamiento histórico del sistema Flutter ni modificar las reglas aprobadas del **modelo de dominio**.

### Recomendaciones sujetas a aprobación

- Para IVA y otros impuestos, registrar una tarifa decimal y su fecha de inicio por entidad fiscal; rechazar solapamientos ambiguos y exigir que el responsable del negocio cargue valores previamente validados. No se propone codificar una tasa legal, una clasificación tributaria ni una regla de redondeo no confirmadas.
- Para `DP-006`, usar en V1 una sola serie activa por entidad fiscal y tipo de documento, seguida por un número positivo monotónico con longitud visible estable. Una serie retirada no se reutiliza y el valor confirmado nunca se reduce ni reasigna. La denominación de las series y la cantidad exacta de dígitos deberán aprobarse antes de redactar las specs.
- Para `DP-001`, permitir identificar y activar la única bodega de V1, conservando el concepto de bodega en el dominio; no exponer creación de bodegas adicionales ni transferencias.

### Fuera de alcance

- Facturación electrónica, firma, autorización o consultas al SRI, reglas de consumidor final y contabilidad general.
- Obtención automática de tasas tributarias o validación legal de la tarifa ingresada.
- Clasificación tributaria de productos o servicios, cálculo de documentos económicos y políticas de redondeo todavía no validadas.
- Operación multibodega, sucursales, ubicaciones internas, transferencias y movimientos de inventario.
- Implementación de ventas, ingresos, mantenimientos, pagos, cierres o documentos finales que consumirán esta configuración.
- Configuración de descuentos, anticipos, sobrepagos, nuevos medios de pago o roles adicionales, todos incompatibles con las decisiones vigentes de V1.

### Usuarios afectados

- El **Administrador** configura y consulta los parámetros y revisa su auditoría.
- El Vendedor y el Encargado del taller no modifican esta configuración; sus capacidades futuras consumen los parámetros aprobados según el RUC de cada operación.

### Dependencias y riesgos

- Depende de la identidad, autorización y auditoría ya implementadas, incluidos `entidades_fiscales.ver`, `entidades_fiscales.editar` y `parametros.gestionar`, y del sistema visual vigente.
- Es prerrequisito funcional para inventario, ingresos, ventas, operaciones artesanales y documentos internos; esas capacidades no deben inventar valores predeterminados si falta una configuración aplicable.
- Una tarifa, vigencia, entidad, bodega o serie incorrecta puede afectar documentos posteriores; se requieren validaciones, confirmaciones y trazabilidad de cambios.
- La generación concurrente o la edición manual insegura de un secuencial puede duplicar documentos o dejar huecos engañosos; las garantías observables se especificarán antes del diseño técnico.
- No se encontraron contradicciones directas entre las fuentes vigentes. Continúan abiertas `DP-006` y la validación externa de tarifas, clasificación tributaria y redondeo; la propuesta no las presenta como decisiones ya confirmadas.

## Capabilities

### New Capabilities

- `configuracion-operativa-y-fiscal`: Administración de los dos RUC, vigencias de impuestos, bodega única de V1 y series/secuenciales internos, con permisos, validaciones y auditoría.

### Modified Capabilities

Ninguna. La capacidad concreta requisitos ya trazados por `modelo-dominio-taller` sin cambiar su comportamiento aprobado.

## Impact

- **Backend y datos:** nueva frontera funcional dentro del **monolito modular**, persistencia versionada para entidades fiscales, vigencias, bodega y controles de numeración, y reutilización explícita de autorización y auditoría de identidad.
- **API:** nuevo contrato bajo la **API versionada** `/api/v1/` para consulta y administración autorizada de la configuración.
- **Frontend:** nuevas vistas administrativas correspondientes a `UI-014…016`, integradas en la navegación y componentes reutilizables existentes.
- **Calidad:** pruebas de permisos, vigencias, unicidad, historia, atomicidad y concurrencia; actualización de OpenAPI, trazabilidad y documentación afectada.
- **Dependencias externas:** no se añaden integraciones ni paquetes; los valores tributarios reales requieren confirmación del responsable del negocio o su asesor contable.

### Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`.
- `docs/arquitectura/modelo-dominio.md` y `openspec/specs/modelo-dominio-taller/spec.md`.
- `docs/negocio/producto/alcance-v1.md`, `reglas-negocio.md`, `vision.md` y `glosario.md`.
- `docs/negocio/requisitos/requisitos-funcionales.md`, `requisitos-no-funcionales.md`, `casos-de-uso.md`, `actores-y-roles.md`, `interfaz-y-navegacion.md` y `matriz-trazabilidad.md`.
- `docs/tecnico/arquitectura-inicial.md`, `docs/tecnico/glosario-tecnico.md` y `docs/adr/0001-monorepositorio-y-monolito-modular.md`.
- Specs principales vigentes y estructura actual de backend/frontend, usadas solo para identificar reutilización e impacto y no como fuente superior de requisitos.
