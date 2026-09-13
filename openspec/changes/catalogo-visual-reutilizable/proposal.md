## Why

El sistema visual vigente ya contiene piezas reutilizables, pero varios patrones dependen de estilos de página y otros solo existen en Figma. Se necesita un catálogo completo, trazable y aislado para construir después una biblioteca visual fiel sin convertir la plantilla en funcionalidades del taller ni alterar las pantallas aprobadas.

## What Changes

- Especificar una biblioteca de patrones visuales reutilizables y sus variantes, con referencias estructuradas del archivo Figma `GRvgnODulXXrLTz4BsaToK`, comenzando por Dashboard Navigation `4:344` y cubriendo los otros 21 frames solicitados.
- Inventariar tokens, navegación, composición, controles, datos tabulares, superposiciones, calendarios, gráficos, cronogramas, autenticación y conversación exclusivamente como presentación.
- Clasificar el código existente entre reutilización intacta, adaptación posterior, pieza faltante y sustitución reservada a otro cambio.
- Definir una página interna de demostración aislada y criterios de aceptación unitarios, visuales, de accesibilidad y adaptación a tamaños de pantalla.
- Planificar fases pequeñas con **TDD**, evidencia comparativa y trazabilidad por componente, para una implementación posterior por GPT-5.6 Sol.

### Autorización y estado

La petición de esta sesión autoriza expresamente redactar propuesta, specs, diseño y tareas juntos y prohíbe implementación y commits. Esta excepción de planificación permite avanzar entre borradores sin los checkpoints intermedios de `openspec/config.yaml`; no declara aprobados los artefactos ni modifica esa configuración. Se trabaja en la rama recibida `develop`, sin cambiar ramas. Antes de aplicar se requiere aprobación explícita y registro de los artefactos en `master` según AGENTS.md. No ejecutar `apply` en esta sesión.

### Fuera de alcance

Código de producción o pruebas ejecutables durante esta sesión; modificación de componentes, estilos globales, rutas o páginas actuales; Usuarios, Auditoría, Login, Clientes, Vehículos y Marcas; backend, endpoints, modelos, migraciones, permisos, API y contratos; datos o funcionalidades de negocio. Tampoco se habilitan facturación, agenda, chat, gestión de tareas, registro público ni proveedores de autenticación.

No copiar marca Base, logotipos, fotografías, ilustraciones, personas, productos, textos ni datos demostrativos. Los nombres de frames son identificadores de procedencia, no nombres de futuras funcionalidades.

## Capabilities

### New Capabilities

- `catalogo-visual-reutilizable`: repertorio aislado de componentes y tokens, procedencia verificable, demostración interna y aceptación visual/accesible.

### Modified Capabilities

Ninguna. `sistema-visual-frontend` y `experiencia-adaptable-frontend` siguen vigentes. Este catálogo permite demostrar variantes adicionales; no autoriza migrar la aplicación a ellas. Cualquier sustitución del marco o de piezas existentes exige una especificación futura.

## Impact

**Usuarios afectados:** desarrolladores y revisores del catálogo; no cambia la operación del personal del taller. El futuro alcance técnico se limita a presentación compartida y demostración de desarrollo. No se necesitan dependencias de producción nuevas para la planificación.

**Dependencias:** sistema visual aprobado y arquitectura modular existente. El cambio activo `gestionar-clientes-y-vehiculos` se mantiene independiente y protegido; no se continúa ni se alteran sus artefactos. El inventario describe el checkout inspeccionado, no presupone integración o archivo de ese cambio.

**Riesgos:** fuga de estilos globales a páginas existentes; copiar contenido prohibido; atribuir a Figma estados no diseñados; confundir resultados técnicos con aprobación visual; pérdida de procedencia al caducar URLs de assets. El diseño deberá resolver aislamiento, clasificación de evidencia y comparación sin contenido demostrativo.

### Decisiones, recomendaciones e insuficiencias

- Confirmado: análisis y planificación solamente; React/Tailwind y arquitectura actual; referencias estructuradas mediante `get_design_context`, nunca deducción de estilos desde capturas.
- Recomendado: conservar tokens coincidentes, encapsular variantes y reservar las sustituciones para otro cambio.
- Contradicciones: barra expandida de Figma frente al rail compacto aprobado; textos Google Sans dentro de Create Event frente a Nunito; ilustraciones importadas por el diálogo actual frente a la exclusión de esta sesión. Se registran con resolución acotada en el diseño.
- Información insuficiente: no se han obtenido breakpoints ni variantes móviles explícitas de los frames solicitados. Carga, errores y vacío no tienen una referencia explícita completa; deben derivarse de las specs vigentes y etiquetarse como adaptación. No se inventan node IDs.
- Pendiente: revisión de los cuatro artefactos, aprobación para aplicación y checkpoint Git. No hay decisiones de negocio nuevas que requieran entrevista.

### Fuentes consultadas y trazabilidad

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` completo; `docs/arquitectura/modelo-dominio.md` completo: límites de negocio y **Monolito modular**; CT-001, DP-004, DP-008 y DP-018 se preservan sin añadir comportamiento.
- `openspec/config.yaml`, `AGENTS-glossary-reference.md`, `openspec/config-glossary-reference.md` y `docs/tecnico/glosario-tecnico.md`: flujo **OpenSpec** y terminología.
- `openspec/specs/sistema-visual-frontend/spec.md`, `openspec/specs/experiencia-adaptable-frontend/spec.md`: fidelidad, recursos locales, aislamiento de permisos, accesibilidad y tamaños.
- `docs/negocio/producto/vision.md` y `alcance-v1.md` (alcance local y exclusiones); `docs/negocio/requisitos/interfaz-y-navegacion.md`, `requisitos-no-funcionales.md` y `matriz-trazabilidad.md`: RNF-USA-001/002/004/006/007/008, RNF-COM-001/002/004/005, RNF-DIS-001 y RNF-MAN-001/003/005; patrones de listas, formularios y estados. No hay RF ni CU nuevos; UI-001/010/018/020/023 son superficies protegidas, no entregables.
- `docs/tecnico/arquitectura-inicial.md`, ADR-0001/0002/0003 y `docs/architecture/c4-containers.md`: fronteras frontend, dependencias y **Mismo origen**.
- `DESIGN.md`, `docs/tecnico/revision-visual-frontend.md` incluida aceptación del 2026-09-12, README, Makefile, `frontend/package.json`, estilos y componentes en `frontend/src/shared/`, marco autenticado, HomePage y LoginPage, pruebas E2E existentes: evidencia de código y convenciones actuales.
- Figma: los 22 frames solicitados, mediante `get_design_context`; nodos auxiliares de navegación, calendario anual y formularios de acceso para respuestas demasiado grandes. El diseño contiene el registro preciso, valores y matriz por componente.

Las menciones antiguas de bootstrap sin dominio implementado en documentos generales no describen el checkout actual: existen identidad y código de clientes/vehículos. Se registra la desactualización sin reescribir documentación de otros cambios.

[Referencia terminológica](proposal-glossary-reference.md).
