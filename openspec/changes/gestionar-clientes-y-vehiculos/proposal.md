## Why

El taller necesita una ficha compartida y confiable de cada **Cliente** y **Vehículo** antes de incorporarlos a ventas y mantenimientos. La base de identidad ya existe; esta capacidad permitirá localizar registros, evitar duplicados y conservar la propiedad y la trazabilidad sin adelantar operaciones económicas.

**Estado:** propuesta aprobada por el usuario al incorporar las decisiones de negocio de esta revisión (2026-09-11), sin ampliar su alcance. Se autoriza continuar con specs después de registrar este artefacto en `master`; diseño e implementación todavía no están autorizados.

## What Changes

### Objetivo y alcance

- Crear, consultar, buscar y editar clientes; permitir al **Administrador** desactivarlos y reactivarlos conservando su identidad e historia.
- Admitir personas naturales y jurídicas y buscar por nombre, identificación o teléfono, con coincidencias parciales, filtros de estado y acceso a la ficha existente.
- Crear, consultar y editar vehículos, buscarlos principalmente por placa y consultar su propietario; mostrar desde cada cliente sus vehículos actuales. Incorporar VIN y año como datos opcionales conforme a los requisitos vigentes.
- Permitir cambiar el propietario actual conservando los períodos anteriores. Incluir únicamente esa historia mínima y su consulta; no construir historial de trabajos ni documentos económicos.
- Incluir desactivación y reactivación administrativa de vehículos, como exige `RF-CLI-010`, aunque no aparezcan enumeradas en el alcance inicial de la solicitud.
- Incorporar el catálogo administrable de marcas de vehículo exigido por `DP-008`, separado de marcas de producto; su distribución de permisos está aprobada y se detalla abajo.
- Rechazar duplicados por identificación normalizada del cliente y por placa o VIN normalizados del vehículo, incluyendo registros inactivos; ofrecer consultar la ficha existente en lugar de crear otra. Mostrar advertencias de posibles coincidencias sin convertir nombre o teléfono en identificadores únicos.
- Aplicar permisos vigentes en backend y adaptar navegación y acciones al **Permiso efectivo** del usuario, incluidos roles acumulados y sesiones invalidadas.
- Registrar altas, ediciones, cambios de propietario, desactivaciones, reactivaciones y denegaciones relevantes en auditoría consultable por el Administrador, sin datos personales innecesarios ni edición ordinaria de eventos.
- Mantener errores uniformes y **Contrato OpenAPI**, y construir listas, fichas y formularios responsive exclusivamente con el sistema visual vigente. Cubrir backend, frontend y E2E, incluidas validaciones, concurrencia de duplicados y propiedad, permisos positivos y negativos y accesibilidad.

### Decisiones confirmadas que no se vuelven a preguntar

| Asunto | Regla que se conserva | Fuente |
|---|---|---|
| Datos obligatorios del cliente | Nombre o razón social, tipo de identificación, identificación y teléfono. Email y dirección opcionales durante el registro; una futura capacidad de facturación podrá exigir completar los datos fiscales necesarios antes de emitir un comprobante. | `DP-008` (Cliente) |
| Identificación | Solo CI de exactamente 10 caracteres y RUC de exactamente 13; validación en frontend y backend. No se habilita registro sin identificación. | `DP-008` (Cliente) |
| Personas y empresas | Un cliente puede ser persona natural o jurídica; no se crean cuentas de usuario para clientes. | `RN-CLI-001`, `RF-CLI-001`, `UI-022` |
| Datos obligatorios del vehículo | Placa, marca, modelo y propietario registrado; color y año opcionales. No se habilita registro sin placa. | `DP-008` (Vehículo) |
| Relación con clientes | Un cliente puede tener varios vehículos; cada vehículo tiene exactamente un propietario actual. El cliente puede registrarse antes de tener vehículos. | `DM-003` V1, `RF-CLI-006`, modelo conceptual |
| Transferencia | Se permite; cierra el período anterior y abre otro, sin cambiar el cliente histórico de operaciones ya registradas cuando esas capacidades existan. | `RN-CLI-009`, `RF-CLI-009`, spec principal |
| Duplicados e inactivos | Unicidad de tipo y número normalizado de identificación; placa y VIN no se repiten entre vehículos activos o históricos. Desactivar conserva registros e impide su uso nuevo; reactivar recupera la misma ficha. | `RN-CLI-002`, `RN-CLI-006…009`, `RF-CLI-003`, `005`, `008`, `010`, `RNF-DAT-003` |
| Datos compartidos | La misma identidad de cliente y vehículo está disponible para ambos RUC; este cambio no mezcla ni implementa sus operaciones económicas. | `RN-FIS-004`, spec principal |

`DP-008` aparece dos veces en la fuente prioritaria: se referencia siempre indicando Cliente o Vehículo. La revisión aprobada por el usuario el 2026-09-11 sustituye cualquier obligatoriedad anterior diferente de DP-008. Se conserva la prohibición de registrar clientes sin identificación o vehículos sin placa en V1, y las longitudes CI/RUC ya confirmadas.

### Usuarios afectados y permisos confirmados

| Acción | Administrador | Vendedor | Encargado del taller |
|---|:---:|:---:|:---:|
| Consultar clientes y vehículos | Sí | Sí | Sí |
| Crear y editar clientes | Sí | Sí | Sí |
| Desactivar y reactivar clientes | Sí | No | No |
| Crear y editar vehículos y cambiar propietario | Sí | No | Sí |
| Desactivar y reactivar vehículos | Sí | No | No |
| Consultar auditoría | Sí | No | No |

Fuente: `actores-y-roles.md` §3.1–3.2, `RF-CLI-004…010`, `CT-001`. Se conservan `clientes.ver`, `clientes.gestionar`, `clientes.desactivar`, `vehiculos.ver`, `vehiculos.gestionar`, `vehiculos.desactivar` y `auditoria.ver`; los permisos se acumulan por unión de los roles existentes.

### Decisión aprobada sobre marcas de vehículo

El usuario aprobó que Administrador y Encargado del taller creen y editen marcas; solo el Administrador puede desactivarlas y reactivarlas; los tres roles pueden consultarlas. Esta decisión completa la asignación ausente en la matriz vigente, sin crear roles ni permisos personalizados. Su trazabilidad es `DP-008` (Marcas, revisión 2026-09-11).

### Reutilización, modificación y sustitución

- Reutilizar identidad, sesiones, CSRF, unión de permisos, navegación protegida, errores uniformes y mecanismos de auditoría existentes, respetando sus fronteras.
- Ampliar el producto con clientes, vehículos y marcas; incorporar sus contratos, navegación y eventos sin reemplazar autenticación ni introducir otro sistema visual.
- Reutilizar la dirección SAAS Dashboard, Nunito local, tokens y patrones compartidos documentados en `DESIGN.md`, incluidas sus correcciones posteriores. No sustituir la estética vigente ni copiar funciones demostrativas.

### Fuera de alcance

Órdenes de mantenimiento, diagnósticos, trabajos y servicios realizados, ventas, facturación, inventario, Kardex, pagos, saldos e historial económico; fotografías de vehículos; integraciones externas, migración desde Flutter y autoservicio de clientes.

También quedan fuera copropiedad, responsables distintos del propietario, reconstrucción compleja o retroactiva de propiedad, fusiones automáticas de duplicados y nuevos roles o permisos personalizados. El historial mínimo de períodos de propiedad permanece dentro del alcance porque ya es una obligación aprobada. No se implementarán los apartados económicos de `UI-021`, `UI-024` ni `RF-CLI-011` en esta capacidad.

## Capabilities

### New Capabilities

- `gestion-de-clientes`: registro, consulta, búsqueda, edición, validación de identidad, duplicados, desactivación y reactivación de clientes compartidos, con autorización y auditoría.
- `gestion-de-vehiculos-y-propiedad`: registro, búsqueda y edición de vehículos, unicidad, relación con clientes, propietario actual, períodos mínimos de propiedad y ciclo activo/inactivo, con autorización y auditoría.
- `catalogo-de-marcas-de-vehiculo`: consulta y administración de las marcas requeridas para registrar vehículos; permisos de consulta y gestión conforme a la distribución aprobada.

### Modified Capabilities

Ninguna spec principal cambia sus requisitos. `modelo-dominio-taller` se concreta sin alterar sus invariantes. Los cambios activos de identidad y sistema visual son dependencias; no se declaran archivados ni sincronizados por esta propuesta.

## Impact

- **Backend y datos:** nueva capacidad del **Monolito modular** que conserva clientes, vehículos, marcas, estados y períodos de propiedad. El **Modelo de dominio** sigue siendo conceptual. Persistencia, contratos concretos y migraciones se decidirán en diseño después de aprobar las specs; no se crea ni modifica `modelo-datos.md` en esta fase. Su actualización se realizará respetando la aprobación de propuesta, specs y diseño exigida por `AGENTS.md`.
- **API y seguridad:** extender contratos y documentación, conservar sesiones y CSRF, denegación por defecto, errores comprensibles y correlación. El diseño resolverá cómo reutilizar auditoría sin mutar directamente la persistencia de identidad ni confundir eventos de clientes con eventos de identidad.
- **Frontend:** incorporar las partes pertinentes de `UI-020…025` y marcas de `UI-033`; formularios con errores asociados, conservación de valores y contexto, estados de carga/vacío/error y acciones según permisos. Reutilizar componentes del sistema visual y verificar 360, 768, 1024 y 1440 px, teclado y foco.
- **Calidad y documentación:** aplicar **TDD** en la implementación posterior y pruebas backend, frontend y E2E; mantener OpenAPI, trazabilidad, glosarios y documentación afectada. El diseño evaluará ADR solo si aparece una decisión arquitectónica duradera no cubierta.
- **Dependencias:** `gestion-usuarios-autenticacion-roles` consta con 54/54 tareas terminadas, todavía activo; `establecer-sistema-visual-frontend` tiene 58/60 y aceptación visual pendiente según sus archivos. Sus propuestas existen en `master`. **Antes de aplicar este cambio, ambos cambios deberán estar verificados y cerrados mediante su flujo OpenSpec, con la aceptación visual explícita correspondiente.** La redacción de specs puede continuar; esta propuesta no verifica, cierra ni archiva esas dependencias.
- **Riesgos:** duplicados concurrentes, pérdida de períodos al editar propietario, reutilización accidental de inactivos, exposición excesiva de datos en auditoría, aplicación incorrecta de los permisos de marcas y divergencia del sistema visual. Las specs deberán cubrir estos resultados antes del diseño.

### Contradicciones e información insuficiente

1. `RN-CLI-003` contempla ausencia de identificación y otros textos condicionan placa a disponibilidad. Para este registro prevalece `DP-008`: ambas son obligatorias. La documentación afectada deberá precisarse sin inventar excepciones de consumidor final.
2. Excluir un historial «complejo» no elimina los períodos de propiedad exigidos por la spec principal. Se conserva el mínimo aprobado y se aplazan trabajos y documentos vinculados.
3. La solicitud refiere el sistema visual como aprobado; el registro visual y las tareas aún indican aceptación humana pendiente; existe una edición ajena de `DESIGN.md` que retira esa etiqueta. Se utiliza la dirección visual indicada por el usuario y se registra la discrepancia, sin dar por cerrado el cambio anterior.
4. La fuente de decisiones aún describe infraestructura sin dominio funcional; arquitectura y tareas de identidad documentan su implementación. Se reutiliza esa base sin presentar el resto del negocio como implementado.
5. No se define aquí validación tributaria, verificación externa de documentos ni reglas de consumidor final. Tampoco se introduce como decisión confirmada una matriz adicional entre tipo de persona y tipo de identificación; los criterios observables deberán concretarse antes de aprobar specs si se pretende restringir combinaciones.
6. La retención de auditoría sigue aplazada antes de producción conforme a `RNF-AUD-006` y `RNF-DAT-004`; este cambio no autoriza purgas.

### Trazabilidad y fuentes consultadas

- `AGENTS.md`, su referencia terminológica y `openspec/config.yaml`: precedencia y aprobaciones; secuencia obligatoria `proposal → specs → design → tasks → apply → verify → archive`.
- `docs/negocio/decisiones/decisiones-confirmadas.yaml` completo: `DP-008` Cliente/Vehículo, `CT-001`, `DM-003` V1 y separación fiscal.
- `docs/arquitectura/modelo-dominio.md` completo, incluido su diagrama de clases: Cliente, Vehículo, MarcaVehiculo, PeriodoPropiedad e invariantes.
- `openspec/specs/modelo-dominio-taller/spec.md`: datos compartidos, propiedad e historia, coherencia documental.
- `docs/negocio/producto/vision.md`, secciones aplicables de `alcance-v1.md` y `reglas-negocio.md`, y `glosario.md`: `RN-FIS-004`, `RN-SEG-001…007`, `RN-CLI-001…009`, `RN-CAT-003`.
- `docs/negocio/requisitos/actores-y-roles.md`, `requisitos-funcionales.md`, `requisitos-no-funcionales.md`, `casos-de-uso.md`, `interfaz-y-navegacion.md` y `matriz-trazabilidad.md`, en las secciones relacionadas: `RF-CLI-001…010`, `RF-CLI-012`, auditoría `RF-AUD-001`, `003`, `005`; `CU-004`, `CU-005`, catálogo de `CU-006`; `UI-020…025`, marcas de `UI-033`; `RNF-SEG-002…007`, `RNF-INT-005`, `008`, `010`, `RNF-REN-005…006`, `RNF-USA-001…009`, `011`, `RNF-MAN-001…010`, `RNF-AUD-001…006`, `RNF-DAT-001`, `003…005`.
- `docs/tecnico/arquitectura-inicial.md`, `glosario-tecnico.md`, C4 de contexto y contenedores, ADR-0001, ADR-0002 y ADR-0003.
- Propuesta, cuatro specs, diseño y tareas de `openspec/changes/gestion-usuarios-autenticacion-roles/`; catálogo de permisos en `backend/src/identity/domain/authorization.py` como comprobación del estado actual.
- Propuesta, dos specs, diseño con corrección normativa y tareas de `openspec/changes/establecer-sistema-visual-frontend/`, `DESIGN.md` y `docs/tecnico/revision-visual-frontend.md`.

### Punto de aprobación

La aprobación condicionada del usuario queda satisfecha al incorporar exactamente los nuevos campos obligatorios/opcionales, la distribución de marcas y la condición de cierre previo de dependencias, sin ampliar el alcance. Se autorizaron el commit y su registro en `master`, y continuar con el artefacto de specs en `develop`. Las specs se entregarán para revisión sin avanzar a diseño ni implementar código.

### Sincronización documental

- **En esta revisión:** actualizar `docs/negocio/decisiones/decisiones-confirmadas.yaml` con la sustitución explícita de DP-008 y los permisos de marcas; conservar esta propuesta como registro de aprobación y trazabilidad.
- **Después de revisar las specs:** sincronizar `docs/negocio/producto/reglas-negocio.md` (RN-CLI-003 y obligatoriedad), `docs/negocio/requisitos/requisitos-funcionales.md` (RF-CLI-001/007 y marcas), `actores-y-roles.md` (permisos fijos de marcas), `casos-de-uso.md` (CU-004/005/006), `interfaz-y-navegacion.md` (UI-022/025/033) y `matriz-trazabilidad.md` (capacidades y cobertura). Mantener sus referencias terminológicas.
- **Durante diseño y aplicación aprobados:** revisar `alcance-v1.md`, glosarios, modelo y diagrama de dominio para añadir precisiones que sean necesarias, sin cambiar sus invariantes; actualizar el modelo de datos solo después de las aprobaciones requeridas. Actualizar OpenAPI, arquitectura y matriz de pruebas cuando existan sus contratos y evidencia.
- **Dependencias:** sus respectivos registros de verificación, aceptación visual, tareas y archivo deberán reflejar el cierre real antes de `apply`. No reinterpretar pruebas anteriores como cierre.

La facturación futura conserva su propia especificación: este cambio no valida ni emite comprobantes y no obliga a completar email o dirección para registrar un cliente.
