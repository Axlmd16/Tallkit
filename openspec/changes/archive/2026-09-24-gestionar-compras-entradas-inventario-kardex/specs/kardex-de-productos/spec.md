## ADDED Requirements

<!-- Specs para revisión basadas en proposal aprobado en master c17ad64. Las consultas conservan saldos físicos completos aunque se oculten tipos o documentos protegidos. -->

### Requirement: Historia cronológica e inmutable por producto

El **Kardex** SHALL listar los movimientos confirmados de un producto en la única bodega comercial, identificando momento efectivo, tipo, origen, referencia de operación, entrada, salida, saldo resultante y usuario responsable. SHALL distinguir compra, carga inicial, ajuste de entrada, ajuste de salida y compensaciones. El orden SHALL ser cronológico de contabilización, con desempate estable acorde con el orden en que se afectó el saldo del producto. La fecha del proveedor SHALL ser informativa, no una forma de reordenar movimientos. Originales y **movimientos inversos** SHALL permanecer visibles y vinculados. Trazabilidad: RN-INV-001/002/011/012; RF-INV-008/010; CU-008; UI-044; proposal.

#### Scenario: Horas coincidentes
- **GIVEN** una entrada de 5 y una salida de 2 contabilizadas en ese orden con la misma hora visible
- **WHEN** se consulta repetidamente el Kardex
- **THEN** SHALL conservarse primero la entrada con saldo 5 y después la salida con saldo 3, sin invertir su orden

#### Scenario: Documento antiguo recibido hoy
- **GIVEN** movimientos ya confirmados y una compra con fecha documental anterior
- **WHEN** se confirma hoy y se consulta el Kardex
- **THEN** SHALL aparecer después de los efectos ya contabilizados sin cambiar sus saldos ni costos

#### Scenario: Operación anulada
- **GIVEN** una compra de 5 unidades posteriormente anulada
- **WHEN** se consulta su historia
- **THEN** SHALL mostrarse la entrada original y su salida compensatoria relacionadas, sin borrar ni excluir la entrada del cálculo

### Requirement: Filtros y paginación de movimientos

La consulta SHALL permitir elegir producto y filtrar intervalo de fechas efectivas, tipo, origen, documento y usuario, con paginación, total y orden estable. Fechas SHALL interpretarse como días de America/Guayaquil, incluyendo íntegramente los días inicial y final; desde sin hasta o hasta sin desde SHALL funcionar como límite unilateral. Filtros SHALL combinarse por intersección. Un rango invertido, filtro desconocido o paginación inválida SHALL producir error corregible sin sustituirse silenciosamente por otra consulta. SHALL mantenerse acceso a productos inactivos y no requerirse otra bodega seleccionable. Trazabilidad: RF-INV-008; RN-CON-008; RNF-INT-008; CU-008; UI-044.

#### Scenario: Período inclusivo del negocio
- **GIVEN** movimientos antes, durante y después de un día en America/Guayaquil
- **WHEN** se selecciona ese día como inicio y fin
- **THEN** SHALL incluirse todo movimiento de ese día local y excluirse los de días vecinos, independientemente de la fecha UTC

#### Scenario: Filtros combinados
- **GIVEN** movimientos de varios tipos y usuarios para un producto
- **WHEN** se filtra período, ajustes de salida y un usuario
- **THEN** SHALL devolverse solo la intersección, con cantidad total de coincidencias y paginación consistente

#### Scenario: Parámetros inválidos
- **GIVEN** un rango de fin anterior al inicio o una página no válida
- **WHEN** se solicita la consulta
- **THEN** SHALL mostrarse error del criterio sin inventar fechas ni resultados

### Requirement: Saldos anteriores y del período completo

El Kardex SHALL calcular el saldo anterior a la fecha inicial con todos los movimientos previos del producto y el saldo final con todos los movimientos hasta el cierre del período. SHALL mostrar entradas y salidas del período completo separadas de los totales de coincidencias filtradas. Cada fila SHALL conservar su saldo histórico real calculado con todos los efectos anteriores, incluidos los ocultos por filtros. Si no se fija inicio, el saldo anterior SHALL ser cero antes del primer movimiento; si no se fija fin, el corte SHALL ser el de la consulta. SHALL NOT reiniciarse saldos al cambiar filtros o páginas ni confundirse una suma parcial con la existencia. Trazabilidad: RN-INV-001/002; RF-INV-007/008; RNF-INT-007; proposal.

#### Scenario: Período con saldo previo
- **GIVEN** saldo previo de 10, entrada de 5 y salida de 3 dentro del período
- **WHEN** se consulta ese período
- **THEN** SHALL mostrarse saldo anterior 10, entradas 5, salidas 3, saldos de filas 15 y 12 y saldo final 12

#### Scenario: Filtro de tipo oculta una entrada
- **GIVEN** saldo previo 10, entrada de 5 y salida posterior de 3
- **WHEN** se filtran solo las salidas
- **THEN** SHALL mostrarse la salida con saldo real 12, saldo anterior 10 y saldo final 12; SHALL distinguirse la salida seleccionada de los movimientos totales del período sin presentar 7 como existencia

#### Scenario: Período sin movimientos
- **GIVEN** saldo anterior de 8 y ningún movimiento durante el período
- **WHEN** se consulta
- **THEN** SHALL mostrarse lista vacía con entradas y salidas cero y saldos anterior y final de 8

#### Scenario: Filtro sin coincidencias pero período con efectos
- **GIVEN** saldo previo 8 y una entrada de 2, sin ajustes de salida
- **WHEN** se filtran ajustes de salida en ese período
- **THEN** SHALL mostrarse lista vacía de coincidencias, saldo anterior 8 y final 10, sin afirmar que el período completo carece de movimientos

### Requirement: Continuidad de saldos entre páginas

La paginación SHALL conservar saldos anteriores reales a cada movimiento y SHALL permitir identificar el saldo inmediatamente anterior al primer movimiento de cada página. Los resúmenes del período SHALL corresponder al conjunto consultado, no solo a la página. Con datos sin cambios, recorrer todas las páginas SHALL devolver cada coincidencia exactamente una vez. Ante nuevos movimientos, una respuesta SHALL mantener coherencia entre filas, resúmenes y corte de consulta; una actualización SHALL indicarse o requerir refrescar para no mezclar silenciosamente cortes incompatibles. Trazabilidad: RF-INV-007/008; RNF-INT-007; RNF-REN/USA; proposal.

#### Scenario: Segunda página con saldo acumulado
- **GIVEN** saldo previo 10 y movimientos +5, -3 y +2, con dos filas por página
- **WHEN** se consulta la segunda página
- **THEN** SHALL mostrarse el tercer movimiento con saldo 14 y saldo anterior a esa página 12, manteniendo saldo inicial del período 10 y final 14

#### Scenario: Página filtrada con movimientos intermedios ocultos
- **GIVEN** movimientos +5, -2 y +4 desde cero, filtrando entradas con una coincidencia por página
- **WHEN** se consulta la segunda página
- **THEN** SHALL mostrarse entrada 4 con saldo 7 y saldo inmediatamente anterior 3, sin usar 5 como saldo previo de esa fila

#### Scenario: Movimiento concurrente con consulta
- **GIVEN** una consulta paginada y una nueva entrada confirmada mientras se obtiene la respuesta
- **WHEN** se presentan filas y resumen
- **THEN** SHALL corresponder al mismo corte consistente, sin combinar filas anteriores con totales posteriores inadvertidamente

### Requirement: Costos de Kardex según autorización

Los tres roles SHALL consultar cantidades mediante `inventario.ver`. Solo Administrador con `inventario.ver_valorizacion` SHALL recibir costo unitario aplicado, valor de entrada/salida, promedio y saldo valorizado, incluida la precisión y residuos necesarios para explicar la conciliación. Resúmenes, datos de origen y errores SHALL aplicar la misma restricción. La consulta histórica SHALL usar cantidades, unidades, costos y valores conservados en el movimiento, no recalcularlos con el catálogo actual. Trazabilidad: RF-CAT-005; RF-INV-008; RN-INV-007; RN-CON-002; actores-y-roles §3.3; proposal.

#### Scenario: Kardex administrativo valorizado
- **GIVEN** un Administrador autorizado y movimientos con costos históricos
- **WHEN** consulta el Kardex
- **THEN** SHALL recibir los valores aplicados y saldos valorizados conciliables, incluidos residuos de agotamiento

#### Scenario: Kardex operativo sin filtración
- **GIVEN** un Vendedor o Encargado sin Administrador
- **WHEN** consulta Kardex, resúmenes o detalle de un movimiento
- **THEN** SHALL recibir cantidades y saldos autorizados sin campos económicos, datos privados del proveedor ni importes ocultos en referencias o errores

#### Scenario: Cambio posterior del catálogo
- **GIVEN** un movimiento registrado antes de cambiar nombre, unidad o precio del producto
- **WHEN** se consulta la fila histórica
- **THEN** SHALL conservar su identificación y unidad aplicadas y no recalcular costos con el catálogo vigente

### Requirement: Acceso al origen y correcciones enlazadas

Cada movimiento SHALL identificar una referencia interna trazable de su operación y, cuando esté autorizado, permitir abrir el documento de origen. Abrir compras SHALL exigir `ingresos.ver`; consultar sus cantidades en Kardex SHALL NOT concederlo. Las compensaciones SHALL enlazar el movimiento original y viceversa. La referencia externa del proveedor y su identidad privada SHALL permanecer restringidas a permisos de compra. Trazabilidad: RN-INV-002/012; RF-INV-008/010; RN-SEG-007; CU-008/015; proposal.

#### Scenario: Administrador abre la compra
- **GIVEN** un movimiento de compra y un Administrador con permisos
- **WHEN** abre su origen
- **THEN** SHALL mostrarse el documento real con su estado, número y movimientos relacionados

#### Scenario: Operativo intenta abrir compra
- **GIVEN** un usuario con `inventario.ver` sin `ingresos.ver`
- **WHEN** intenta acceder directamente al documento de una entrada
- **THEN** SHALL denegarse sin revelar compra, proveedor o costos; la interfaz SHALL conservar únicamente la referencia interna autorizada

#### Scenario: Navegación entre compensación y original
- **GIVEN** un movimiento corregido y su compensación
- **WHEN** se consulta cualquiera de ellos
- **THEN** SHALL identificarse el vínculo y sentido de la corrección sin ocultar la operación original

### Requirement: Experiencia de consulta y verificación de integridad

El Kardex SHALL ofrecer navegación accesible, contexto de producto, filtros conservados al volver de un origen autorizado y estados reales de carga, vacío, error y éxito. SHALL informar claramente alcance temporal, filtros activos y diferencia entre saldos y coincidencias. El saldo actual mostrado en inventario y el cierre de Kardex al mismo corte SHALL coincidir en cantidad y, para usuarios autorizados, valor. Una inconsistencia SHALL ser detectable por reconciliación y SHALL NOT resolverse modificando movimientos históricos o fingiendo un saldo correcto. Trazabilidad: RF-INV-007/008/010; RNF-INT-007; UI-043/044; RNF-USA; proposal.

#### Scenario: Conciliación con inventario
- **GIVEN** un producto con compras, ajustes y compensaciones confirmados
- **WHEN** se compara inventario con Kardex completo al mismo corte
- **THEN** SHALL coincidir cantidad y valor autorizado, incluyendo movimientos anulados y sus compensaciones

#### Scenario: Regreso desde un documento
- **GIVEN** una consulta filtrada en una página determinada
- **WHEN** se vuelve desde el origen autorizado de un movimiento
- **THEN** SHALL conservarse producto, filtros y página o informarse que los datos cambiaron y requieren actualización

#### Scenario: Error de consulta accesible
- **GIVEN** un usuario que navega por teclado y una consulta fallida
- **WHEN** se presenta el estado
- **THEN** SHALL comunicarse el error y ofrecer reintento sin presentar historial vacío o saldo cero como información confirmada

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
