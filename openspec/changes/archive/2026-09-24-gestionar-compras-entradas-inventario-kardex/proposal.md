## Why

El sistema ya dispone de identidad, clientes/vehículos, configuración y catálogos, pero no registra compras ni permite explicar existencias reales. Esta quinta funcionalidad incorporará **ingresos de mercadería**, entradas iniciales, ajustes y **Kardex**, integrados con los permisos y la experiencia existentes.

Estado: propuesta aprobada para desarrollar specs. Fecha: 2026-09-20. El usuario autorizó registrar exclusivamente esta propuesta y sus archivos auxiliares en `master` y continuar («sí, hazlo y continúa»), después de solicitar el siguiente artefacto. Esta aprobación comprende las recomendaciones siguientes; no aprueba anticipadamente specs, design, tasks ni implementación. Las referencias a decisiones pendientes en el texto conservan el contexto de la revisión inicial y quedan resueltas por esta aprobación en el alcance aquí descrito.

## What Changes

- Gestionar compras como **ingresos de mercadería**, sin crear una orden de compra independiente: crear, editar, listar y consultar borradores; proveedor registrado, fecha del documento, referencia externa y observaciones; líneas de productos con cantidades, costos e impuestos. Guardar borrador no afecta stock ni consume numeración. Confirmar recibe todas las líneas en la única **bodega** comercial, asigna número interno y conserva datos históricos.
- Aplicar el **costo promedio ponderado** ya aprobado en RN-INV-005…007. Separar costo de compra, costo inventariable y precio final de venta; una compra nunca modifica automáticamente el precio del catálogo. Los cálculos y validaciones económicos pertenecen al backend y usan decimales.
- Registrar toda variación mediante movimientos inmutables con origen, referencia, usuario y momento efectivo. Distinguir compra, carga inicial, ajuste y sus compensaciones. Las entradas manuales corrigen diferencias comprobadas; una adquisición a proveedor debe registrarse como ingreso, incluso cuando el proveedor sea ocasional.
- Consultar existencias por producto, código, nombre, categoría y estado con paginación; identificar stock cero y conservar acceso a productos inactivos con stock o historia. Mostrar presentación y unidad. Incorporar acceso a existencias y Kardex desde la ficha de producto, sin edición directa de saldo.
- Permitir al Administrador ajustes de entrada/salida con motivo obligatorio, vista previa del efecto y confirmación explícita. Conservar historial y rechazar stock negativo, doble confirmación y reintentos incompatibles.
- Consultar Kardex cronológico por producto, fechas, tipo, origen y usuario, con entrada, salida, saldo, responsable y vínculo autorizado al documento. Los filtros y páginas conservan los saldos reales anteriores; filtrar un tipo no convierte la suma de las filas visibles en el saldo físico. Mantener orden estable aunque coincidan las horas.
- Garantizar que confirmación, numeración, movimientos, valoración y auditoría se completen juntos o se reviertan juntos. La historia de movimientos explica el saldo operativo y permite reconciliarlo. Las operaciones simultáneas no pueden duplicar entradas ni producir saldos negativos.
- Integrar pantallas reales de compras, detalle, existencias, ajustes y Kardex: filtros, paginación, formularios con líneas, errores por campo, estados de carga/vacío/error/éxito, confirmaciones comprensibles y navegación accesible. Reutilizar el sistema visual y las bibliotecas instaladas.

### Decisiones confirmadas y permisos

Se conservan DP-001/002 (bodega única y stock no negativo), DP-006 (serie comercial de ingresos, inicialmente COM-ING), DP-009 (presentaciones completas), DP-011 (proveedor obligatorio), DP-017/018 (valores históricos y documentos internos), CT-001 y RN-INV-001…016. El contenido decimal de una presentación no habilita fracciones del producto: doce filtros recibidos son doce unidades vendibles, no una caja ni doce fracciones de una presentación.

La matriz ya existe en `actores-y-roles.md` y en `identity/domain/authorization.py`; no se crean roles ni permisos personalizados.

Decisión confirmada por el usuario en esta tarea (2026-09-20): el Administrador clasificará el IVA de compra por línea como recuperable o no recuperable; se excluye del costo el recuperable y se incluye el no recuperable. No se incluye recuperación parcial. Esta decisión no aprueba todavía el resto de la propuesta.

| Operación | Administrador | Vendedor | Encargado del taller | Permiso existente |
|---|---|---|---|---|
| Consultar compras y documento de proveedor | Sí | No | No | `ingresos.ver` |
| Crear y editar borradores | Sí | No | No | `ingresos.crear` |
| Confirmar recepción completa | Sí | No | No | `ingresos.confirmar` |
| Anular compra confirmada | Sí | No | No | `ingresos.anular` |
| Consultar existencias y Kardex | Sí | Sí | Sí | `inventario.ver` |
| Consultar valoración y costos | Sí | No | No | `inventario.ver_valorizacion`, `productos.ver_costos` según superficie |
| Carga inicial, ajustes y sus correcciones | Sí | No | No | `inventario.ajustar` |

Los roles se acumulan. El Kardex operativo no revela costos, impuestos, totales de compra ni datos privados del proveedor, tampoco mediante enlaces, respuestas de error o documentos anidados. Abrir el origen exige el permiso del documento, además del de consulta del Kardex.

### Recomendaciones que requieren aprobación

Estas recomendaciones concretan cuestiones todavía abiertas; no se presentan como decisiones aprobadas ni como una determinación tributaria del negocio.

1. **Captura de impuestos de compra:** se recomienda capturar costo unitario sin impuesto y una selección tributaria comercial explícita por línea, inicialmente sugerida desde el producto. La recuperabilidad por línea ya fue confirmada arriba: no se infiere del proveedor, tarifa o RUC. Se propone no añadir retenciones, impuestos compuestos, gastos de importación ni contabilidad en esta entrega. La captura del costo sin impuesto y esta delimitación siguen pendientes de aprobación junto con la propuesta.
2. **Precisión y redondeo:** USD; costos unitarios no negativos con hasta seis decimales, cantidades positivas enteras de presentaciones completas expresadas como decimales, tarifas con la precisión configurada. Rechazar exceso de precisión al capturar. Redondear base e impuesto por línea a centavos con HALF_UP y sumar esos valores para el total; mantener costo promedio con seis decimales. El diseño deberá explicar los residuos de valoración y asegurar valor cero al agotar existencias, sin perder valor por redondeos sucesivos. Alternativa: otros redondeos o cálculo global del impuesto, que deben elegirse explícitamente si corresponden al documento del negocio.
3. **Fechas:** admitir documento del proveedor anterior o del día, sin contabilización retroactiva ni fecha futura. Proponer que la fecha operativa tributaria de la compra sea la del documento del proveedor, dentro de una vigencia configurada; el movimiento se registra al confirmar, con hora del servidor y visualización en America/Guayaquil. Nunca recalcular el Kardex anterior. Esta concreción de «fecha operativa» debe aprobarse antes de specs; la alternativa es restringir compras a la fecha de recepción, que no cubre documentos antiguos con otra tarifa.
4. **Referencia externa y duplicados:** admitir FACTURA, NOTA_DE_VENTA y OTRO como referencias documentales, sin certificar validez SRI, y SIN_DOCUMENTO para compras ocasionales. Exigir número/referencia para los tres primeros; impedir repetición por proveedor, tipo y referencia normalizada, incluidos documentos anulados. Conservar ceros iniciales, quitar espacios exteriores y comparar mayúsculas sin eliminar puntuación significativa. SIN_DOCUMENTO exige explicación y advertencia de coincidencias; no promete detectar compras duplicadas que carecen de referencia. La corrección de una compra anulada puede conservar la referencia solo mediante reemplazo expresamente vinculado, sin dos compras confirmadas vigentes para el mismo documento. Alternativa: referencia libre sin tipos, con menor control de duplicidad.
5. **Anulación segura:** conservar borrador → confirmado → anulado. Revertir una compra completa solo si cada producto conserva como último efecto el de esa compra, existe cantidad suficiente y puede restaurarse exactamente su valoración previa. Si hay movimientos posteriores en cualquiera de sus productos, bloquear y explicar la dependencia; no reconstruir valoraciones retrospectivas. Un reintento devuelve la anulación existente sin duplicarla. Los borradores siguen siendo editables y no se eliminan mediante borrado de historia. Alternativa: revalorizar la cadena posterior, de complejidad y alcance mayores.
6. **Carga inicial y ajustes:** carga inicial por producto únicamente antes de cualquier movimiento, con motivo y costo inventariable explícito, sin proveedor ficticio; una vez registrada, las diferencias se corrigen como ajustes. Ajustes de entrada con costo documentado explícito y salidas al promedio vigente. Corregir una carga o ajuste erróneo mediante reversión vinculada bajo la misma condición conservadora de último movimiento; con dependencias posteriores, permitir un nuevo ajuste de la diferencia física comprobada a valoración vigente, explicando que no reescribe ni restituye automáticamente los costos antiguos. No ofrecer ajustes como ventas, consumos o devoluciones encubiertos.
7. **Delimitación de entrega:** posponer alertas de umbral y archivos adjuntos; conservar referencia y observación textual. RF-INV-011/UI-046 respaldan las alertas, pero son un «Debería» y requieren configuración adicional. RF-INV-001 y la spec conceptual admiten evidencias opcionales, con política de archivos pendiente. Esta exclusión necesita aprobación y debe reflejarse como cobertura parcial, sin borrar esos requisitos generales. Alternativa: incluirlos y especificar también umbrales y política de archivos antes de implementar.

### Fuera de alcance

Ventas, cobros, crédito, cuentas por cobrar/pagar, pagos a proveedores, mantenimiento y consumos, devoluciones físicas, contabilidad, facturación electrónica, reportes avanzados, exportaciones, respaldos, reservas, multibodega, traslados, órdenes de compra separadas, recepciones parciales y mercancía en tránsito. Tampoco desarme/armado de kits, lotes, series de producto, caducidades ni conversiones de unidades. Los kits comprados pueden recibirse intactos. No importar automáticamente datos Flutter ni generar existencias ficticias. Las alertas y adjuntos quedan propuestos como aplazamiento explícito en el punto 7.

## Capabilities

### New Capabilities

- `compras-e-ingresos-de-mercaderia`: borradores, recepción total, importes e impuestos históricos, referencias, numeración, duplicados, anulación y permisos.
- `existencias-y-ajustes-de-inventario`: saldo por producto/bodega, carga inicial, ajustes, correcciones, valoración, conciliación, concurrencia y autorización.
- `kardex-de-productos`: historia inmutable, orden estable, saldos con filtros/paginación, orígenes y proyecciones según permisos.

### Modified Capabilities

No se sustituye ninguna regla principal aprobada. Las capacidades concretan `modelo-dominio-taller` y consumen `configuracion-operativa-y-fiscal`, `autorizacion-y-navegacion` y el sistema visual. El aplazamiento de evidencias debe documentarse como cobertura parcial del requisito conceptual, no como su eliminación. El catálogo conserva su contrato sin campos editables de stock; la ficha incorporará una consulta separada de inventario. Antes de specs se revisará la sincronización del catálogo activo para no duplicar ni sobrescribir sus deltas.

## Impact

### Estado real y dependencias

- Inspección en `develop`, con cambios locales ajenos en backend, frontend, documentación y tareas de clientes; se preservan. Este cambio queda como borrador local, sin commit, rama, merge, push ni despliegue autorizado.
- Durante la inspección se registraron externamente commits en `develop`, incluidos `75416c3` y `f3569f7`; al terminar solo queda sin seguimiento este nuevo cambio. No fueron creados por esta tarea. Se deberá volver a comprobar el estado Git antes de cualquier integración autorizada.
- Existen modelos, servicios, API y pantallas de identidad, clientes, configuración y catálogos. No se encontraron modelos de compras, saldos ni movimientos en `backend/src/`. `Product` contiene contenido con seis decimales, precio de venta con dos y referencia de impuesto; `MeasurementUnit` no define fraccionamiento. `Supplier` conserva identidad y estado, sin compras ni pagos.
- `openspec list --json`: clientes 45/49 tareas, catálogos 70/71 y aplicación del catálogo visual 20/28. Son estados declarados, no comprobaciones ejecutadas en esta tarea. Identidad y configuración tienen cambios archivados. Catálogos aún no tiene sus tres capacidades sincronizadas en `openspec/specs/`; no se archiva ni se declara cerrado desde este trabajo.
- Se reutilizarán autorización, sesión/CSRF, auditoría, productos/proveedores y servicios públicos de configuración/numeración. Se necesitan interfaces de consulta de catálogos adecuadas para operaciones confirmables; no mutaciones directas de modelos ajenos. No se propone sustituir los módulos anteriores ni añadir dependencias.
- Persistencia de compras/inventario, contratos API, migraciones aditivas, restricciones, índices, protección histórica, reconciliación y orden transaccional se decidirán en design tras las aprobaciones. La inspección del código no prueba ausencia de datos operativos en una instalación: el plan de migración deberá verificarlo sin doble contabilización antes de cualquier carga.
- Frontend reutilizará `shared/ui`, `features/catalog-common`, cliente HTTP, seguimiento de intenciones, filtros URL y TanStack Query. `ProductsPage` ya usa `ElevatedDataList`, `Field`, `InlineNotice`, `StatusBadge` y confirmaciones; se conservarán Nunito, tokens y comportamiento adaptable de DESIGN.md.

### Contradicciones, información insuficiente y riesgos

- AGENTS, decisiones y párrafos de arquitectura todavía describen un bootstrap sin dominio; README y código muestran módulos implementados. Se registra la obsolescencia de esa descripción, sin reconstruir capacidades existentes.
- La política de promedio ponderado sí está confirmada. El precio de venta de dos decimales y la tarifa de cuatro decimales no resuelven redondeo de compras. No hay campo de recuperabilidad ni tipos de documento de compra existentes; la primera se aprobó por línea en esta tarea y los tipos siguen propuestos.
- DP-011 exige proveedor en un ingreso: no se elude usando «entrada manual». La carga de saldo previo y el ajuste se proponen como operaciones de inventario diferentes de una adquisición.
- ADR-0004 exige bloquear definiciones tributarias por identificador y usar transacción exterior del consumidor. `configuration_resolver.py` ordena códigos, no bloquea `TaxDefinition`, devuelve referencias de modelos y abre un bloque atómico propio. El diseño debe revisar esta brecha junto con numeración y sucesiones, hacer solo las correcciones necesarias de integración y probar el contrato aceptado; la existencia del servicio no demuestra seguridad concurrente.
- Anulaciones conservadoras pueden bloquear una compra aunque quede cantidad suficiente; el mensaje debe explicar la dependencia de valoración. No permitir correcciones silenciosas ni asumir que una devolución física equivale a anulación.
- Riesgos principales: redondeos acumulados, cargos tributarios mal clasificados, doble carga inicial, cambios concurrentes de catálogo/configuración, doble recepción, exposición de costos en Kardex, saldo reiniciado al paginar y regresión de módulos con trabajo local pendiente.

### Fuentes consultadas y trazabilidad

- `AGENTS.md`, referencia terminológica, `openspec/config.yaml`, README; comandos reales `openspec list`, `new change`, `status` e `instructions proposal`.
- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`, completos; specs principales de modelo de dominio, configuración fiscal y autorización/navegación.
- Producto: visión, alcance V1, secciones pertinentes de reglas de negocio y glosario. Requisitos: matriz de roles; RF-INV-001…014 (RF-INV-011 aplazado por aprobar), RF-CAT-005, RF-REP-001/002 en su consulta básica; CU-007/008/009/015; UI-031 y UI-040…046; RNF-INT-001…010; matriz de trazabilidad. RN-FIS-002/005/006/010, RN-SEG-001…007, RN-CAT-007/010/011, RN-INV-001…016 y RN-CON-001/002/007/008/009.
- Propuesta y estado de tareas del cambio activo de catálogos; secciones pertinentes de sus specs de productos y proveedores. Se consulta como dependencia, no se continúa ni modifica ese cambio. Antes de diseño se leerán íntegramente los artefactos de las dependencias afectadas.
- Arquitectura técnica inicial, C4 de contenedores, ADR-0001/0003/0004 y DESIGN.md. Inspección de modelos de catálogo/proveedores/configuración, permisos, consultas paginadas, resolvedor fiscal y página de productos. Sin documentos históricos como requisitos.

### Verificación y entrega previstas

Las specs convertirán el alcance aprobado en escenarios de borrador sin stock, confirmaciones repetidas con distintas claves, rollback intermedio, salidas concurrentes, stock insuficiente, anulación insegura, inactivos, referencias duplicadas, costos históricos, impuestos y Kardex filtrado/paginado. El diseño deberá establecer contratos API, errores, filtros, índices, migraciones y estrategia de reconciliación; tasks ordenará **TDD**, backend, frontend y documentación.

La implementación requerirá pruebas unitarias e integración, concurrencia con PostgreSQL y conexiones independientes, comprobación de permisos y filtraciones, regresión de módulos anteriores y recorridos visuales accesibles. Se ejecutarán las verificaciones aplicables de `make check`, `make test`, `make audit`, migraciones, OpenAPI, E2E y OpenSpec; no se marcará éxito sin resultados reales. Se mantendrán modelo de datos, documentación, trazabilidad, glosarios y ADR sincronizados en las fases autorizadas.

### Aprobaciones obligatorias

Primero resolver las recomendaciones y aprobar esta propuesta. `openspec/config.yaml` exige «No incluir diseño técnico ni código y esperar aprobación explícita antes de crear specs». Después, AGENTS exige registrar el artefacto aprobado en `master` antes de que la fase siguiente dependa de él. Se necesita autorización explícita para la operación Git correspondiente, con selección limitada a estos archivos; los cambios ajenos no forman parte de ella. Specs, design y tasks tienen sus propias aprobaciones posteriores. La solicitud conserva expresamente estas puertas del repositorio.

### Evidencia de esta fase

- `openspec status --change gestionar-compras-entradas-inventario-kardex --json` reconoce proposal como presente: 1/4 artefactos. `done` no significa aprobación humana; aunque el esquema genérico habilite design, prevalece la secuencia proposal → specs → design → tasks del repositorio.
- `openspec validate gestionar-compras-entradas-inventario-kardex --strict --no-interactive --json` devuelve un único error: ausencia de deltas. La validación integral queda pendiente de las specs aprobadas; no se crean anticipadamente para satisfacer al validador.
- `git diff --check` no informó errores en los cambios seguidos existentes al comprobar. Los archivos nuevos se revisan separadamente antes de entregar. No se ejecutaron pruebas de software, build ni migraciones: esta fase no modifica implementación.
