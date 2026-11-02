## ADDED Requirements

### Requirement: Detalle de servicio en la línea

Cada línea de servicio SHALL admitir un **detalle de servicio** opcional: una nota de hasta 300 caracteres en una sola línea, sin espacios exteriores, que precisa el trabajo de esa línea. Un valor vacío SHALL conservarse como ausencia.

SHALL poder escribirse al agregar la línea o después, en las mismas condiciones que cambiar su cantidad: intervención abierta, orden no finalizada, línea no documentada en una operación artesanal vigente y versión vigente de la orden. Escribirlo SHALL exigir `mantenimientos.gestionar` y consultarlo `mantenimientos.ver`. Cada cambio SHALL registrarse en la auditoría.

El detalle pertenece a la línea, no al catálogo. SHALL NOT cambiar el servicio, la cantidad, los precios, el impuesto ni los totales. Las líneas existentes SHALL conservarse sin detalle, sin exigir que se completen.

Trazabilidad: propuesta §A.3 y §C; DP-035 regla 3; RN-TAL-003/018; RF-TAL-005; CU-017; UI-072.

#### Scenario: Agregar una línea con detalle
- **DADO** una orden registrada y el servicio activo «Alineación»
- **CUANDO** un Encargado del taller lo agrega con el detalle «incluye rotación de llantas»
- **ENTONCES** la línea SHALL conservar ese detalle sin cambiar sus importes.

#### Scenario: Línea sin detalle
- **DADO** una orden registrada
- **CUANDO** se agrega un servicio sin detalle
- **ENTONCES** SHALL crearse la línea sin exigirlo.

#### Scenario: Escribir el detalle después
- **DADO** una línea no documentada de una intervención abierta
- **CUANDO** un Encargado del taller escribe su detalle
- **ENTONCES** SHALL conservarse, y el total de servicios de la orden SHALL seguir igual.

#### Scenario: Detalle excedido o con saltos de línea
- **DADO** una línea de servicio
- **CUANDO** se envía un detalle de 301 caracteres o con un salto de línea
- **ENTONCES** el sistema SHALL rechazarlo con un error de campo, sin recortarlo.

#### Scenario: Línea documentada
- **DADO** una orden registrada con «Alineación» documentada en `ART-SER-000004`
- **CUANDO** un Administrador intenta cambiar su detalle
- **ENTONCES** el sistema SHALL rechazarlo identificando `ART-SER-000004`.

#### Scenario: Orden finalizada
- **DADO** una orden finalizada con líneas sin documentar
- **CUANDO** se intenta cambiar el detalle de una línea
- **ENTONCES** el sistema SHALL rechazarlo indicando que la orden debe reabrirse.

#### Scenario: Servicio repetido
- **DADO** una orden con dos líneas de «Alineación»
- **CUANDO** se escribe el detalle de una de ellas
- **ENTONCES** la otra línea SHALL conservar su propio detalle.

#### Scenario: Catálogo sin cambios
- **DADO** una línea de «Alineación» con detalle
- **CUANDO** se agrega otra línea del mismo servicio o de otra orden
- **ENTONCES** la línea nueva SHALL iniciar sin detalle, porque el catálogo no lo conserva.

#### Scenario: Edición simultánea
- **DADO** dos usuarios que cambian a la vez el detalle de una línea con la misma versión de la orden
- **CUANDO** ambas solicitudes se procesan
- **ENTONCES** SHALL aplicarse una y la otra SHALL rechazarse por conflicto.

#### Scenario: Vendedor intenta escribir el detalle
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** envía directamente un detalle para una línea
- **ENTONCES** el sistema SHALL denegarlo sin cambiar la línea.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
