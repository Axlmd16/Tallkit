## MODIFIED Requirements

### Requirement: Listas de trabajo «En el taller» y «Falta cobrar»

La página de inicio SHALL mostrar tres listas de trabajo, cada una limitada a lo que los permisos efectivos del usuario permiten consultar:

- **En el taller:** los mantenimientos abiertos (estados `registrado` y `reabierto`), cada fila con su número, cliente, placa y estado, y un acceso a su ficha.
- **Falta cobrar:** las operaciones confirmadas con saldo pendiente mayor que cero, cada fila con su negocio por nombre, número, cliente, saldo y un acceso a la operación.
- **Falta facturar:** las operaciones confirmadas vigentes (ventas comerciales y operaciones artesanales) que todavía no tienen una preparación fiscal local completada, cada fila con su negocio por nombre, número, cliente, total y un acceso directo para completar su factura local.

Cada lista SHALL cargar y fallar por separado de los demás bloques, mostrar un máximo de filas con un acceso a la lista completa ya filtrada, y SHALL NOT mezclar entidades fiscales en una fila ni presentar un total conjunto. El conteo de «En el taller» SHALL coincidir con el de mantenimientos abiertos de los pendientes. «Falta cobrar» SHALL NOT presentarse como mora, vencimiento o intereses. «Falta facturar» SHALL identificar únicamente preparaciones locales pendientes y SHALL NOT presentar ninguna factura como enviada ni autorizada ante el SRI mientras la emisión real no esté habilitada (`DP-034`, regla 8).

Trazabilidad: `DP-034` regla 8; `DP-036`, reglas 1, 2 y 3; `DP-037`; `DP-027`; `RN-FIS-009`; `UI-002`; invariantes 1, 2 y 16 del modelo de dominio; `docs/prototipo/README.md`, pantalla 1; `docs/plan-pantallas-prototipo.md` §1.1.

#### Scenario: Mantenimientos en curso
- **DADO** tres mantenimientos abiertos y cinco finalizados
- **CUANDO** un Encargado del taller abre la página de inicio
- **ENTONCES** SHALL ver los tres abiertos en «En el taller» y el acceso a la lista completa, con el mismo conteo que el pendiente de mantenimientos abiertos.

#### Scenario: Deudas de dos negocios
- **DADO** una venta de repuestos a crédito con saldo y una operación de servicios de contado sin cobrar, y un usuario que puede consultar ambos negocios
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL ver las dos filas en «Falta cobrar», cada una con el nombre de su negocio y su saldo, sin un total conjunto.

#### Scenario: Operaciones pendientes de factura local
- **DADO** una venta comercial confirmada sin preparación fiscal completada y una operación artesanal confirmada con preparación fiscal ya completada
- **CUANDO** un usuario con permisos en ambos negocios abre la página de inicio
- **ENTONCES** SHALL ver la venta comercial en «Falta facturar» con su nombre de negocio y acceso para facturarla, y SHALL NOT ver la operación artesanal cuya factura local ya está preparada.

#### Scenario: Rol sin acceso a uno de los negocios
- **DADO** un Vendedor sin permiso sobre mantenimientos ni sobre el negocio artesanal
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL NOT ver la lista «En el taller» ni filas del negocio artesanal en «Falta cobrar» ni en «Falta facturar», y el servidor SHALL NOT entregar esos datos.

#### Scenario: Falla de una lista
- **DADO** una falla al cargar «Falta facturar» o «Falta cobrar»
- **CUANDO** se abre la página de inicio
- **ENTONCES** SHALL mostrarse un error recuperable solo en esa lista, sin ocultar las demás listas ni bloques.
