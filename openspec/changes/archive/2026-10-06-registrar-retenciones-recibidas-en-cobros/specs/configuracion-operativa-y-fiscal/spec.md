## ADDED Requirements

### Requirement: Ajustes de retenciones recibidas en el perfil tributario

El perfil tributario de cada **entidad fiscal** SHALL incluir los ajustes de **retenciones recibidas**, que solo el Administrador modifica dentro del apartado existente, sin una sección o pestaña nueva:

- **registro de retenciones**: activado o desactivado, activado por defecto;
- **porcentaje de advertencia**: un valor mayor que 0 y hasta 100 con un máximo de dos decimales, o desactivado; por defecto 20.

Cada ajuste SHALL declararse por entidad e independiente de la otra, con ayuda contextual en lenguaje llano. SHALL NOT derivarse del régimen, de la condición de agente de retención del emisor ni de ninguna otra condición tributaria. Modificarlos SHALL quedar auditado, SHALL NOT alterar retenciones, cobros ni preparaciones anteriores y SHALL NOT cambiar el estado del perfil ni bloquear la preparación fiscal. Una entidad sin perfil guardado SHALL usar los valores por defecto. Trazabilidad: propuesta de retenciones F20…F22, D4/D7 y principio 19; RF-ACC-010/011; CU-003.

#### Scenario: Valores por defecto
- **DADO** una entidad fiscal que nunca cambió estos ajustes
- **CUANDO** se consulta su perfil tributario
- **ENTONCES** SHALL mostrar el registro de retenciones activado y la advertencia al 20 %.

#### Scenario: Desactivar en una sola entidad
- **DADO** dos entidades con el registro activado
- **CUANDO** el Administrador lo desactiva en una
- **ENTONCES** SHALL quedar desactivado solo en esa, con el cambio auditado y sin modificar el estado de su perfil.

#### Scenario: Porcentaje inválido
- **DADO** un Administrador que edita la advertencia
- **CUANDO** envía 0, un valor mayor que 100 o con más de dos decimales
- **ENTONCES** SHALL rechazarse sin cambiar el ajuste.

#### Scenario: Usuario operativo intenta cambiar los ajustes
- **DADO** un Vendedor sin rol Administrador
- **CUANDO** intenta desactivar el registro de retenciones
- **ENTONCES** SHALL denegarse sin modificar información.

#### Scenario: Cambio sin efecto retroactivo
- **DADO** una operación con una retención vigente registrada con la advertencia al 20 %
- **CUANDO** el Administrador cambia la advertencia al 10 % o desactiva el registro
- **ENTONCES** la retención SHALL conservarse sin cambios.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
