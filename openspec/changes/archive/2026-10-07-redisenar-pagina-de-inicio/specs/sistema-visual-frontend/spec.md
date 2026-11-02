## ADDED Requirements

### Requirement: Indicadores con conteo y gráfico breve

El sistema visual SHALL ofrecer dos piezas reutilizables para resumir datos, construidas únicamente con los tokens semánticos existentes:

- **Indicador con conteo:** un valor (número o importe), su etiqueta y, cuando sea económico, su ámbito fiscal. Cuando conduce a una lista SHALL comportarse como un enlace, con el tratamiento de enlace y foco del sistema. Varios indicadores relacionados SHALL presentarse dentro de un mismo panel, separados por línea o espacio, sin sombra ni una tarjeta elevada por cada uno. El valor cero SHALL mostrarse sin énfasis de advertencia.
- **Gráfico breve:** una serie corta de barras de un solo ámbito, con su total, sin ejes decorativos, leyendas flotantes ni animaciones que no respeten `prefers-reduced-motion`. SHALL usar el tono del ámbito fiscal que representa. Cada barra SHALL exponer su fecha y su importe como texto accesible y por puntero, foco o toque. Un valor cero SHALL distinguirse de la ausencia de dato.

Ninguna de las dos piezas SHALL depender solo del color para comunicar un estado o un ámbito, ni usar el naranja del logotipo como texto. Los importes SHALL usar la pieza de importes existente. Las dos piezas SHALL incorporarse al catálogo visual con sus estados de carga, vacío, cero y error. Trazabilidad: D2 del cambio `redisenar-pagina-de-inicio`; «Jerarquía mediante lienzo y superficies elevadas», «Estados y ámbitos comprensibles sin depender del color», «Tokens semánticos con bases para tema oscuro» y «Piezas visuales propias del taller» de esta spec; RNF-USA-006/008/010; RNF-MAN-003.

#### Scenario: Varios indicadores en un panel
- **WHEN** una pantalla muestra cuatro indicadores relacionados
- **THEN** SHALL presentarlos en un mismo panel con borde fino, comparables entre sí, sin sombra ni tarjeta elevada por indicador

#### Scenario: Indicador que conduce a una lista
- **WHEN** un usuario enfoca con el teclado un indicador que conduce a una lista
- **THEN** SHALL mostrar el foco visible del sistema y su nombre accesible SHALL incluir el valor, la etiqueta y el ámbito fiscal cuando lo tenga

#### Scenario: Gráfico de un ámbito fiscal
- **WHEN** se muestra un gráfico breve del RUC artesanal
- **THEN** SHALL usar el tono artesanal, identificar el ámbito con su nombre y su icono, y SHALL NOT combinar valores del RUC comercial en la misma serie

#### Scenario: Valor de una barra
- **WHEN** un usuario señala, enfoca o toca una barra
- **THEN** SHALL conocer la fecha y el importe de esa barra como texto

#### Scenario: Movimiento reducido
- **WHEN** el dispositivo solicita movimiento reducido
- **THEN** el gráfico breve SHALL mostrarse sin animación de entrada

#### Scenario: Cambio de un token
- **WHEN** se modifica el valor del token de tono de un ámbito fiscal
- **THEN** los indicadores y gráficos de ese ámbito SHALL reflejar el cambio sin editar cada pantalla
