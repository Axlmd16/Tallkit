## ADDED Requirements

### Requirement: Listas de trabajo «En el taller» y «Falta cobrar»

La página de inicio SHALL mostrar dos listas de trabajo, cada una limitada a lo que los permisos efectivos del usuario permiten consultar:

- **En el taller:** los mantenimientos abiertos (estados `registrado` y `reabierto`), cada fila con su número, cliente, placa y estado, y un acceso a su ficha.
- **Falta cobrar:** las operaciones confirmadas con saldo pendiente mayor que cero, cada fila con su negocio por nombre, número, cliente, saldo y un acceso a la operación.

Cada lista SHALL cargar y fallar por separado de los demás bloques, mostrar un máximo de filas con un acceso a la lista completa ya filtrada, y SHALL NOT mezclar entidades fiscales en una fila ni presentar un total conjunto. El conteo de «En el taller» SHALL coincidir con el de mantenimientos abiertos de los pendientes. «Falta cobrar» SHALL NOT presentarse como mora, vencimiento o intereses, y SHALL NOT incluir «falta facturar», que corresponde a un cambio posterior.

Trazabilidad: `DP-036`, reglas 1 y 2; `DP-027`; `RN-FIS-009`; `UI-002`; invariantes 1 y 2 y 16 del modelo de dominio; `docs/prototipo/README.md`, pantalla 1; propuesta.

#### Scenario: Mantenimientos en curso
- **DADO** tres mantenimientos abiertos y cinco finalizados
- **CUANDO** un Encargado del taller abre la página de inicio
- **ENTONCES** SHALL ver los tres abiertos en «En el taller» y el acceso a la lista completa, con el mismo conteo que el pendiente de mantenimientos abiertos.

#### Scenario: Deudas de dos negocios
- **DADO** una venta de repuestos a crédito con saldo y una operación de servicios de contado sin cobrar, y un usuario que puede consultar ambos negocios
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL ver las dos filas en «Falta cobrar», cada una con el nombre de su negocio y su saldo, sin un total conjunto.

#### Scenario: Rol sin acceso a uno de los negocios
- **DADO** un Vendedor sin permiso sobre mantenimientos
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL NOT ver la lista «En el taller» ni filas del negocio artesanal en «Falta cobrar», y el servidor SHALL NOT entregar esos datos.

#### Scenario: Falla de una lista
- **DADO** una falla al cargar «Falta cobrar»
- **CUANDO** se abre la página de inicio
- **ENTONCES** SHALL mostrarse un error recuperable solo en esa lista, sin ocultar «En el taller» ni los demás bloques.
