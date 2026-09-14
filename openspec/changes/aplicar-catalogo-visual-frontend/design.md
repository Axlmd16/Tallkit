## Context

El cambio archivado `catalogo-visual-reutilizable` creó 66 componentes, una entrada de catálogo y una matriz F01–F22. La revisión posterior con `get_design_context` confirmó que la procedencia está ampliamente registrada, pero la implementación no demuestra todavía fidelidad: cinco nombres de utilidades visuales no aparecen en el CSS compilado, varias superficies heredan contornos oscuros, la jerarquía de `MetricCard` está invertida, `DropdownMenu` usa una sombra plana, tres iconos declarados como exportaciones reproducen manualmente sus paths y el registro fuerza el estado `verified`.

La aplicación funcional usa `AuthenticatedShell.tsx`. Desde 768 px, CSS fuerza un rail flotante de 80 px aunque el JSX contiene una intención de 218 px desde `xl`. El usuario eligió la variante desplegada del Dashboard para escritorio amplio. La fuente estructurada establece: grupo `4:233`, fondo blanco `4:234` de 218 px, identidad en `4:330`, navegación desde y=130, selección `4:329`, perfil/salida al pie y contenido principal desde x=248. El rail `4:344` permanece como variante de tableta; Figma no define breakpoints.

El cambio es exclusivamente frontend. No altera dominio, datos, API, autenticación, autorización, sesiones, CSRF ni despliegue de **Mismo origen**. Debe preservar los cambios existentes de clientes, vehículos y marcas en `develop`.

### Fuentes y componentes afectados

| Área | Fuente Figma | Código principal |
| --- | --- | --- |
| Marco y navegación desplegada | `4:2`, `4:233`, `4:234`, `4:329`, `4:330` | `frontend/src/app/AuthenticatedShell.tsx`, `frontend/src/shared/styles/index.css` |
| Navegación reutilizable | `4:344`, `4:575`, `4:576`, `4:643`, `4:651`; variante desplegada `4:233` | `frontend/src/shared/ui/navigation/Sidebar.tsx`, `NavigationItem.tsx` |
| Tarjeta métrica | `4:508`, `4:510`, `4:511`, `4:164`, `4:166` | `frontend/src/shared/ui/surfaces/MetricCard.tsx` |
| Menú contextual | `4:1497`, `4:1498`, `4:1502`, `4:1507` | `frontend/src/shared/ui/overlays/DropdownMenu.tsx` |
| Iconos Figma | `4:645`, `4:622`, `4:637`, `4:323` | `frontend/src/shared/ui/icons/index.tsx`, `frontend/src/assets/figma/` |
| Calendario y tactilidad | `4:5455`, `4:5456`, `4:5474`, `4:5475` | `frontend/src/shared/ui/calendar/`, `frontend/e2e/catalog/phase15-final.spec.ts` |
| Procedencia y evidencia | F01–F22 registrados | `frontend/src/dev/visual-catalog/registry.ts`, `CatalogApp.tsx`, `frontend/e2e/catalog/` |

Los demás componentes C01–C66 se revisan mediante sus `frameRef` y `nodes` ya declarados. Una referencia marcada `A` es una adaptación y no recibe un node ID inventado.

## Goals / Non-Goals

**Goals:**

- Hacer efectivos y coherentes los colores, radios, elevaciones y superficies en el CSS producido.
- Reproducir la barra lateral desplegada de 218 px en anchos desde 1280 px, conservar el rail de 80 px entre 768 y 1279 px y usar drawer bajo 768 px.
- Corregir todas las divergencias no justificadas encontradas en el catálogo, empezando por los hallazgos confirmados y extendiendo la inspección a C01–C66.
- Mantener por componente la fuente Figma, adaptación, estado y referencias de evidencia reales.
- Incorporar pruebas que fallen ante regresiones geométricas, visuales, táctiles y de accesibilidad.
- Renovar evidencia externa comparable al viewport nativo y obtener aceptación visual explícita.

**Non-Goals:**

- Cambiar permisos, rutas, contratos, datos, reglas de negocio o persistencia.
- Copiar identidad, personas, ilustraciones, textos o datos de la plantilla.
- Convertir calendarios, tableros, gráficos o conversación en funcionalidades de negocio.
- Añadir una dependencia de comparación de imágenes mientras Playwright cubra la necesidad.
- Reemplazar componentes funcionales ajenos al alcance o reescribir las páginas de clientes y vehículos.

## Decisions

### 1. Las propiedades estructuradas gobiernan la corrección

`get_design_context` será la fuente de geometría, orden, tipografía, color, elevación y assets. Las capturas se usarán para comparar el resultado, nunca para inferir valores. Cada lote comenzará revisando los node IDs de los componentes incluidos y conservará en el registro su `frameRef`, `nodes` y adaptación.

Se usarán como raíces los 22 frames ya registrados: `4:344`, `4:2`, `4:660`, `4:1140`, `4:1635`, `4:2246`, `4:2803`, `4:3258`, `4:4239`, `4:4567`, `4:4981`, `4:5455`, `4:5816`, `4:6241`, `4:6577`, `4:3637`, `4:3942`, `4:8584`, `4:7725`, `4:9302`, `4:9333` y `4:7438`. Los nodos auxiliares se consultarán cuando una raíz retorne solo metadata o exceda el contexto.

**Alternativa descartada:** ajustar por semejanza visual a partir de las capturas. No ofrece valores verificables y contradice la instrucción del usuario.

### 2. Convergencia sobre los tokens canónicos existentes

Los consumidores usarán los nombres que realmente genera `@theme`: `canvas`, `surface`, `surface-subtle`, `line`, `radius-control`, `radius-group`, `radius-dialog`, `shadow-row`, `shadow-menu` y `shadow-overlay`. Se reemplazarán usos ambiguos como `border-border`, `border-border-subtle`, `bg-surface-ground`, `rounded-card`, `rounded-panel` y `var(--color-border)` por tokens canónicos o por el valor específico del nodo cuando la referencia lo exija.

No se añadirán alias duplicados para ocultar nombres incorrectos. Después del build, una prueba inspeccionará estilos computados de ejemplos representativos y confirmará que un borde no pueda degradarse a `currentColor`. Los bordes se retirarán de las piezas cuya referencia no los declare; `line` no se convertirá en borde global obligatorio.

**Alternativa descartada:** declarar aliases globales para todos los nombres usados. Reduciría el diff inicial, pero perpetuaría dos vocabularios visuales y podría aplicar bordes donde Figma usa solo espacio.

### 3. Tres variantes responsivas explícitas para la navegación

`AuthenticatedShell` conservará una sola lista de destinos filtrada por permisos y tres composiciones CSS:

- `<768 px`: cabecera móvil y drawer existente.
- `768–1279 px`: rail flotante 80 px de `4:344`, con nombre accesible por enlace y contenido desplazado hasta x=140 equivalente.
- `≥1280 px`: sidebar fijo blanco de 218 px en x=0, sin borde divisor dominante; contenido con inicio equivalente a x=248, iconos y etiquetas visibles, identidad superior y perfil/salida al pie.

El breakpoint de 1280 px es una adaptación de la aplicación, no un dato atribuido a Figma. La selección activa conservará el gradiente `#ACA9FF` al 20 % y el texto/icono `#605BFF`; no se añadirá una barra vertical ajena a `4:329`. No se incluirá la promoción “Upgrade Now” ni la persona de la plantilla.

El componente reutilizable `Sidebar` mantendrá props controladas para variante desplegada, plegada y móvil; sus defaults no decidirán permisos ni navegación.

**Alternativa descartada:** usar 218 px desde 768 px. Comprimiría el contenido en tableta y contradice la adaptación aprobada.

### 4. Correcciones por componente antes de una auditoría completa

Se resolverán primero fallos confirmados con pruebas independientes:

- `MetricCard`: valor antes de etiqueta, 22 px en variante estándar, superficie plana y sin borde dominante.
- `DropdownMenu`: radio 10 px, sombra `shadow-menu`, fondo blanco y separación de items según `4:1498`.
- `CalendarToolbar`: área activable mínima 44 × 44 px; la prueba de coarse pointer usará una aserción bloqueante. Para checkbox medirá el control activable completo, no solo el input interno.
- `DataTable`: alinear el nombre accesible de la prueba con el ejemplo neutral sin regresar a contenido de la plantilla.

Después se recorrerán C01–C66 por familia. Cada divergencia se corregirá o se registrará como adaptación; no se hará una sustitución mecánica de todas las clases sin inspeccionar la fuente de cada pieza.

### 5. Assets Figma locales, no paths reconstruidos

`category.svg`, `chart.svg` y `document.svg` existentes serán consumidos como assets empaquetados con dimensiones explícitas. El wrapper accesible podrá usar `<img>` decorativo o con nombre según contexto; Phosphor se conservará únicamente en iconos catalogados como adaptación o cuya geometría sea equivalente.

Los colores embebidos de los SVG exportados se respetarán donde el nodo define color. Si una variante activa necesita otro color, se usará la exportación correspondiente o una técnica de presentación que no reescriba el path. Las URLs temporales del MCP no llegarán al código.

**Alternativa descartada:** conservar los paths copiados dentro de JSX. Aunque la geometría actual se parezca, no constituye una exportación verificable y contradice el flujo design-to-code.

### 6. Evidencia individual con estados honestos

`EvidenceStatus` admitirá al menos `pending`, `in-progress`, `divergent` y `verified`. Se eliminará cualquier mapeo que fuerce `verified`; cada entrada declarará su estado y referencias. Una entrada solo podrá quedar `verified` cuando tenga:

1. node IDs o marca `A` verificables;
2. prueba enfocada que ejercite el resultado relevante;
3. captura de implementación al viewport requerido;
4. referencia Figma equivalente cuando sea de tipo `E`;
5. comparación o revisión registrada, con divergencias aceptadas explícitamente.

`CATALOG_EVIDENCE_DIR` seguirá siendo obligatorio y externo al repositorio. Allí se separarán `figma/`, `actual/`, `diff/`, `approved/` y un manifiesto con componente, variante, nodo, viewport, DPR, navegador, fuente, máscaras, tolerancia y checksum. Los archivos Figma se exportarán a escala 1 mediante la integración Figma y no desde screenshots manuales.

Playwright usará su comparador de imágenes y una ruta de snapshots derivada del directorio externo. Las regiones con contenido neutral distinto podrán usar máscaras declaradas y recortes equivalentes; no se enmascarará un componente completo. La promoción de una captura a baseline aprobado requerirá una acción explícita posterior a la revisión del usuario.

**Alternativa descartada:** considerar `page.screenshot()` o axe como verificación visual. Ambos producen evidencia útil, pero no comparan fidelidad.

### 7. TDD y verificación por capas

Cada corrección seguirá **TDD**: añadir o ajustar una prueba que falle por la divergencia concreta, observar el fallo, implementar lo mínimo y volver a ejecutar la prueba. Los tests unitarios comprobarán orden semántico, props, estados y accesibilidad; Playwright comprobará estilos computados, breakpoints, geometría, áreas táctiles, ausencia de overflow y comparación visual.

El cierre ejecutará pruebas enfocadas, suite completa del catálogo, pruebas frontend completas, build y comandos oficiales aplicables. Los fallos preexistentes de clientes/vehículos se separarán mediante evidencia de base; no se modificarán expectativas funcionales para hacerlos pasar.

### 8. Impactos arquitectónicos y operativos

- **Backend, datos y API:** sin cambios; no hay migraciones, OpenAPI ni transacciones nuevas.
- **Seguridad y permisos:** `NavigationItems` seguirá filtrando exclusivamente `session.permissions`; las etiquetas visibles no amplían autorización. Sesión y CSRF no cambian.
- **Concurrencia e idempotencia:** no aplican a la presentación corregida; el logout conserva el bloqueo de doble envío existente.
- **Dependencias:** no se prevén dependencias nuevas. Cualquier necesidad emergente deberá justificarse y mantener `package.json`/`package-lock.json` sincronizados.
- **ADR/C4:** no se requiere modificación; el cambio permanece dentro del contenedor web y de las fronteras frontend aceptadas.
- **Operación:** el catálogo continúa fuera del build productivo y no realiza solicitudes de negocio.

## Risks / Trade-offs

- **[Menor ancho útil a 1280 px]** → reservar 218 px solo desde el breakpoint aprobado, probar textos largos y ausencia de overflow en 1280/1366/1440 px.
- **[Cambios globales de tokens afectan páginas existentes]** → migrar nombres canónicos de forma localizada, capturar superficies protegidas y revisar el CSS compilado.
- **[Assets con colores fijos no sirven para todos los estados]** → conservar Phosphor como adaptación documentada cuando no exista exportación equivalente; no alterar bytes atribuidos a Figma.
- **[Pixel diff sensible a fuentes y antialiasing]** → fijar Chromium, DPR 1, viewport, Nunito cargada y tolerancia documentada; comparar regiones equivalentes.
- **[Baseline incorrecto legitimado automáticamente]** → separar `actual` de `approved`, exigir checksum y aprobación humana para promover.
- **[66 componentes vuelven inmanejable una sola ejecución]** → trabajar por familias y permitir selección de lotes, manteniendo una corrida integral antes del cierre.
- **[Interferencia con trabajo de clientes/vehículos]** → limitar ediciones a archivos visuales compartidos confirmados, revisar el diff antes de cada etapa y no reformatear archivos ajenos.

## Migration Plan

1. Registrar design y tasks aprobados en `master`; aplicar desde `develop` solo cuando esos artefactos estén disponibles allí.
2. Capturar la línea base funcional y marcar inicialmente como `pending` o `divergent` toda evidencia no demostrada.
3. Corregir tokens y añadir el gate de CSS compilado; verificar consumidores antes de continuar.
4. Implementar navegación desplegada, componentes confirmados, assets y tactilidad mediante ciclos TDD separados.
5. Auditar C01–C66 por familia y generar referencias, capturas y diffs externos.
6. Ejecutar la verificación completa y presentar la galería comparativa para aceptación visual.
7. Tras aceptación e integración, sincronizar specs principales y documentación durante el archivo desde `master`.

El rollback consiste en revertir los commits de implementación sin tocar datos ni backend. La evidencia previa se conserva en una carpeta externa separada y los baselines aprobados no se sobrescriben automáticamente.

## Open Questions

No quedan decisiones funcionales abiertas para redactar las tareas. La tolerancia numérica definitiva de comparación se propondrá en tasks y solo se aplicará a regiones equivalentes; no podrá invalidar una diferencia en propiedades estructuradas exactas.

[Referencia terminológica](design-glossary-reference.md).
