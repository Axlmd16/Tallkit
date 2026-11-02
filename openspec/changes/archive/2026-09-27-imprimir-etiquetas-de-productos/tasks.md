## 1. Preparación y línea base focalizada

Dependencias: propuesta, specs y diseño aprobados. Antes de aplicar, estos artefactos deben estar registrados en `master`, conforme a `AGENTS.md`; continuar el artefacto sin checkpoint no autoriza la aplicación.

Por instrucción del usuario se ejecutan solo pruebas focalizadas. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde. No se ejecutan `make check`, `make test`, pytest completo, Vitest completo ni Playwright completo.

- [x] 1.1 Comprobar `git status --short`, la rama vigente y que este cambio exista sin modificaciones pendientes en `master` antes de tocar código. Registrar contradicciones o cambios ajenos en las rutas afectadas; no crear commits, ramas ni merges sin autorización.
- [x] 1.2 Ejecutar y registrar la línea base: `cd backend && uv run --frozen pytest --no-cov tests/catalog/test_catalog_api.py tests/workshop_configuration/test_entity_logo_api.py tests/api/test_openapi.py` y `cd frontend && npx vitest run src/pages/products/ProductsPage.test.tsx src/pages/products/ProductDetailPage.test.tsx src/shared/api/entity-logos.test.tsx src/shared/ui/layout.test.tsx`.
- [x] 1.3 Añadir a `docs/negocio/requisitos/cobertura-catalogos.md` una matriz pendiente que relacione cada requirement y escenario de las tres specs delta con los grupos y archivos de prueba de este checklist.

Evidencia del grupo: estado Git registrado, artefactos confirmados en `master`, comandos de línea base con resultado real y cobertura pendiente trazada.

## 2. Proyección de productos para etiquetas (backend)

Dependencias: grupo 1. Diseño D1 y D9; spec `catalogo-de-productos-y-categorias`, «Proyección completa del filtro para etiquetas».

- [x] 2.1 Escribir primero `backend/tests/catalog/test_product_label_data_api.py` con casos que fallen por ausencia de la ruta: sesión y `productos.ver` para Administrador, Vendedor y Encargado; denegación sin permiso; conjunto vacío; proyección mínima; y ausencia de precio, costo, existencia y campos ajenos a la **etiqueta de producto**.
- [x] 2.2 Ampliar las pruebas rojas de 2.1 para búsqueda, estado, categoría, marca de producto y marca de vehículo; combinaciones, filtros inválidos sin resultado parcial, mismo orden estable del listado y más de 100 coincidencias devueltas exactamente una vez.
- [x] 2.3 Extraer en `backend/src/catalog/application/queries.py` el constructor compartido del `QuerySet` filtrado y ordenado, mantener sin cambios la paginación de `list_products` y crear `list_product_label_data` con la proyección mínima y la marca precargada.
- [x] 2.4 Crear el serializer, la vista GET protegida por `productos.ver` y la ruta `/api/v1/products/label-data/` antes de la ruta con `<int:pk>`. Hacer pasar 2.1–2.2 y refactorizar sin introducir escritura, bloqueo, auditoría ni N+1.
- [x] 2.5 Añadir una prueba focalizada de número de consultas y una prueba de regresión que compare filtros y orden entre la lista ordinaria y `label-data`; rechazar `page`, `page_size` y otros parámetros ajenos con un error corregible, sin resultado parcial.
- [x] 2.6 Documentar la ruta, parámetros, respuesta y problemas en el **contrato OpenAPI**; ampliar `backend/tests/api/test_openapi.py` y regenerar `backend/schema.yml` con `cd backend && uv run --frozen python manage.py spectacular --file schema.yml --validate`.
- [x] 2.7 Verificar el grupo con `cd backend && uv run --frozen pytest --no-cov tests/catalog/test_product_label_data_api.py tests/catalog/test_catalog_api.py tests/api/test_openapi.py`, Ruff sobre los archivos tocados y mypy sobre `src/catalog` y esas pruebas.

Evidencia del grupo: rojo y verde registrados, respuesta no paginada conforme al filtro, matriz de permisos completa, consultas acotadas y OpenAPI validado.

## 3. Nombre visible de la entidad comercial

Dependencias: grupo 1. Diseño D2 y D8; spec `impresion-de-etiquetas-de-productos`, «Contenido identificativo de la etiqueta» y «Vista previa fiel y preparación de la marca».

- [x] 3.1 Añadir primero casos rojos a `backend/tests/workshop_configuration/test_entity_logo_api.py`: `display_name` usa `trade_name` sin espacios exteriores cuando existe, reserva a `legal_name` cuando está vacío y conserva el campo `legal_name` para consumidores actuales.
- [x] 3.2 Implementar `display_name` en el resumen autenticado `entity-logos/`, sin cambiar permisos, caché, entrega privada ni datos del **logotipo de entidad fiscal**. Hacer pasar 3.1 y refactorizar el cálculo a una única función.
- [x] 3.3 Añadir primero casos rojos a `frontend/src/shared/api/entity-logos.test.tsx` para el nuevo contrato y `useIssuerBrand("COMERCIAL")`; después exponer `displayName` sin alterar los comprobantes existentes.
- [x] 3.4 Actualizar el esquema OpenAPI del resumen y verificar el grupo con `cd backend && uv run --frozen pytest --no-cov tests/workshop_configuration/test_entity_logo_api.py tests/api/test_openapi.py` y `cd frontend && npx vitest run src/shared/api/entity-logos.test.tsx`.

Evidencia del grupo: nombre comercial y reserva a razón social probados, compatibilidad de `legal_name` conservada y solo el **RUC comercial** consumido por el flujo nuevo.

## 4. Codificador Code 128

Dependencias: grupo 1. Diseño D7; spec `impresion-de-etiquetas-de-productos`, «Generación verificable del código de barras».

- [x] 4.1 Crear `frontend/src/features/product-labels/code128.test.ts` con pruebas inicialmente rojas para el vector `ABC → 104,33,34,35,1,106`, el código `FIL-00125`, inicio B/C, cambios B↔C, corridas numéricas pares e impares, checksum módulo 103 y determinismo.
- [x] 4.2 Añadir pruebas rojas para la tabla de patrones, zonas silenciosas de diez módulos, dimensiones y barras enteras del SVG, nombre accesible y rechazo tipado de caracteres fuera de U+0020–U+007E sin sustitución ni transliteración.
- [x] 4.3 Implementar `frontend/src/features/product-labels/code128.ts` con la tabla de 107 patrones, juegos B/C y programación dinámica con desempate estable. Hacer pasar 4.1–4.2 sin añadir dependencias ni modificar `package.json` o `package-lock.json`.
- [x] 4.4 Refactorizar separando codificación, checksum y geometría SVG; verificar con `cd frontend && npx vitest run src/features/product-labels/code128.test.ts`, typecheck focalizado mediante `npm run typecheck` y ESLint/Prettier sobre los archivos del codificador.

Evidencia del grupo: vectores conocidos, optimización B/C, checksum, zonas silenciosas, accesibilidad y rechazo fiel del **código interno** en verde.

## 5. Distribución A4 y paginación

Dependencias: grupo 1. Diseño D5 y D6; requirements de tamaño, copias y posición inicial.

- [x] 5.1 Crear `frontend/src/features/product-labels/label-layout.test.ts` con pruebas rojas: A4 de 210 × 297 mm; 63 × 38 mm produce 3 × 7 y 21 posiciones; cuadrícula centrada; dimensiones decimales; cero, negativo, no finito y tamaños que no caben.
- [x] 5.2 Añadir pruebas rojas para orden y agrupación de copias, primera posición 1 y 8, celdas vacías solo en la primera página, segunda página desde la posición 1, reinicio de una posición inexistente y totales de páginas.
- [x] 5.3 Implementar tipos, `calculateLabelGrid` y `buildLabelPages` en `frontend/src/features/product-labels/label-layout.ts`, manteniendo el cálculo puro y las celdas vacías explícitas. Hacer pasar 5.1–5.2.
- [x] 5.4 Añadir y probar la validación de composición esencial para impedir que el nombre comercial, el código destacado o el **Code 128** desborden un tamaño demasiado pequeño; no deformar ni escalar la dimensión exterior.
- [x] 5.5 Refactorizar y verificar con `cd frontend && npx vitest run src/features/product-labels/label-layout.test.ts`, `npm run typecheck` y ESLint/Prettier sobre los archivos tocados.

Evidencia del grupo: cálculos puros y casos límite en verde, medidas físicas exactas y posición inicial reproducible.

## 6. Etiqueta, hoja y modal de preparación

Dependencias: grupos 3 a 5. Diseño D4, D6 y D8; capability `impresion-de-etiquetas-de-productos` y PPF-10.

- [x] 6.1 Crear primero `ProductLabel.test.tsx` y `ProductLabelSheet.test.tsx` con casos rojos para identidad comercial con y sin logotipo, código destacado, nombre limitado a dos líneas, número de parte y marca opcionales sin huecos, ausencia de precio y SVG accesible.
- [x] 6.2 Implementar `ProductLabel.tsx` y `ProductLabelSheet.tsx` con la misma estructura de celdas en vista previa e impresión, líneas de corte compartidas y manejo del error de imagen que compacte el encabezado.
- [x] 6.3 Crear primero `ProductLabelPrintModal.test.tsx` con casos rojos para una copia inicial, cantidades individuales, «Aplicar a todos», cantidades inválidas, total, dimensiones, selector visual de posición, navegación «Página n de m» y anuncio del reinicio de posición.
- [x] 6.4 Ampliar las pruebas rojas del modal para carga y reintento del lote, espera de marca, timeout de imagen con reserva al nombre, resumen de productos incompatibles, bloqueo por composición y conservación completa del estado tras `window.print()` o cancelación.
- [x] 6.5 Implementar `ProductLabelPrintModal.tsx` sobre `Modal size="media" mobileFullWidth`, con controles Tallkit, foco contenido, retorno de foco, errores en línea y disposición apilada desde 360 px. No usar `FormModal` ni toast al abrir impresión.
- [x] 6.6 Crear `product-label-print.css`: `@page` A4 vertical sin margen, hojas de 210 × 297 mm, cuadrícula en milímetros, colores y saltos; ocultar navegación, controles y modal durante impresión y mostrar solo la superficie de etiquetas.
- [x] 6.7 Implementar la preparación de impresión: esperar identidad, imagen y `document.fonts.ready` cuando exista, renderizar todas las páginas, invocar `window.print()` y conservar el modal. Mostrar la advertencia «Escala 100 %» y «Sin encabezados ni pies».
- [x] 6.8 Verificar el grupo con `cd frontend && npx vitest run src/features/product-labels`, `npm run typecheck` y ESLint/Prettier sobre `src/features/product-labels`; registrar explícitamente que no se ejecutó Vitest completo.

Evidencia del grupo: contenido obligatorio y opcional, marca, validaciones, teclado, adaptación, vista previa e impresión aislada cubiertos por pruebas focalizadas.

## 7. Lista y ficha de productos

Dependencias: grupos 2 y 6. Diseño D3; requirements de selección y PPF-10.

- [x] 7.1 Ampliar primero `frontend/src/shared/ui/layout.test.tsx` con casos rojos que exijan a `ElevatedDataList` pasar `selectedKeys`, `onSelectRow` y `onSelectAll` a escritorio y teléfono sin cambiar tablas que no usan selección.
- [x] 7.2 Extender el contrato de `ElevatedDataList` y hacer pasar 7.1 reutilizando las casillas, estado indeterminado y nombres accesibles de `DataTable`.
- [x] 7.3 Ampliar primero `ProductsPage.test.tsx` con casos rojos para orden manual en varias páginas, seleccionar/deseleccionar la página visible, contador, acción deshabilitada sin selección y conservación al paginar.
- [x] 7.4 Añadir pruebas rojas de cambio de búsqueda o filtro con `ConfirmationPanel`: confirmar limpia y aplica; cancelar conserva selección y filtro. Probar que cambiar solo de página no pregunta ni limpia.
- [x] 7.5 Añadir pruebas rojas de «Todos los del filtro actual»: envía exactamente los cinco filtros vigentes, ignora la selección manual, conserva el orden del servidor, maneja cero resultados y error reintentable sin perder opciones.
- [x] 7.6 Implementar en la API frontend el tipo `ProductLabelData` y `getProductLabelData`, y en `ProductsPage` el `Map` ordenado, la barra de acciones, confirmación de filtros y apertura del modal para selección o filtro completo.
- [x] 7.7 Ampliar primero `ProductDetailPage.test.tsx` para exigir «Imprimir etiquetas» con `productos.ver`, tanto activo como inactivo e independiente de permisos de gestión; implementar la acción con el producto cargado y retorno de foco.
- [x] 7.8 Verificar el grupo con `cd frontend && npx vitest run src/shared/ui/layout.test.tsx src/pages/products/ProductsPage.test.tsx src/pages/products/ProductDetailPage.test.tsx` más las pruebas focalizadas del cliente API, `npm run typecheck` y ESLint/Prettier sobre los archivos tocados.

Evidencia del grupo: selección ordenada entre páginas, filtros seguros, lote completo y ficha probados para el permiso de consulta.

## 8. Revisión aprobada de formato y composición

Dependencias: grupos 2 a 7 y confirmación visual del usuario. Revisión de propuesta, specs y diseño para el tamaño fijo 100 × 55 mm, descripción, presentación, composición sin imagen de producto y asset fijo de camión.

- [x] 8.1 Actualizar propuesta, specs, diseño, tareas y referencias de glosario antes de modificar código; registrar que la imagen dinámica del producto permanece fuera de alcance.
- [x] 8.2 Ampliar primero `backend/tests/catalog/test_product_label_data_api.py` y OpenAPI para exigir descripción, cantidad de contenido y unidad de medida en la proyección, conservando la exclusión de precio, costo y existencia; implementar serializer/consulta mínima y verificar sin N+1.
- [x] 8.3 Ampliar primero las pruebas del cliente y de lista/ficha para transportar descripción, cantidad y unidad en `ProductLabelData`; implementar adaptadores sin consultas nuevas ni cambios de modelo.
- [x] 8.4 Cambiar primero las pruebas puras de distribución para exigir que 100 × 55 mm produzca 2 × 5 y 10 posiciones centradas; actualizar constantes, escenarios de posición y validación de composición proporcional con umbral del 80 %.
- [x] 8.5 Ampliar primero `ProductLabel.test.tsx` para logo sin nombre duplicado, reserva textual, nombre y descripción a dos líneas, presentación, franja técnica, Code 128, zona futura vacía y cabecera decorativa. Replicar la composición de la etiqueta de referencia con el logotipo comercial configurado, incorporar el asset original fijo con bandas diagonales SVG y escalar el contenido en proporción a la celda sin añadir dependencias.
- [x] 8.6 Cubrir e implementar lista de cantidades con desplazamiento propio, pie fijo y visor centrado con zoom progresivo de 30 % a 130 %, porcentaje visible y ajuste de hoja exclusivamente visual.
- [x] 8.7 Verificar el grupo con pytest focalizado de catálogo/OpenAPI; Vitest de `product-labels`, API, lista y ficha; typecheck; Ruff/mypy y ESLint/Prettier solo sobre archivos tocados.
- [x] 8.8 Actualizar propuesta, specs, diseño y tareas por la decisión del cliente: sin imagen del producto ni zona reservada, y un único tamaño fijo de 100 × 55 mm sin selector ni medidas editables.
- [x] 8.9 Cambiar primero `label-layout.test.ts` para exigir `LABEL_WIDTH_MM = 100`, `LABEL_HEIGHT_MM = 55` y cuadrícula centrada 2 × 5; retirar la validación de composición proporcional y los tamaños alternativos.
- [x] 8.10 Cambiar primero `ProductLabel.test.tsx` y `ProductLabelSheet.test.tsx` para exigir la ficha técnica vertical en la columna derecha, el Code 128 ancho en el pie, la ausencia de zona de imagen y la omisión de datos ausentes; rediseñar la composición sin añadir colores.
- [x] 8.11 Cambiar primero `ProductLabelPrintModal.test.tsx` para exigir el tamaño fijo informativo, sin selector ni campos de ancho y alto; retirar el reinicio de posición por cambio de tamaño.
- [x] 8.12 Ajustar `e2e/product-labels.spec.ts` al tamaño fijo y verificar el grupo con Vitest de `product-labels`, typecheck, ESLint/Prettier sobre archivos tocados y solo ese archivo E2E; inspeccionar un PDF A4.
- [x] 8.13 Cubrir primero con pruebas e implementar el rediseño interactivo del modal: pasos numerados, botones «−»/«+» por producto, resaltado en la vista previa, hoja A4 en miniatura con estados de posición, «Ajustar ancho» y «Ver hoja completa», miniaturas de página, resumen en el pie y modal casi a pantalla completa; ajustar el E2E y verificar solo `e2e/product-labels.spec.ts`.

Evidencia del grupo: contrato revisado antes del código, tamaño fijo 100 × 55 exacto, composición sin imagen de producto, asset original y transporte mínimo de los datos ya existentes.

## 9. Recorrido E2E y verificación visual focalizada

Dependencias: grupos 2 a 8. Specs `impresion-de-etiquetas-de-productos`, `catalogo-de-productos-y-categorias`, PPF-10 y `experiencia-adaptable-frontend`.

- [x] 9.1 Crear `frontend/e2e/product-labels.spec.ts` con recorridos para selección manual en dos páginas, «Todos los del filtro actual», ficha de producto inactivo, cantidades distintas, tamaño predeterminado, inicio en posición 4 y regreso desde impresión con el estado conservado.
- [x] 9.2 Añadir al mismo archivo los tres roles con `productos.ver`, denegación directa sin permiso, identidad comercial con y sin logotipo, código no representable y ausencia de precio en DOM y superficie impresa.
- [x] 9.3 Verificar en 360, 768, 1024, 1280 y 1440 px: sin desplazamiento horizontal de página, foco contenido, controles accesibles, vista previa navegable, zoom progresivo y `axe` sin infracciones nuevas. Ejecutar solo `cd frontend && npx playwright test e2e/product-labels.spec.ts`.
- [x] 9.4 Guardar como PDF en Chrome/Chromium y Firefox una hoja de etiquetas, comprobar A4, cuadrícula 2 × 5, medidas de 100 × 55 mm, líneas de corte, páginas posteriores desde posición 1, asset fijo y ausencia de interfaz. Si hay impresora disponible, registrar una prueba física al 100 %; su ausencia no bloquea la verificación por PDF.

Estado de 9.4 (2026-09-27): PDFs verificados en Chromium y Firefox 155 sobre la aplicación real (dos páginas A4, 2 × 5, 100 × 55 mm, inicio en posición 4 y segunda hoja desde la 1, líneas de corte, asset fijo y sin interfaz). La revisión en Firefox detectó y corrigió la repetición incompleta del logotipo; la regresión espera todas las instancias y usa referencias SVG únicas. No había impresora física disponible, condición no bloqueante prevista por la tarea.

Evidencia del grupo: único archivo E2E ejecutado, cinco anchos y accesibilidad registrados, PDF inspeccionado y limitación física documentada.

## 10. Documentación, trazabilidad y cierre

Dependencias: grupos 2 a 9.

- [x] 10.1 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md` con selección, acción desde ficha y PPF-10; actualizar su archivo de referencia terminológica.
- [x] 10.2 Actualizar `docs/negocio/requisitos/casos-de-uso.md` para el flujo de impresión desde lista y ficha, y `matriz-trazabilidad.md` con cada requirement, tarea y prueba real.
- [x] 10.3 Completar `docs/negocio/requisitos/cobertura-catalogos.md` con comandos, conteos y resultados reales; conservar explícito que imprimir no altera inventario, catálogo ni auditoría.
- [x] 10.4 Revisar `docs/negocio/producto/glosario.md`, `docs/tecnico/glosario-tecnico.md` y todos los companion glossary references; no añadir sinónimos para **Producto**, **etiqueta de producto**, **RUC comercial**, **logotipo de entidad fiscal**, **Code 128**, **API REST** o **contrato OpenAPI**.
- [x] 10.5 Confirmar que no existen migraciones, cambios de modelos, nuevas dependencias ni modificaciones de lockfiles; confirmar también que no se creó ADR, conforme a D11.
- [x] 10.6 Ejecutar la verificación final focalizada: pruebas backend de los grupos 2–3 y 8, Vitest de los grupos 3–8 y solo `e2e/product-labels.spec.ts`; Ruff/mypy sobre paquetes tocados; Prettier y ESLint solo sobre archivos tocados; `npm run typecheck`, `npm run build`, `manage.py check`, `makemigrations --check --dry-run`, `spectacular --validate` y `openspec validate imprimir-etiquetas-de-productos --strict`.
- [x] 10.7 Registrar cada comando y resultado, junto con lo no ejecutado por alcance: suites completas, resto de Playwright, `make check` y `make test`. Solicitar validación directa del usuario de la vista previa y del PDF antes de verificar o archivar el cambio.

Evidencia del grupo: documentación y trazabilidad sincronizadas, verificación focalizada reciente y validación visual solicitada al usuario.
