## ADDED Requirements

### Requirement: Pantalla común sin unir operaciones

Una pantalla que cobra y factura repuestos y servicios a la vez («Cobrar y facturar») SHALL resolver por separado la venta comercial y la operación artesanal. Cada una SHALL conservar su **entidad fiscal**, su número interno, su confirmación, sus pagos y su factura. La pantalla SHALL mostrar el importe de cada negocio con su nombre antes de habilitar la acción; el total conjunto SHALL ser solo informativo. Esa pantalla SHALL valer como la revisión y la confirmación expresa de lo que contiene, con los efectos y los valores del servidor a la vista. Quien no tenga permiso sobre una parte SHALL ver y resolver solo la suya.

La regla rige al archivar U6 (`DP-036`, regla 8). Hasta entonces, cobrar y facturar siguen sus pantallas actuales.

Trazabilidad: `DP-036`, regla 2; `DP-013`, `DP-021`, `DP-027`, `DP-029`, `DP-034`, reglas 5 y 8; `RN-FIS-006/008/009`; `RNF-USA-003`; invariantes 1, 2 y 17; `interfaz-y-navegacion.md` §6.6 y §8.1.

#### Scenario: Mantenimiento con servicios y repuestos
- **DADO** un mantenimiento con servicios por 20.00 y repuestos por 23.00, pagados al contado en efectivo
- **CUANDO** la usuaria cobra y factura desde una sola pantalla
- **ENTONCES** SHALL registrarse una operación artesanal y una venta comercial, cada una con un pago aplicado solo a ella y una factura de su propio RUC, y ningún documento, pago, saldo ni factura SHALL contener importes del otro negocio.

#### Scenario: Pago parcial
- **DADO** un cliente que entrega menos que el total de los dos negocios
- **CUANDO** se registra el cobro
- **ENTONCES** el importe de cada negocio SHALL indicarse por separado y el sistema SHALL NOT dividir automáticamente un solo importe entre las dos operaciones.

#### Scenario: Una parte no se completa
- **DADO** que la venta de repuestos no puede confirmarse por falta de stock, por falta de permiso o por un fallo, mientras la parte de servicios sí puede
- **CUANDO** se ejecuta la acción
- **ENTONCES** lo completado SHALL quedar en firme, lo no completado SHALL quedar pendiente y visible con su motivo, y ninguna de las dos partes SHALL presentarse como terminada si no lo está.

#### Scenario: Falla la emisión
- **DADO** dos cobros registrados y una emisión que falla o no está habilitada
- **CUANDO** termina la acción
- **ENTONCES** los cobros y las confirmaciones SHALL conservarse, y cada factura SHALL mostrarse como pendiente, nunca como autorizada.

#### Scenario: Finalizar no confirma
- **DADO** un mantenimiento con repuestos en su venta abierta
- **CUANDO** se intenta finalizar sin pasar por la confirmación expresa
- **ENTONCES** la finalización SHALL seguir bloqueada y SHALL NOT confirmar la venta.

### Requirement: Correo del comprador guardado en el cliente

Al completar los datos de una factura, una casilla **activada por omisión** SHALL guardar el correo del comprador en la ficha del cliente. Desactivada, el correo SHALL quedar solo en esa factura. Si el cliente ya tiene otro correo, la pantalla SHALL mostrar el anterior y el nuevo antes de reemplazarlo. Si el usuario no puede editar clientes, el correo SHALL quedar solo en la factura. Guardarlo SHALL registrarse en la auditoría del cliente y SHALL NOT modificar facturas ya preparadas. Registrar un cliente SHALL seguir sin exigir correo.

Esta excepción ajusta `DP-035`, regla 1, y rige al archivar U6. Hasta entonces, el correo completado al facturar no cambia la ficha del cliente.

Trazabilidad: `DP-036`, regla 4; `DP-035`, regla 1; `DP-008`; `RN-CLI-003`; modelo de dominio §11.6; spec `preparacion-y-seguimiento-fiscal`; spec `gestion-de-clientes`, auditoría.

#### Scenario: Cliente sin correo
- **DADO** un cliente sin correo y la casilla activada
- **CUANDO** se factura con un correo escrito
- **ENTONCES** la ficha del cliente SHALL guardar ese correo, con su registro de auditoría.

#### Scenario: Correo distinto del guardado
- **DADO** un cliente con un correo guardado y un correo distinto escrito al facturar
- **CUANDO** la casilla sigue activada
- **ENTONCES** SHALL mostrarse el correo anterior y el nuevo antes de reemplazarlo.

#### Scenario: Casilla desactivada o sin permiso
- **DADO** la casilla desactivada, o un usuario sin permiso para editar clientes
- **CUANDO** se factura
- **ENTONCES** el correo SHALL conservarse solo en la factura y la ficha del cliente SHALL seguir igual.

### Requirement: Sincronización de la decisión de uso diario

`DP-036` SHALL registrarse en las decisiones confirmadas. `DP-035`, regla 1, SHALL quedar marcada como ajustada, conservando su texto. Los documentos no históricos SHALL alinearse con `DP-036`: los requisitos que se ajustan SHALL indicar el cambio que los implementa, las reglas que se mantienen SHALL conservarse y los asuntos aplazados SHALL figurar con su cambio responsable. Este cambio SHALL modificar únicamente documentación.

Trazabilidad: propuesta §A, §C y §D; `docs/cambios-pendientes.md`, regla para cada cambio; `AGENTS.md`, precedencia.

#### Scenario: Decisión anterior ajustada
- **DADO** el archivo de decisiones confirmadas
- **CUANDO** se consulta `DP-035`
- **ENTONCES** SHALL indicar que `DP-036`, regla 4, ajusta su regla 1 y desde qué cambio rige.

#### Scenario: Requisito ajustado todavía sin implementar
- **DADO** `RNF-USA-009`, `RNF-USA-010` y los nuevos `RNF-USA-013` a `RNF-USA-016`
- **CUANDO** se actualizan los requisitos y la trazabilidad
- **ENTONCES** SHALL constar como aprobados y pendientes de U4, U2 o U6 según corresponda, y SHALL NOT constar como cumplidos.

#### Scenario: Regla que se mantiene
- **DADO** `DP-006`, `DP-008`, `DP-013`, `DP-021`, `DP-027`, `RN-FIS-009`, la tabla de permisos o la separación de funciones
- **CUANDO** se aplica este cambio
- **ENTONCES** SHALL conservarse sin cambio de sentido.

#### Scenario: Documentación desactualizada
- **DADO** un documento no histórico que declara sin implementar lo ya implementado, cita un cambio archivado como activo, conserva un estado sustituido o un enlace roto, o trata como abierta una decisión ya cerrada
- **CUANDO** se aplica este cambio
- **ENTONCES** SHALL corregirse conforme a la fuente de mayor precedencia, incluidos los casos listados en la propuesta §D.

#### Scenario: Términos visibles y términos del dominio
- **DADO** el glosario del producto
- **CUANDO** se aplica este cambio
- **ENTONCES** SHALL distinguir los términos de la documentación de los términos visibles en pantalla, sin eliminar «entidad fiscal», «RUC comercial» ni «RUC artesanal» del dominio.

#### Scenario: Plan actualizado
- **DADO** los choques nuevos, la captura asignada a U6 y la medición real asignada a U2
- **CUANDO** se aplica este cambio
- **ENTONCES** `docs/cambios-pendientes.md` SHALL registrarlos en U1, U2 y U6.

#### Scenario: Límite del cambio
- **DADO** este cambio en aplicación
- **CUANDO** se revisan sus archivos modificados
- **ENTONCES** SHALL NOT incluir código, modelos, migraciones, endpoints, pantallas, pruebas de software ni `modelo-datos.md`.
