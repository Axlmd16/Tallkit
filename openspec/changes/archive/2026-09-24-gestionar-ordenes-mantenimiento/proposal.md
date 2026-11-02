# Órdenes de mantenimiento

Estado: propuesta aprobada para crear specs. Fecha: 2026-09-24, America/Guayaquil (inspección: 2026-09-23). El usuario aprobó la propuesta con las recomendaciones P1…P5 tal como están redactadas («Aprobar P1–P5») y autorizó registrar cada artefacto aprobado mediante commit en `develop` y merge local en `master`, sin push. Las recomendaciones de P1…P5 quedan como decisiones aprobadas de este cambio; la tabla de pendientes conserva el contexto de la revisión original. Esta aprobación no aprueba anticipadamente specs, diseño, tareas ni implementación.

## Why

Tallkit ya registra clientes, vehículos, servicios y operaciones comerciales, pero todavía no permite registrar el trabajo del taller ni consultar sus fotografías e historial. Esta séptima entrega incorporará el **Mantenimiento** como caso operativo del RUC artesanal, sin anticipar la integración económica y de repuestos de la funcionalidad 8.

## What Changes

- Crear, buscar por número/cliente/placa, filtrar por estado y fechas, paginar, consultar y editar órdenes abiertas; registrar fecha, kilometraje, diagnóstico, observaciones, creador y fechas de auditoría. Diagnóstico y servicios se completan progresivamente. No añadir motivo de ingreso ni observaciones por línea sin requisito vigente.
- Seleccionar clientes y vehículos activos existentes; validar propietario vigente al crear o sustituir la selección, sin transferir propiedad. Conservar cliente, vehículo y datos identificativos históricos de la atención aunque cambien sus fichas o propietario; no revalidar una vinculación histórica contra el propietario actual al consultar o reabrir.
- Agregar servicios activos del catálogo, copiar nombre y **precio referencial**, conservar **precio aplicado** independiente y permitir cambiarlo, editar cantidad o retirar líneas mientras corresponda. Calcular subtotales y total en servidor. Ninguna acción modifica el precio del catálogo.
- Adjuntar, visualizar y retirar fotografías con descripción opcional (UI-073), autor y fecha; validar contenido, límites y autorización. Conservar entradas ante fallos de carga, evitar referencias rotas y permitir recuperar la limpieza pendiente.
- Finalizar explícitamente y bloquear cambios ordinarios, incluidos servicios y fotografías; reabrir con motivo, actor, fecha y estado anterior. Conservar cada cierre y reapertura, identidad y número, sin duplicar líneas ni imágenes. La discrepancia sobre edición del trabajo anterior se resuelve en la decisión P2.
- Consultar historia por cliente y vehículo, con fecha, número, estado y resumen de servicios, desde sus fichas existentes; conservar acceso autorizado a registros relacionados desactivados.
- Reutilizar permisos, auditoría, configuración artesanal y sistema visual Tallkit; proteger reintentos y concurrencia, incluida edición contra finalización y carga de fotografía contra cierre. Los estados solo cambian por acciones autorizadas.

### Decisiones confirmadas que se conservan

- CT-001 y DM-003: tres roles acumulables; un propietario vigente por vehículo; historia independiente de transferencias posteriores.
- DP-004/017/020: sin descuentos; precios finales con impuesto incluido cuando corresponda; Administrador y Encargado pueden ajustar el precio aplicado sin motivo obligatorio. El catálogo admite USD con hasta dos decimales y cero; CU-017 rechaza precios negativos, no cero.
- DP-007/015: reapertura explícita y auditada; un retorno atribuible al trabajo anterior agrega una **Intervención correctiva**, conserva la inicial y no crea un cargo. No constituye garantía ni asignación de mecánico.
- RN-TAL-007 y RF-TAL-003: kilometraje no negativo; si disminuye respecto del último conocido, advertencia y confirmación explícita autorizada, sin prohibición absoluta.
- DP-018/021: ninguna finalización crea factura ni confirma venta. La comprobación de repuestos pendientes deberá incorporarse con la funcionalidad 8; hoy no existe venta vinculada y no se simulará.

### Permisos existentes aplicables

| Acción | Administrador | Encargado del taller | Vendedor solo |
|---|---|---|---|
| Consultar órdenes, historial y fotografías | Sí | Sí | Solo con venta vinculada; no disponible en esta entrega |
| Crear y editar mientras esté abierta | Sí | Sí | No |
| Agregar/editar/retirar servicios y ajustar precio aplicado | Sí | Sí | No |
| Adjuntar/retirar fotografías mientras esté abierta | Sí | Sí | No |
| Finalizar y reabrir con motivo | Sí | Sí | No |

Se reutilizan `mantenimientos.ver`, `.gestionar`, `.cambiar_precio_servicio`, `.gestionar_fotos`, `.finalizar` y `.reabrir`. La matriz vigente ya permite reapertura al Encargado; no corresponde aplicar el valor por defecto más restrictivo sugerido para el caso de que faltara documentación. La consulta de clientes o vehículos por sí sola no concede acceso a sus órdenes ni imágenes.

### Decisiones pendientes para aprobar la propuesta

Estas recomendaciones no son requisitos aprobados ni autorizan persistencia o implementación.

| ID | Información insuficiente o discrepancia | Recomendación para aprobación | Alternativa e impacto |
|---|---|---|---|
| P1 | No se encontró una regla de órdenes abiertas simultáneas por vehículo. La única venta abierta por mantenimiento es otra restricción. | Una sola orden en estado registrado o reabierto por vehículo; una reapertura también comprueba este límite. | Admitir varias exige distinguir casos simultáneos en selección, avisos e historial. |
| P2 | La solicitud permite volver a editar una orden; RN-TAL-017/018, DP-015 y la spec conceptual preservan la intervención inicial y reservan la reapertura a corrección atribuible. | Conservar el flujo aprobado: registrado → finalizado → reabierto → finalizado; reapertura añade intervención correctiva editable, manteniendo intactos los cierres y trabajos previos. Una falla nueva crea otra orden. | Si se necesita corregir administrativamente datos del trabajo inicial, definir expresamente esa segunda causa y su alcance histórico antes de specs; no confundirla con un retorno correctivo. |
| P3 | RF-TAL-013 exige datos completos sin enumerarlos; no define precisión del kilometraje ni cantidades de servicio. | Crear con cliente, vehículo, fecha de apertura y kilometraje entero en km; fecha actual por defecto y no futura. Finalizar con diagnóstico no vacío y al menos un servicio de cantidad entera positiva; observaciones y fotos opcionales. Servicios repetidos se mantienen como líneas independientes, sin fusionar precios; se permite precio cero. En correcciones, registrar servicios sin cargo preservando los importes iniciales. | Permitir cierre sin servicios, kilometraje desconocido, fracciones de km o cantidades fraccionarias cambia validaciones; confirmar si el taller lo necesita. |
| P4 | DA-002 sigue abierta: formatos, tamaño, cantidad y conservación de fotos. | JPEG, PNG y WebP estáticos, máximo 10 MiB por imagen y 20 imágenes vigentes por orden, con límite de 25 megapíxeles; almacenamiento privado local, consulta autenticada y conservación mientras exista la orden, sin caducidad automática. Retiro autorizado conserva evento y elimina el archivo mediante limpieza recuperable; respaldos mantienen su ciclo propio. | Otros límites pueden adecuarse al volumen real; almacenamiento externo añade operación y dependencia sin necesidad actual. Esta decisión no cierra todo DA-003 ni define retención legal. |
| P5 | DP-006 numera operaciones económicas; no define número de orden operativa. | Número interno propio `ART-OT-000001`, asignado al crear, continuo, único y conservado al reabrir; independiente de ART-SER y de cualquier secuencia fiscal. | Reutilizar ART-SER confundiría una orden sin deuda con la futura operación económica artesanal. |

Para mantener el alcance solicitado se recomienda mostrar únicamente el total final de servicios de la orden, sin desglose tributario ni saldo. Se conserva el ámbito artesanal y la referencia tributaria de los servicios, pero no se confirma una operación económica ni se consume su numeración. Cualquier desglose fiscal futuro deberá resolver vigencia y conservar valores mediante la configuración existente; no se asume una tasa ni exención. La aprobación de P3 no extiende automáticamente DP-025, que corresponde a ventas comerciales.

No existe kilometraje actual en `Vehicle`: se propone consultar las lecturas históricas del taller y conservar cada lectura en su atención, sin añadir ni sobrescribir un acumulado en el vehículo. El tratamiento exacto de ordenación temporal y confirmación frente a nuevas lecturas concurrentes se especificará en la siguiente fase.

### Fuera de alcance

Selección, reservas o consumo de repuestos; ventas vinculadas; cobros, deuda y crédito artesanal; operación económica de servicios; facturación/SRI; devoluciones, reembolsos y notas de crédito; descuentos; presupuestos, aprobación de cliente, mecánicos, horas, comisiones, agenda, garantías, firmas, notificaciones externas, informes avanzados y PDF. No se añaden secciones simuladas ni botones sin función. No se elimina definitivamente una orden.

La cancelación existe en la línea objetivo RN-TAL-002/005 y RF-TAL-014, pero esta entrega la aplaza conforme al alcance expreso solicitado; no se elimina la regla de la línea base ni se presenta su cobertura como completa. La funcionalidad 8 incorporará la coordinación con repuestos y ventas mediante otro cambio.

## Capabilities

### New Capabilities

- `ordenes-de-mantenimiento`: registro operativo, relación histórica cliente/vehículo, estados, intervención inicial y correcciones, permisos, finalización, reapertura y consistencia.
- `servicios-aplicados-al-mantenimiento`: selección de catálogo, cantidad, precio aplicado, total calculado e historia sin efectos económicos.
- `fotografias-de-mantenimiento`: carga, consulta privada, retiro, validación, límites, trazabilidad y recuperación ante fallos.
- `historial-de-mantenimientos`: consulta autorizada por cliente/vehículo, filtros, paginación y navegación desde fichas.

### Modified Capabilities

Ninguna con la recomendación P2: se concreta la línea conceptual sin reemplazarla. Si se aprueba una reapertura administrativa que cambie sus reglas, será necesario revisar esta sección y proponer el delta de `modelo-dominio-taller` antes de generar specs.

## Impact

### Estado real y dependencias

- Árbol inicialmente limpio en `develop`, HEAD `809cc53`; `master` apunta a `047bce8`. No se crearon ramas ni commits. Los artefactos nuevos son borradores locales y deberán alcanzar `master` con autorización antes de que la fase siguiente dependa de ellos.
- Identidad, clientes/vehículos, configuración, catálogo, compras/inventario y ventas tienen código, API y pantallas. El texto de bootstrap de AGENTS/config/decisiones y la introducción del README está desactualizado; no se utiliza para negar la implementación existente.
- `openspec list --json`: compras 202/202 y ventas 268/268 tareas marcadas; clientes 47/49 y catálogo 70/71. Todos permanecen activos. En clientes falta la verificación global 9.5 y el cierre 9.7; en catálogo falta 13.7 de entrega/sincronización. Los contadores son estado documental, no evidencia nueva de pruebas aprobadas. Este cambio no continúa ni archiva esos cambios.
- La línea principal todavía no contiene specs funcionales de clientes, catálogo y ventas; sus deltas están en cambios activos. Será necesario conservar esta distinción en trazabilidad y verificar las dependencias antes de apply.
- `customer_registry` ya conserva `OwnershipPeriod`, propietario actual derivado, inactivación y versión. No contiene kilometraje. Se ampliarán únicamente las interfaces y consultas necesarias para el taller, sin duplicar fichas ni mutar persistencia ajena.
- `catalog` contiene `Service`, descripción, precio referencial decimal, selección tributaria artesanal e inactivación. Se reutiliza; no se permiten servicios libres.
- `identity` ya expone permisos y `record_audit_event`; existen patrones de versión esperada, transacción e idempotencia en módulos anteriores. Se adoptarán dentro del diseño del taller, sin refactorización transversal anticipada.
- Existe `FileSystemStorage` como almacenamiento por defecto; no se encontraron modelos de adjuntos ni API de cargas, y no hay configuración explícita de `MEDIA_ROOT`. Las fotografías necesitan habilitación privada real y cobertura de operación; no existe un mecanismo completo que pueda darse por reutilizado.
- El frontend ya prevé `/maintenance` en navegación, pero no implementa la capacidad. Se integrarán lista, editor y ficha con los componentes Tallkit y las fichas de clientes/vehículos. Se mantienen tipografías locales, permisos, mensajes, foco, accesibilidad y estados de carga/vacío/error/éxito.

### Riesgos y verificación prevista

El diseño deberá concretar modelos, restricciones, índices, migraciones aditivas, contratos API/OpenAPI, errores, filtros, paginación, atomicidad, idempotencia, orden de bloqueos y recuperación de archivos, después de aprobar specs. No se crean tablas ni se modifica `modelo-datos.md` en esta fase.

Las specs cubrirán creación/edición válida; vehículo incompatible; precio referencial y ajustado; catálogo modificado; fotografías válidas/invalidas y acceso denegado; cierre incompleto; edición de cerrada; reapertura y nuevo cierre; carreras de edición/finalización y de fotografías/cierre; selección y consulta histórica con entidades inactivas; reintentos sin duplicación; separación fiscal y ausencia de movimientos, ventas, pagos o deudas. Se incluirá consulta desde clientes/vehículos y continuidad de las capacidades anteriores.

Apply seguirá TDD y comprobará backend, frontend, integración, concurrencia PostgreSQL y recorrido visual cuando sea posible. Se usarán los comandos oficiales `make check`, `make test`, `make audit`, `make compose-check`, validación OpenAPI y OpenSpec, más las pruebas enfocadas que determine el diseño. No se han ejecutado estas verificaciones funcionales en la fase de propuesta ni se afirma que las dependencias estén nuevamente verificadas.

La documentación de reglas, requisitos, matriz de permisos, trazabilidad, interfaz y glosario se sincronizará solo con decisiones aprobadas. Los puntos de extensión para la funcionalidad 8 serán la identidad estable de la orden, la historia de intervenciones, la separación del total operativo frente al importe exigible y las fronteras públicas entre módulos; no se crearán integraciones vacías.

## Fuentes consultadas y trazabilidad

- Instrucción adjunta del usuario, `AGENTS.md`, `AGENTS-glossary-reference.md`, `openspec/config.yaml`; CLI `new change`, `status`, `instructions` y `list`.
- Leídos completos: `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`. Aplican CT-001, DM-003, DP-004, DP-006/007/008, DP-015/017/018/020/021 y DA-002.
- `openspec/specs/modelo-dominio-taller/spec.md`; `openspec/specs/sistema-visual-frontend/spec.md` y `patrones-de-pantalla-frontend/spec.md` (fundamentos y patrones relacionados).
- `docs/negocio/producto/vision.md`, `alcance-v1.md` (apartados de clientes y taller), `reglas-negocio.md` (RN-TAL-001…021, RN-CON-006/007), `glosario.md` (términos de esta propuesta).
- `docs/negocio/requisitos/actores-y-roles.md` §3.5; `requisitos-funcionales.md` RF-TAL-001…021 y RF-CLI-009/011; `casos-de-uso.md` CU-016/017/019; `interfaz-y-navegacion.md` UI-070…078; `requisitos-no-funcionales.md` RNF-SEG-009, RNF-INT, RNF-REN-005/007, RNF-DIS-002, RNF-DAT-003/004 y RNF-USA; consultas de la matriz de trazabilidad. RF-TAL-008…012/014 y UI-074/077 quedan fuera o pendientes en esta entrega.
- Delta `openspec/changes/gestionar-catalogos-productos-servicios-proveedores/specs/catalogo-de-servicios/spec.md`; pendientes en los `tasks.md` de los cambios activos. No se usaron documentos históricos ni Flutter como requisitos.
- `README.md`, `docs/tecnico/arquitectura-inicial.md`, `docs/architecture/c4-containers.md`, ADR-0001/0003/0004. Los ADR de publicación de inventario y ventas se revisarán si el diseño afecta sus contratos; aquí no se altera ese comportamiento.
- Inspección de `backend/src/customer_registry/models.py`, `application/vehicles.py`, `application/sales_references.py`; `catalog/application/services.py`, `catalog/domain/validation.py`; `identity/domain/authorization.py`, `identity/application/audit.py`; configuración de almacenamiento y búsquedas en backend/infra; inventario de código sales/configuración y pantallas existentes; `frontend/src/app/navigation.ts` y fichas de cliente/vehículo.

## Límite de aprobación

`openspec/config.yaml` exige «No incluir diseño técnico ni código y esperar aprobación explícita antes de crear specs». Se solicita aprobar o corregir P1…P5 y el alcance de esta propuesta; después, registrar el artefacto aprobado en `master` con autorización explícita para Git. La disponibilidad técnica de `specs` o `design` en el CLI no sustituye la aprobación humana ni modifica el orden local proposal → specs → design → tasks → apply. No se ha aprobado, implementado, desplegado ni archivado esta capacidad.

### Comprobaciones de esta fase

- `openspec status --change gestionar-ordenes-mantenimiento --json`: salida 0; proposal presente, specs/design ausentes y tasks bloqueadas. `done` describe existencia del artefacto, no aprobación del usuario.
- `openspec validate gestionar-ordenes-mantenimiento --strict --json`: salida 1, único error «Change must have at least one delta». La validación completa queda pendiente de crear las specs tras aprobación; no se añadieron deltas ficticios para evitar el error.
- `git status --short`: únicamente el directorio nuevo de este cambio sin seguimiento. No hay modificación de código ni migración que ejecutar en esta fase.
