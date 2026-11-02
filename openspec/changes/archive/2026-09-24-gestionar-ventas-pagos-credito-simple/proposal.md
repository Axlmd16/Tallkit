## Why

El sistema ya gestiona clientes, catálogo, compras e inventario, pero todavía no permite completar una **venta de repuestos**, cobrarla ni consultar su deuda. Este cambio incorporará el ciclo comercial con correcciones trazables, preservando la separación fiscal y la coherencia entre dinero, numeración e inventario.

Estado: propuesta aprobada para crear specs. Fecha: 2026-09-20. Después de confirmar que esta propuesta estaba registrada en `master` en el commit `b527d68`, se solicitó aprobación expresa de la propuesta y de sus cuatro recomendaciones; el usuario respondió «si esta bien, continua». La aprobación comprende las recomendaciones de importes, precio aplicado, contado/cobro y correcciones que se conservan abajo como contexto de la revisión original. No aprueba anticipadamente specs, diseño, tareas ni implementación, ni autoriza operaciones Git. Se mantiene la autorización para redactar en `develop` y el alcance elegido: ciclo comercial con correcciones; proformas, reservas de mantenimiento y cobros artesanales quedan para otros cambios.

## What Changes

- Crear, editar, listar y consultar ventas directas del **RUC comercial**, con cliente registrado, productos activos, cantidades de presentaciones completas, precios finales, impuestos y condición contado/crédito. Un borrador no reserva, descuenta inventario, genera deuda definitiva ni consume número.
- Confirmar después de revisar permisos, datos y disponibilidad: asignar la serie comercial de ventas (inicialmente COM-VEN), conservar datos y valores históricos, generar salidas de **Kardex** y crear el importe exigible como una sola acción atómica. Conservar precio final, base, tarifa, impuesto, total y costo histórico de salida. Reintentos y concurrencia no duplican números, movimientos ni deudas.
- Registrar cada **pago** o **abono** contra una sola venta confirmada elegida por el usuario, mediante EFECTIVO, TRANSFERENCIA o ambos. Rechazar anticipos, sobrepagos y reparto automático entre operaciones. Conservar fecha, importe, partes por medio, usuario y entidad; permitir al Administrador corregir o anular pagos con motivo e historia, sin borrarlos.
- Tratar **crédito** como condición que permite deuda, sin vencimientos, cuotas, intereses, límites ni cronogramas. Derivar **saldo pendiente**, **cuenta por cobrar** y **estado de pago** a partir del importe exigible vigente y los pagos netos de correcciones, sin edición manual. Confirmar no equivale a cobrar ni facturar.
- Permitir al Administrador una **anulación** de venta con motivo y resolución trazable de sus pagos y efectos de inventario; conservar el original y su número. Registrar **devolución** total o parcial contra líneas originales, limitada a lo todavía devolvible. Solo lo declarado apto para reventa reingresa, al costo histórico de salida. Reducir primero el importe exigible y resolver el exceso pagado mediante **reembolso**, nunca saldo a favor ni deuda nueva.
- Incorporar listas, editor, detalle, historial de cobros/correcciones, cuentas por cobrar comerciales filtrables por cliente, estado y antigüedad, y comprobante imprimible como **documento interno**, expresamente no autorizado por el SRI. Mantener separados los estados de venta, pago y documento, y no exponer costos al Vendedor. La antigüedad informa tiempo transcurrido, no mora ni vencimiento.

### Decisiones confirmadas y usuarios afectados

Se preservan DP-001/002/003/004/006/008 (Cliente)/009/013/014/017/018 y CT-001: bodega única, existencia no negativa, ausencia de descuentos, numeración histórica, cliente identificado, presentaciones completas, medios reales, pagos por operación y separación fiscal. DP-012/021 siguen vigentes para la futura integración con taller; este cambio no habilita reservas.

Administrador y Vendedor crean, consultan, confirman y cobran ventas comerciales según sus permisos existentes. Solo el Administrador anula ventas o pagos y autoriza devoluciones/reembolsos. El Encargado del taller sin otro rol no obtiene acceso a ventas directas, cobros comerciales ni costos. Los roles se acumulan y el backend valida cada acción. El cliente recibe el comprobante, sin acceso autenticado propio.

### Recomendaciones aprobadas para este cambio

Estas concreciones fueron aprobadas por el usuario para las specs de este cambio; no certifican tarifas ni obligaciones tributarias reales. Se conserva su redacción original y sus alternativas para explicar la decisión adoptada:

1. **Importes y fecha operativa:** proponer USD, precios finales con hasta dos decimales y cantidades enteras positivas de presentaciones completas. Usar la selección tributaria comercial del producto y la fecha efectiva de confirmación en America/Guayaquil; no retrofechar ventas. Para una tarifa porcentual inclusiva, conservar el total de línea, calcular base a centavos con HALF_UP y obtener impuesto por diferencia; sumar las líneas para los totales. En devoluciones parciales, distribuir los importes históricos proporcionalmente y asignar el residuo a la última devolución de la línea, sin exceder sus importes originales. Alternativa: cálculo global u otra política expresamente validada. DP-023 solo aprueba redondeo de compras; no autoriza esta política de ventas. Las tarifas reales siguen siendo configuración validada por el responsable del negocio.
2. **Precio aplicado:** proponer tomar el precio final vigente del catálogo, sin edición libre en la venta para ningún rol; un cambio de precio corresponde al catálogo y a su permiso administrativo. Si cambia antes de confirmar, presentar los valores actualizados para nueva revisión. Alternativa: permitir un precio negociado con reglas y permisos adicionales, sin habilitar descuentos. La documentación define precio histórico y prohíbe descuentos, pero no concreta completamente esta facultad en ventas.
3. **Contado y cobro:** conservar confirmación y pago como acciones independientes, tal como CU-012/013. Proponer que contado solicite después un cobro completo; si se interrumpe, mostrar la venta confirmada pendiente y permitir reanudar el cobro, sin convertirla automáticamente a crédito ni marcarla pagada. Crédito permite pagos parciales. Proponer fecha de cobro del día asignada por el sistema; captura retroactiva requeriría una política adicional. Alternativa: un flujo coordinado de confirmar y cobrar, manteniendo los estados independientes y sin aceptar anticipos.
4. **Correcciones:** proponer anulación total por error solo sin devoluciones previas y con restitución segura del inventario; si hay movimientos posteriores que impiden la reversión exacta, orientar a devolución trazable sin reescribir la valoración histórica. Las devoluciones físicas posteriores deben seguir admitiéndose, usando el costo histórico y la inspección de aptitud. Proponer registro explícito del reembolso por el Administrador, con medio real y obligación pendiente visible hasta completarlo; no fingir desembolso al confirmar la devolución. Una anulación no se completa con pagos sin resolver. Alternativa: coordinar corrección y reembolso en una sola acción, previa confirmación del desembolso.

### Fuera de alcance

Proformas y su conversión; mantenimientos, ventas vinculadas, reservas y cobros artesanales; cierres de caja y reportes avanzados; facturación electrónica y SRI; cuentas por pagar, conciliación bancaria y contabilidad; consumos, desarmes y reposiciones; descuentos, anticipos, sobrepagos, saldos a favor, planes de crédito, multibodega y migración desde Flutter. Los requisitos de esos flujos siguen vigentes para V1, sin declararlos cubiertos por esta entrega.

## Capabilities

### New Capabilities

- `ventas-comerciales`: ventas directas en borrador, confirmación, importes históricos, numeración, salidas, permisos, consultas y comprobante interno.
- `pagos-comerciales-y-credito-simple`: pagos y abonos comerciales, medios combinados, correcciones de pagos, saldos derivados y cuentas por cobrar.
- `correcciones-de-ventas-y-reembolsos`: anulación de ventas, devoluciones totales/parciales, inspección, reingreso histórico y liquidación trazable de excesos pagados.

### Modified Capabilities

Ninguna spec principal requiere sustituir sus reglas en esta propuesta. Las capacidades concretan `modelo-dominio-taller` y consumen `configuracion-operativa-y-fiscal`, autorización y sistema visual. Antes de specs se revisará el estado de sincronización de compras/inventario: sus deltas activos no deben duplicarse ni sobrescribirse; una ampliación de su contrato observable debe quedar expresamente reflejada en las specs correspondientes.

## Impact

### Reutilización, cambios y dependencias

- Reutilizar identidad, sesión/CSRF, permisos, auditoría, clientes, catálogo, configuración/numeración, núcleo de inventario y componentes visuales existentes. No sustituirlos ni incorporar bibliotecas sin necesidad actual. Modificar únicamente sus interfaces o superficies de integración necesarias y la navegación comercial; no reconstruir el sistema anterior.
- Añadir persistencia histórica de operaciones comerciales y cobros, API bajo `/api/v1/`, contratos OpenAPI y pantallas UI-053…058/UI-060…063 en su ámbito comercial. Modelos, tablas, migraciones y contratos concretos se decidirán después de aprobar specs y diseño. Conservar datos operativos existentes, sin inventar saldos iniciales ni asumir una base vacía.
- Depender de clientes, catálogo y compras/inventario disponibles y verificados, además de configuración e identidad. Su presencia en código no acredita cierre ni integración en `master`. Revisar esas dependencias antes de aplicar. Mantener ADR-0001/0003/0004/0005 y las fronteras del monolito modular; DM-001 permanece abierto para el diseño, sin decidir aquí una estructura común de documentos.
- Riesgos: dobles cobros o salidas, sobrepago concurrente, redondeos acumulados, devolución duplicada, exceso pagado oculto, filtración de costos y regresiones de valoración. Las specs deberán cubrir permisos positivos/negativos, estados, reintentos, concurrencia, rollback y conservación histórica; la implementación seguirá TDD y las verificaciones aplicables de `make check`, `make test`, `make audit`, OpenAPI y trazabilidad.

### Contradicciones e información insuficiente

- El contexto general de decisiones y el párrafo final de arquitectura aún describen ausencia de dominio, pero la arquitectura detallada y `backend/src/config/api/urls.py` muestran clientes, catálogo, compras e inventario implementados. Se reutiliza ese estado real sin alterar reglas de negocio.
- `inventory.application.posting.reverse_operation` y ADR-0005 restringen la reversión exacta al último movimiento. No equivalen a una devolución comercial después de movimientos posteriores. El diseño deberá cubrir ese reingreso sin trasladar a devoluciones una restricción propia de reversión; el glosario también usa una definición restringida de movimiento compensatorio que habrá que mantener precisa.
- No existe spec principal de ventas/pagos; la línea conceptual no resolvía redondeo comercial, libertad de precio ni todos los detalles operativos de contado y reembolsos. Las recomendaciones anteriores, ahora aprobadas, concretan esos puntos para este cambio. No se crean series nuevas para pagos o correcciones sin decisión expresa.

### Fuentes consultadas y trazabilidad

- Fuentes prioritarias, leídas completas: `docs/negocio/decisiones/decisiones-confirmadas.yaml`, `docs/arquitectura/modelo-dominio.md`; specs principales `modelo-dominio-taller` y `configuracion-operativa-y-fiscal`.
- Producto: `docs/negocio/producto/vision.md`, `alcance-v1.md`, secciones aplicables de `reglas-negocio.md` y `glosario.md`. Reglas RN-FIS-001…010, RN-SEG-001…007, RN-CAT-002/007/011/016, RN-INV-001/002/007…016, RN-VEN-001…021 y RN-CON-001…005/007…010.
- Requisitos: `docs/negocio/requisitos/actores-y-roles.md`, secciones de ventas/pagos de `requisitos-funcionales.md`, CU-012…015 de `casos-de-uso.md`, UI-053…058/UI-060…063 de `interfaz-y-navegacion.md`, RNF-INT-001…010 de `requisitos-no-funcionales.md` y `matriz-trazabilidad.md`. Cobertura propuesta: RF-VEN-001/003…015/017…018; RF-PAG-001…009/011…012 y RF-REP-006 solo comerciales; RF-AUD-001…004/006. RF-VEN-002/016 y RF-PAG-010 quedan para proformas/taller, sin prometer cobertura completa de sus grupos.
- Técnica y estado: `docs/tecnico/arquitectura-inicial.md`, C4 de contenedores, ADR-0001/0003/0004/0005, rutas API y servicios de inventario. Se consultó la propuesta del cambio de compras/inventario como dependencia, sin continuarlo. La búsqueda documental no encontró identificadores EA/BR aplicables; no se inventan ni se adopta documentación histórica como requisito.
- Flujo: `AGENTS.md`, su referencia terminológica, `openspec/config.yaml`, estado e instrucciones del cambio. No había artefactos previos en este cambio.

### Aprobaciones y siguiente paso

La propuesta y sus recomendaciones ya fueron aprobadas sobre el contenido registrado en `master`; esta actualización deja constancia de la aprobación recibida. Las specs se redactan en `develop` y requieren su propia aprobación y registro en `master` antes de crear diseño. La autorización para redactar no autoriza commits, ramas ni merges. La secuencia del repositorio sigue proposal → specs → design → tasks, aunque el esquema genérico habilite simultáneamente specs y design.
