# Especificación del modelo de dominio del taller

## Purpose

Establecer la línea base conceptual y las reglas observables que deberán respetar las futuras especificaciones funcionales del taller, sin anticipar el modelo de datos ni la implementación.

## Requirements

### Requirement: Fuente conceptual del dominio
La documentación SHALL definir `docs/arquitectura/modelo-dominio.md` como modelo conceptual aprobado del taller y SHALL evitar detalles de persistencia o implementación.

#### Scenario: Consulta del modelo aprobado
- **WHEN** una futura especificación necesite identificar entidades, relaciones, estados o invariantes
- **THEN** SHALL usar el modelo de dominio aprobado sin inferir tablas, modelos Django o claves foráneas

### Requirement: Separación de entidades fiscales
El dominio SHALL mantener separados el RUC comercial y el RUC artesanal en toda operación económica, documento, secuencia, impuesto, pago, saldo, anulación, cierre y reporte.

#### Scenario: Atención con servicios y repuestos
- **WHEN** un mantenimiento artesanal utiliza repuestos del inventario comercial
- **THEN** SHALL existir una operación artesanal para los servicios y una venta comercial independiente para los repuestos

#### Scenario: Pago de una atención combinada
- **WHEN** el cliente paga servicios y repuestos de una misma visita
- **THEN** el sistema SHALL registrar pagos separados para cada entidad fiscal

### Requirement: Datos compartidos entre los dos RUC
Clientes, vehículos y usuarios SHALL estar disponibles para ambas entidades fiscales sin duplicar su identidad por RUC.

#### Scenario: Historial compartido del cliente
- **WHEN** un cliente recibe un mantenimiento y compra repuestos
- **THEN** ambas operaciones SHALL referenciar al mismo cliente conservando su separación económica

### Requirement: Historial de propiedad del vehículo
El dominio SHALL representar un único propietario actual por vehículo y SHALL conservar los períodos de propiedad anteriores.

#### Scenario: Cambio de propietario
- **WHEN** un vehículo cambia de propietario
- **THEN** el período anterior SHALL cerrarse y los mantenimientos históricos SHALL continuar asociados al cliente que correspondía entonces

### Requirement: Catálogos separados de productos y servicios
Los productos y los servicios SHALL pertenecer a catálogos diferentes. Los productos SHALL admitir marca de producto, categoría y compatibilidad informativa con marcas de vehículo.

#### Scenario: Filtro de repuestos compatibles
- **WHEN** un usuario filtra productos por marca de producto y marca de vehículo
- **THEN** el sistema SHALL mostrar coincidencias sin impedir manualmente la venta de otros productos

### Requirement: Cantidad y presentación vendible
El dominio SHALL representar una cantidad mediante valor y unidad de medida, pero SHALL controlar el inventario de V1 por presentaciones completas vendibles.

#### Scenario: Envases de diferente contenido
- **WHEN** el taller comercializa un envase de un galón y otro de medio galón
- **THEN** cada presentación SHALL ser un producto distinto con código, existencia, costo y precio propios

#### Scenario: Caja logística con unidades vendibles
- **WHEN** ingresan doce filtros dentro de una caja que será abierta
- **THEN** el ingreso SHALL registrar doce filtros vendibles y no una caja indivisible

### Requirement: Kits comprados y desarme
Un kit comprado SHALL poder venderse intacto o desarmarse mediante una operación explícita que consuma el kit y produzca los componentes efectivamente obtenidos.

#### Scenario: Desarme de contenido variable
- **WHEN** el usuario abre un kit cuya composición depende del proveedor o versión
- **THEN** SHALL registrar manualmente los componentes reales y el sistema SHALL distribuir exactamente el costo total del kit entre ellos

#### Scenario: Piezas sueltas ofrecidas como conjunto
- **WHEN** el taller reúne piezas individuales para entregarlas juntas
- **THEN** V1 SHALL venderlas como líneas individuales y SHALL NOT crear automáticamente un kit de inventario

### Requirement: Ingreso de mercadería trazable
Un ingreso confirmado SHALL requerir un proveedor registrado, una o más líneas con cantidades y costos, y SHALL admitir referencias y evidencias externas opcionales.

#### Scenario: Compra ocasional a una persona
- **WHEN** una persona ocasional suministra un repuesto
- **THEN** SHALL poder registrarse como proveedor con nombre obligatorio y demás datos opcionales

#### Scenario: Confirmación del ingreso
- **WHEN** se confirma un ingreso válido
- **THEN** SHALL aumentar existencias, crear Kardex y recalcular el costo promedio en una sola operación atómica

### Requirement: Inventario sin existencias negativas
V1 SHALL operar con una sola bodega y SHALL impedir atómicamente toda operación que produzca existencia o disponibilidad negativa.

#### Scenario: Confirmaciones concurrentes
- **WHEN** dos usuarios intentan confirmar salidas sobre las mismas unidades
- **THEN** solo SHALL confirmarse la cantidad disponible y el otro intento SHALL fallar sin efectos parciales

### Requirement: Kardex inmutable e idempotente
Toda variación real de inventario SHALL generar un movimiento de Kardex inmutable, vinculado con su operación de origen, y un reintento SHALL NOT duplicar efectos.

#### Scenario: Corrección de movimiento confirmado
- **WHEN** un movimiento confirmado es incorrecto
- **THEN** SHALL conservarse el original y SHALL registrarse una operación compensatoria con motivo y responsable

### Requirement: Costo promedio ponderado
Las entradas válidas SHALL recalcular el costo promedio ponderado y las salidas SHALL conservar el costo vigente en el momento de su confirmación.

#### Scenario: Cambio posterior del costo
- **WHEN** una entrada futura cambia el costo promedio
- **THEN** los costos históricos de ventas anteriores SHALL permanecer sin alteración

### Requirement: Reserva exclusiva para mantenimientos
Solo una venta comercial abierta vinculada a un mantenimiento SHALL reservar existencias en V1. La reserva SHALL reducir disponibilidad pero no existencia ni Kardex.

#### Scenario: Adición y retiro de un repuesto
- **WHEN** el Encargado de Taller agrega una pieza a la venta vinculada
- **THEN** SHALL reservarse la cantidad disponible y, si retira la línea antes de confirmar, SHALL liberarse la reserva

#### Scenario: Venta directa o proforma
- **WHEN** se guarda una venta directa en borrador o se emite una proforma
- **THEN** SHALL NOT reservarse ni descontarse inventario

### Requirement: Proformas sin efectos definitivos
Una proforma SHALL ser una oferta con vigencia que no reserva stock, no crea deuda y solo SHALL convertirse una vez en una venta nueva tras revalidar disponibilidad, precios e impuestos.

#### Scenario: Proforma vencida
- **WHEN** el cliente desea retomar una proforma vencida
- **THEN** SHALL crearse una nueva proforma vinculada y SHALL NOT reactivarse la anterior

### Requirement: Confirmación de ventas
Confirmar una venta SHALL asignar su secuencia, congelar sus valores históricos, generar las salidas de Kardex y crear el importe exigible sin marcarla automáticamente como pagada o facturada.

#### Scenario: Cambio posterior de precio o impuesto
- **WHEN** cambia el precio del catálogo o la tarifa tributaria
- **THEN** una venta confirmada SHALL conservar precio final, base, tarifa, impuesto, total y costo histórico originales

### Requirement: Precios finales con impuesto incluido
Los precios editados y mostrados en los catálogos SHALL representar el valor final para el cliente, incluyendo el impuesto aplicable, y el sistema SHALL desglosar base e impuesto en la operación.

#### Scenario: Cambio de tarifa
- **WHEN** entra en vigencia una nueva tarifa de impuesto
- **THEN** el Administrador SHALL decidir el nuevo precio final del catálogo y los documentos anteriores SHALL permanecer intactos

### Requirement: Crédito y pagos simples
El crédito SHALL representar únicamente la existencia de saldo pendiente, sin fechas, cuotas, intereses ni planes. Cada pago SHALL aplicarse a una única operación confirmada y SHALL usar efectivo, transferencia o una combinación de ambos.

#### Scenario: Abono destinado a dos ventas
- **WHEN** un cliente entrega dinero para cubrir dos ventas
- **THEN** el usuario SHALL registrar un pago separado para cada venta y SHALL NOT distribuir automáticamente un único pago

#### Scenario: Ausencia de anticipos
- **WHEN** una operación económica todavía no está confirmada
- **THEN** el sistema SHALL NOT permitir registrar anticipos ni pagos asociados a ella

### Requirement: Saldos derivados
El saldo pendiente, la cuenta por cobrar y el estado `pendiente`, `parcial` o `pagado` SHALL derivarse del total exigible menos los pagos válidos.

#### Scenario: Abono parcial
- **WHEN** se confirma un pago menor que el saldo de la operación elegida
- **THEN** SHALL reducirse únicamente ese saldo y el estado SHALL derivarse como parcial

### Requirement: Devoluciones y reembolsos
Una devolución SHALL referenciar la venta original, limitarse a la cantidad todavía devolvible y conservar valores históricos. Si la corrección produce un exceso pagado, SHALL registrarse un reembolso trazable y no un crédito a favor.

#### Scenario: Producto apto para reventa
- **WHEN** el Administrador confirma que un producto devuelto está apto
- **THEN** SHALL reingresar al inventario con el costo histórico de salida

#### Scenario: Producto no apto
- **WHEN** el Administrador determina que el producto devuelto no está apto
- **THEN** la devolución económica SHALL conservarse pero SHALL NOT aumentar la existencia

### Requirement: Mantenimiento e intervenciones
Un mantenimiento SHALL representar el caso operativo completo y SHALL contener una intervención inicial y las intervenciones correctivas que correspondan.

#### Scenario: Retorno atribuible al taller
- **WHEN** el vehículo regresa por una falla causada por el trabajo anterior
- **THEN** el mismo mantenimiento SHALL reabrirse de forma explícita y auditada y SHALL agregar una intervención correctiva

#### Scenario: Falla nueva o no relacionada
- **WHEN** el vehículo regresa por una falla distinta o no atribuible al trabajo anterior
- **THEN** SHALL crearse un mantenimiento nuevo

### Requirement: Servicios con precio aplicado
El catálogo de servicios SHALL conservar un precio referencial y el Encargado de Taller SHALL poder establecer sin motivo obligatorio un precio aplicado diferente antes de confirmar la operación artesanal.

#### Scenario: Trabajo de complejidad diferente
- **WHEN** un servicio referencial de USD 300 se cobra en USD 350
- **THEN** la operación SHALL conservar USD 350 como precio aplicado sin modificar el catálogo ni documentos históricos

### Requirement: Finalización coherente del mantenimiento
Un mantenimiento SHALL NOT finalizar mientras su venta comercial vinculada conserve líneas pendientes. La venta SHALL confirmarse o quedar vacía antes de finalizar el mantenimiento.

#### Scenario: Repuestos utilizados pendientes
- **WHEN** el Encargado intenta finalizar un mantenimiento con repuestos reservados en una venta abierta
- **THEN** el sistema SHALL exigir que el Vendedor confirme la venta o retire las líneas no utilizadas

#### Scenario: Cancelación limitada
- **WHEN** el mantenimiento fue duplicado, registrado por error o no contiene trabajo cobrable
- **THEN** SHALL poder cancelarse conservando historial y liberando reservas; en otro caso SHALL finalizarse aunque el trabajo haya sido parcial

### Requirement: Corrección sin cargo
Una intervención correctiva atribuible al taller SHALL registrar el trabajo sin crear un nuevo cobro y los repuestos dañados por la instalación SHALL salir mediante una reposición por corrección confirmada por el Administrador.

#### Scenario: Pieza dañada por instalación incorrecta
- **WHEN** una pieza debe reemplazarse por responsabilidad del taller
- **THEN** SHALL disminuir el inventario de forma trazable y el cliente SHALL NOT adquirir una nueva deuda

### Requirement: Consumo interno del taller
Los productos entregados para uso interno SHALL salir del inventario mediante una operación de consumo interno sin crear venta al cliente.

#### Scenario: Entrega de un envase para uso del taller
- **WHEN** el Encargado solicita al Vendedor un tarro de grasa
- **THEN** SHALL descontarse la presentación completa como consumo interno sin distribuir su contenido entre mantenimientos

#### Scenario: Repuesto aportado por el cliente
- **WHEN** el cliente trae una pieza para instalar
- **THEN** el sistema SHALL NOT ingresarla al inventario ni crear una venta y MAY mencionarla únicamente en observaciones

### Requirement: Documentos internos y futura facturación
V1 SHALL emitir documentos internos separados por entidad fiscal y SHALL indicar que no son facturas electrónicas autorizadas. La futura referencia fiscal SHALL mantener un estado independiente.

#### Scenario: Confirmación y numeración
- **WHEN** se confirma una operación económica
- **THEN** SHALL asignarse una secuencia interna de su entidad fiscal que no pueda reutilizarse ni trasladarse al otro RUC

#### Scenario: Integración fiscal futura
- **WHEN** se implemente facturación electrónica en un cambio posterior
- **THEN** la autorización del SRI SHALL asociarse a la operación existente sin controlar por sí sola inventario, pagos o mantenimiento

### Requirement: Auditoría y cierres separados
Las acciones críticas SHALL conservar usuario, operación afectada y motivo cuando corresponda. El sistema SHALL producir un cierre diario independiente por entidad fiscal y medio de pago.

#### Scenario: Una persona cobra para ambos RUC
- **WHEN** un usuario recibe efectivo comercial y artesanal durante el mismo día
- **THEN** los cierres SHALL mostrar importes separados aunque el dinero haya sido manejado físicamente por la misma persona

#### Scenario: Diferencia de caja
- **WHEN** el efectivo contado difiere del esperado
- **THEN** SHALL registrarse la diferencia y su explicación sin editar las ventas o pagos originales

### Requirement: Reportes sin contabilidad completa
Los reportes SHALL separar entidades fiscales y SHALL poder mostrar inventario, Kardex, ventas, servicios, pagos, saldos, consumos, correcciones y margen bruto histórico. El margen SHALL NOT presentarse como ganancia neta.

#### Scenario: Reporte histórico de margen
- **WHEN** se consulta una venta de un período anterior
- **THEN** el margen bruto SHALL usar el precio y costo históricos sin aplicar valores actuales del catálogo

### Requirement: Coherencia de la documentación vigente
Los documentos no históricos aplicables SHALL alinearse con las decisiones confirmadas y con este cambio, manteniendo trazabilidad y señalando cualquier cuestión todavía pendiente.

#### Scenario: Regla antigua contradictoria
- **WHEN** un documento inferior permita descuentos en V1 o trate una decisión confirmada como pendiente
- **THEN** SHALL actualizarse conforme a la fuente de mayor precedencia sin usar el código legado como requisito

#### Scenario: Límite del cambio
- **WHEN** se aplique este cambio
- **THEN** SHALL modificarse únicamente documentación y SHALL NOT crearse `modelo-datos.md`, código, tablas, migraciones, endpoints, componentes o pruebas de software
