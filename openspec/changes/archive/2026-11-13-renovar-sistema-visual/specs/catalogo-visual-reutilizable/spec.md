## MODIFIED Requirements

### Requirement: CVR-02 Identidad visual y recursos locales

El catálogo SHALL usar exclusivamente los tokens, la tipografía Montserrat y la iconografía del sistema Tallkit · Grafito y cobre, servidos desde la instalación local. SHALL mostrar los componentes y patrones nuevos de este cambio, incluidos la marca de negocio, la placa, los segmentos con contador, la búsqueda subrayada y el patrón maestro y detalle. Los contenidos de demostración SHALL ser neutrales o datos ficticios del taller identificados como ejemplo, y SHALL NOT contener marcas, logotipos, ilustraciones, fotografías ni textos de plantillas de terceros.

Trazabilidad: RNF-USA-006/008/009, RNF-DIS-001; sistema-visual-frontend; `DESIGN.md`.

#### Scenario: Demostración sin contenido de terceros

- **GIVEN** un patrón del catálogo
- **WHEN** se muestra su ejemplo
- **THEN** usa la identidad Tallkit · Grafito y cobre con contenido de ejemplo y no muestra recursos ni datos de la plantilla retirada ni de la dirección «Banco de trabajo»

#### Scenario: Red local sin Internet

- **GIVEN** el catálogo disponible localmente
- **WHEN** se bloquean las solicitudes externas
- **THEN** la fuente Montserrat, los iconos, los controles y las superficies permanecen disponibles
