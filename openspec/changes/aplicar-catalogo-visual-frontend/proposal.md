## Why

La aplicación y el catálogo reutilizable no reproducen todavía con fidelidad verificable la referencia Figma aprobada: existen tokens de estilo que no generan utilidades, componentes con geometría o jerarquía distinta y evidencia marcada como verificada sin una comparación real. Además, la navegación autenticada usa en escritorio el rail compacto de 80 px, mientras el usuario ha elegido explícitamente la barra lateral desplegada de 218 px observada en Dashboard.

## What Changes

- Corregir las divergencias visuales confirmadas entre los componentes reutilizables, sus consumidores actuales y los nodos estructurados del archivo Figma `GRvgnODulXXrLTz4BsaToK`, sin deducir estilos desde capturas.
- Adoptar en escritorio amplio la navegación desplegada de Dashboard (`4:233`, fondo `4:234`, selección `4:329`), conservando navegación compacta en tableta y panel temporal en teléfono.
- Alinear colores, superficies, bordes, radios, elevaciones, tipografía, jerarquía de tarjetas, menús, calendarios e iconografía con sus referencias registradas; conservar únicamente las adaptaciones accesibles o de contenido que estén justificadas.
- Exigir objetivos táctiles de al menos 44 × 44 píxeles y hacer que la verificación automática falle cuando un control esencial no los cumpla.
- Sustituir el estado global e incondicional de evidencia por estados sustentados por componente y renovar las comparaciones visuales al viewport nativo correspondiente.
- Reparar las pruebas del catálogo que quedaron desalineadas con sus ejemplos neutrales y verificar que las páginas funcionales conserven permisos, rutas, datos y resultados.

### Objetivo y alcance

El objetivo es que la aplicación y el catálogo compartan un sistema visual coherente, trazable y comprobable, con la barra lateral desplegada en pantallas de escritorio amplias. El alcance comprende presentación compartida, marco autenticado, componentes C01–C66, catálogo interno, pruebas visuales, adaptación y documentación de evidencia.

### Fuera de alcance

- Cambios de negocio, permisos, roles, rutas, contratos HTTP, API, backend, modelos, migraciones o persistencia.
- Copiar la marca Base, logotipos, personas, fotografías, ilustraciones, productos, textos o datos demostrativos de la plantilla.
- Incorporar agenda, mensajería, facturación, registro público, acceso social u otras funciones sugeridas por los nombres de los frames.
- Eliminar la navegación compacta para tableta o el panel temporal para teléfono.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `sistema-visual-frontend`: precisar que la fidelidad exige resolver alias visuales efectivos, respetar la geometría y jerarquía de cada nodo y basar la aceptación en comparaciones reproducibles por componente.
- `experiencia-adaptable-frontend`: reemplazar la navegación compacta obligatoria en todo escritorio por una barra lateral desplegada de 218 px en escritorio amplio, conservando la variante compacta en tableta y el panel temporal en teléfono.

## Impact

**Usuarios afectados:** Administrador, Vendedor y Encargado del taller verán una navegación con etiquetas persistentes en escritorio amplio; la visibilidad de cada opción seguirá dependiendo exclusivamente de los permisos suministrados por el backend.

**Frontend:** se modificarán el sistema visual compartido, el marco autenticado, componentes reutilizables, el catálogo de desarrollo y sus pruebas. No se añadirán dependencias salvo que una necesidad actual y documentada lo justifique.

**Datos, API, permisos y operación:** sin cambios. La aplicación continuará usando sesiones, CSRF, mismo origen y los contratos existentes. La corrección deberá preservar el trabajo concurrente de clientes y vehículos presente en `develop`.

**Dependencias:** specs principales `sistema-visual-frontend`, `experiencia-adaptable-frontend` y `catalogo-visual-reutilizable`; referencia estructurada Figma; componentes y evidencia creados por el cambio archivado `catalogo-visual-reutilizable`.

**Riesgos:** reducir demasiado el área útil en resoluciones intermedias; introducir regresiones en navegación autorizada; confundir semejanza visual con equivalencia funcional; actualizar baselines desde una implementación incorrecta; o conservar estados `verified` sin evidencia comparable. La aceptación visual humana seguirá siendo distinta de las pruebas técnicas.

### Decisiones, contradicciones e información insuficiente

- **Confirmado por el usuario:** el escritorio amplio debe usar la barra desplegada de 218 px de `4:233`/`4:234`, no el rail compacto mostrado actualmente en la aplicación.
- **Contradicción resuelta por esta propuesta:** `interfaz-y-navegacion.md` prescribe navegación expandida en escritorio, pero la spec adaptable vigente exige 80 px desde 768 px. Se propone 218 px en escritorio amplio, 80 px en tableta y drawer bajo 768 px.
- **Confirmado por Figma:** Dashboard `4:2` presenta barra de 218 px desde x=0 y contenido desde x=248; `4:344` conserva la alternativa flotante de 80 px con margen de 30 px.
- **Confirmado en el código:** varios alias visuales usados no aparecen en el CSS compilado; la evidencia de los 66 componentes se marca como verificada de manera incondicional; CalendarToolbar contiene objetivos de 32 × 44 px; y dos pruebas del catálogo usan un nombre accesible obsoleto.
- **Información insuficiente:** Figma no define breakpoints responsivos. Los límites entre escritorio amplio, tableta y teléfono deberán concretarse en la spec usando los tamaños objetivo aprobados, sin atribuirlos a Figma.

### Fuentes consultadas y trazabilidad

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`: precedencia, límites del dominio y separación fiscal, que no cambian.
- `docs/negocio/producto/vision.md`, `alcance-v1.md` y `glosario.md`: uso desde computadora, tableta y teléfono, alcance local y terminología.
- `docs/negocio/requisitos/interfaz-y-navegacion.md`, `requisitos-no-funcionales.md` y `matriz-trazabilidad.md`: principios de navegación, `UI-001`, `UI-002`, `UI-010`, `UI-018`, `UI-020`, `UI-023`, `RNF-USA-001/002/006/007/008/009/011`, `RNF-COM-001/002` y `RNF-MAN-003/005`.
- `openspec/specs/sistema-visual-frontend/spec.md`, `experiencia-adaptable-frontend/spec.md` y `catalogo-visual-reutilizable/spec.md`: identidad visual, adaptación, objetivos táctiles, procedencia y aceptación comparativa.
- Artefactos completos del cambio archivado `catalogo-visual-reutilizable`, `DESIGN.md` y `docs/tecnico/revision-visual-frontend.md`: inventario C01–C66, decisiones anteriores, evidencia y divergencias aceptadas.
- `docs/tecnico/arquitectura-inicial.md`, `docs/architecture/c4-containers.md` y ADR-0001/0002/0003: fronteras del frontend, dependencias reproducibles, sesiones y **Mismo origen**.
- Figma mediante `get_design_context`: `4:2`, `4:233`, `4:234` y `4:329` para la variante desplegada; los 22 frames y nodos auxiliares registrados en el catálogo para el resto de componentes.
- Código y pruebas actuales: `frontend/src/shared/styles/index.css`, `frontend/src/app/AuthenticatedShell.tsx`, `frontend/src/shared/ui/`, `frontend/src/dev/visual-catalog/` y `frontend/e2e/catalog/`.

[Referencia terminológica](proposal-glossary-reference.md).
