## ADDED Requirements

### Requirement: Negocio identificado por su nombre

Las pantallas de uso diario SHALL identificar cada negocio por su nombre comercial o, si no lo tiene, por su razón social, y SHALL NOT mostrar «RUC comercial» ni «RUC artesanal» como nombre del negocio. El RUC SHALL seguir visible en facturas, comprobantes y «Ajustes». Los nombres de los negocios SHALL estar disponibles para todo usuario autenticado; el RUC y los demás datos fiscales SHALL seguir sujetos a los permisos de configuración y de consulta fiscal. Cada negocio SHALL conservar su distintivo (nombre, icono y tono) en toda pantalla con ámbito económico, y un nombre comercial vacío SHALL conservarse como ausencia sin mostrar un texto vacío.

Trazabilidad: `DP-036`, regla 3; `RN-FIS-009`; `RNF-USA-009`, `RNF-USA-010`; `configuracion-operativa-y-fiscal`; glosario, «Términos visibles en pantalla».

#### Scenario: Negocio con nombre comercial
- **DADO** un negocio con nombre comercial y otro sin él
- **CUANDO** se abre una pantalla económica de cada uno (ficha de mantenimiento, cobro, cuentas, lista de productos)
- **ENTONCES** SHALL verse el nombre comercial del primero y la razón social del segundo, y SHALL NOT verse «RUC comercial» ni «RUC artesanal» como etiqueta del negocio.

#### Scenario: RUC donde importa
- **DADO** una factura, un recibo o la pantalla «Ajustes» de un negocio
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrarse su RUC junto a su nombre, y un usuario sin permiso de configuración o consulta fiscal SHALL NOT recibirlo del servidor.

#### Scenario: Mismo nombre en dos negocios
- **DADO** dos negocios cuyo nombre visible coincide
- **CUANDO** se muestran en una misma pantalla
- **ENTONCES** SHALL poder distinguirse por su distintivo o por un dato adicional, sin recurrir a «RUC comercial» ni «RUC artesanal».

### Requirement: Términos simples en pantalla

Las pantallas de uso diario SHALL usar estas equivalencias y SHALL NOT mostrar el término del dominio cuando no ayude a la tarea:

| Concepto interno | Se muestra como |
|---|---|
| Orden de mantenimiento | Mantenimiento |
| Comprobante interno de una operación | Recibo |
| Importe exigible | Total a pagar |
| Kardex | Movimientos |

Los textos que advierten que un recibo no es una factura electrónica autorizada, y los avisos legales o fiscales, SHALL conservarse con su redacción. Las equivalencias SHALL registrarse en `docs/negocio/producto/glosario.md`. Las pruebas automáticas SHALL NOT fijar el texto de estos términos, salvo los avisos legales o fiscales.

Trazabilidad: `DP-036`, reglas 1 y 3; `RNF-USA-009`; `DP-018`; invariante 25 del modelo de dominio; glosario.

#### Scenario: Recibo de una operación
- **DADO** una operación confirmada con comprobante interno
- **CUANDO** se consulta o se imprime
- **ENTONCES** SHALL llamarse «Recibo», y SHALL conservar el aviso de que no es una factura electrónica autorizada.

#### Scenario: Pantalla de un mantenimiento
- **DADO** un mantenimiento con servicios y repuestos
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrarse el «Total a pagar» de cada negocio por separado, y SHALL NOT mostrarse la expresión «importe exigible» ni «operación artesanal» como encabezado de uso diario.

### Requirement: Importes y porcentajes legibles

Los precios finales, totales, impuestos, saldos y abonos SHALL mostrarse con exactamente dos decimales, y los porcentajes de tarifa SHALL mostrarse sin ceros sobrantes («0 %», «15 %»). La tarifa de una línea SHALL mostrarse una sola vez. Un costo o un costo promedio, visible solo para quien ya puede verlo, SHALL poder conservar su precisión de hasta seis decimales. Esta regla SHALL cambiar únicamente la presentación: los valores guardados y los cálculos SHALL permanecer exactos.

Trazabilidad: `DP-036`, regla 3; `DP-017`; `DP-023`; `DP-025`; `RNF-USA-009`.

#### Scenario: Precio con decimales de más
- **DADO** un producto con precio final 23.00 guardado con más decimales en la presentación actual
- **CUANDO** aparece en una lista, ficha, venta o recibo
- **ENTONCES** SHALL mostrarse como 23.00.

#### Scenario: Línea con tarifa cero
- **DADO** una línea con IVA 0 %
- **CUANDO** se muestra
- **ENTONCES** SHALL verse «IVA 0 %» una sola vez y sin «0.0000 %».

#### Scenario: Costo promedio
- **DADO** un Administrador que consulta el costo promedio de un producto
- **CUANDO** el costo tiene más de dos decimales
- **ENTONCES** SHALL poder mostrarse con su precisión, y un Vendedor SHALL NOT recibirlo.

### Requirement: Acciones que dicen lo que hacen

El texto de una acción SHALL describir el efecto que producirá. El botón de un cobro de servicios o de repuestos SHALL decir «Registrar cobro», y «Registrar retención» SHALL aparecer únicamente cuando la retención sea lo único que se va a registrar. Las fichas de uso diario SHALL NOT mostrar datos técnicos internos, como la versión de registro del cliente, que el sistema SHALL seguir usando para evitar ediciones simultáneas.

Trazabilidad: `DP-036`, regla 3; `DP-027`; `DP-032`; `RNF-USA-009`.

#### Scenario: Cobro sin importes
- **DADO** el diálogo de cobro abierto y sin importes capturados
- **CUANDO** se muestra su botón principal
- **ENTONCES** SHALL decir «Registrar cobro», sin «retención».

#### Scenario: Solo retención
- **DADO** un cobro en el que solo se capturó una retención
- **CUANDO** se muestra su botón principal
- **ENTONCES** SHALL decir «Registrar retención» y registrar únicamente la retención.

#### Scenario: Ficha del cliente
- **DADO** la ficha de un cliente
- **CUANDO** se consulta
- **ENTONCES** SHALL NOT mostrar la versión de registro, y editar con una versión desactualizada SHALL seguir rechazándose.

### Requirement: Avisos que no tapan el total

Los avisos temporales y los mensajes del sistema SHALL NOT cubrir el total, el saldo ni la acción principal de la pantalla, en 360, 768, 1024 y 1440 px. Las advertencias y los errores SHALL permanecer en línea junto a lo afectado, y las confirmaciones de acciones terminadas SHALL desaparecer sin bloquear el contenido.

Trazabilidad: `DP-036`, regla 1; `interfaz-y-navegacion.md` §2.1 y §8.2; `experiencia-adaptable-frontend`.

#### Scenario: Confirmación con el total visible
- **DADO** una pantalla con un total y una acción principal visibles
- **CUANDO** se muestra una confirmación temporal
- **ENTONCES** SHALL aparecer sin cubrir esos dos elementos y SHALL poder cerrarse con teclado.
