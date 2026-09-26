## MODIFIED Requirements

### Requirement: Piezas visuales propias del taller
La interfaz SHALL representar de forma consistente los datos propios del negocio:
- **Placa:** en una pieza reconocible, con tipografía monoespaciada.
- **Placa de RUC:** el RUC de una entidad fiscal en una pieza reconocible y contenida, con la etiqueta «RUC» diferenciada del número y el número en tipografía monoespaciada, sin separadores añadidos que alteren sus 13 dígitos. La etiqueta SHALL formar parte del nombre accesible.
- **Código de repuesto:** en una etiqueta monoespaciada que permite copiarlo.
- **Existencias:** cantidad disponible acompañada del estado «Agotado» cuando es cero, sin clasificarla como baja mediante un umbral no decidido.
- **Importes:** con moneda, dos decimales y alineación a la derecha, y guion cuando no existe dato del servidor.

**Trazabilidad:** `DP-002`, `DP-017`; pendiente `RF-INV-011`; separación fiscal confirmada; `RNF-USA-006`, `RNF-USA-009`; tablero «Fundamentos», sección «Componentes del negocio»; maqueta «Configuración del taller» del cambio `redisenar-pagina-de-configuracion`.

#### Scenario: Producto sin existencias
- **WHEN** un producto tiene existencia cero
- **THEN** SHALL mostrarse su cantidad y el texto «Agotado» con un indicador redundante al color

#### Scenario: Producto con pocas unidades
- **WHEN** un producto tiene pocas unidades disponibles
- **THEN** SHALL mostrarse la cantidad y SHALL NOT mostrarse «Stock bajo» ni otra clasificación basada en un umbral

#### Scenario: Copiar un código
- **WHEN** el usuario activa la acción de copiar de un código de repuesto
- **THEN** el código SHALL copiarse al portapapeles y la acción SHALL tener un nombre accesible

#### Scenario: RUC de una entidad fiscal
- **WHEN** se muestra el RUC `1140258475001` de una entidad fiscal en la configuración
- **THEN** SHALL verse en una placa de RUC con la etiqueta «RUC» y los 13 dígitos en tipografía monoespaciada, y las tecnologías de asistencia SHALL anunciar «RUC 1140258475001»

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
