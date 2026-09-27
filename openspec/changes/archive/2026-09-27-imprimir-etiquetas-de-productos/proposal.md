## Why

El personal localiza repuestos físicos mirando envases, estantes y piezas que hoy no llevan una identificación uniforme del sistema. Este cambio permite imprimir **etiquetas de producto** con el **código interno** visible y escaneable, usando la identidad del **RUC comercial**, sin incluir precios que quedarían obsoletos.

El catálogo, la hoja imprimible Tallkit y el logotipo comercial ya están disponibles; por eso puede incorporarse ahora como una capacidad principalmente de presentación, sin alterar inventario ni el modelo de datos.

## What Changes

- La lista de productos permitirá seleccionar varios registros o elegir «Todos los del filtro actual» y abrir «Imprimir etiquetas»; la ficha ofrecerá la misma acción para su producto.
- Un modal de preparación permitirá definir copias por producto, aplicar una cantidad a todos, seleccionar la posición inicial de la primera hoja y revisar una vista previa paginada.
- La hoja A4 usará un único tamaño fijo de 100 × 55 mm en cuadrícula de 2 × 5, con líneas de corte finas. El tamaño no es configurable.
- Cada etiqueta usará el logotipo vigente del **RUC comercial** como cabecera sin duplicar el nombre que ya forma parte de esa imagen; si no existe o no carga, mostrará como reserva el nombre comercial o la razón social. También incluirá el código interno destacado en tipografía de máximo peso con cifras tabulares, el nombre del producto en un máximo de dos líneas, una descripción secundaria, el número de parte opcional, la marca, la presentación y un código de barras **Code 128** del código interno.
- La composición visual seguirá una plantilla azul oscuro, gris azulado y naranja: cabecera con el logotipo comercial y un recurso gráfico fijo y original de un camión, bloque de código, zona de texto, código de barras integrado y franja técnica inferior. La etiqueta no incluye fotografías del producto ni reserva espacio para ellas.
- La etiqueta no mostrará precio, existencia, costo, impuesto, estado ni información de la entidad artesanal.
- La impresión se realizará con el diálogo del navegador sobre una vista específica y CSS de impresión A4, reutilizando el comportamiento de preparación de marca de la hoja `DocumentSheet`; también permitirá guardar como PDF desde el navegador.
- Los tres roles que poseen `productos.ver` podrán preparar e imprimir etiquetas. No se introduce un permiso nuevo ni una escritura de negocio.
- «Todos los del filtro actual» se resolverá mediante una lectura específica que aplica exactamente la búsqueda y los filtros vigentes y devuelve la proyección mínima necesaria, sin paginar el resultado entre varias solicitudes.
- El código de barras se generará localmente como SVG mediante un codificador propio y probado; no se añade una dependencia.

### Decisiones y recomendaciones

- **D1 — Ámbito comercial.** La etiqueta identifica un producto del catálogo comercial y siempre usa la identidad de la entidad comercial; nunca la artesanal.
- **D2 — Primera hoja reutilizable.** La posición inicial deja vacías las posiciones anteriores solo en la primera hoja. Las hojas siguientes empiezan en la primera posición.
- **D3 — Tamaño único.** Por decisión del cliente, la etiqueta se imprime solo en 100 × 55 mm (2 × 5 por hoja A4), sin selector ni medidas editables. Ese tamaño conserva la proporción de la etiqueta de referencia y aprovecha diez posiciones por hoja. Otros tamaños quedan para un cambio posterior si se necesitan.
- **D4 — Plantilla visual sin fotografía.** El camión de cabecera es un asset fijo de la aplicación. El cliente descartó fotografiar o buscar imágenes de productos, así que la etiqueta no incluye imagen del producto ni reserva espacio para ella: ese espacio se destina al código de barras y a los datos.
- **R1 — Lectura única del filtro.** Se recomienda un endpoint de proyección para etiquetas en lugar de recorrer páginas desde el navegador. Produce un conjunto coherente con una consulta, reutiliza los filtros aprobados y evita duplicados u omisiones si el catálogo cambia durante varias solicitudes.
- **R2 — Generador propio.** Se recomienda implementar Code 128 en SVG dentro del frontend porque el uso está acotado, elimina una dependencia y permite probar patrones, suma de control y texto codificado. El diseño concretará los juegos de caracteres y el manejo de códigos no representables sin cambiar silenciosamente el catálogo.

No quedan decisiones de negocio abiertas que bloqueen las specs. La elección del endpoint y del generador se concreta en el diseño solicitado por el usuario.

## Capabilities

### New Capabilities

- `impresion-de-etiquetas-de-productos`: preparación, composición, vista previa e impresión A4 de etiquetas, contenido de cada etiqueta, copias, tamaño fijo, posición inicial, identidad comercial y código de barras.

### Modified Capabilities

- `catalogo-de-productos-y-categorias`: selección múltiple en la lista, alcance «Todos los del filtro actual», acción desde la ficha y lectura autorizada de la proyección de productos para etiquetas.
- `patrones-de-pantalla-frontend`: incorpora el patrón especializado de preparación e impresión de una hoja de etiquetas, distinto de un formulario CRUD y de un documento económico.

## Impact

- **Usuarios afectados:** Administrador, Vendedor y Encargado del taller, todos mediante `productos.ver`; los permisos de edición del catálogo no cambian.
- **Datos:** no hay modelos, tablas, migraciones, estados ni auditoría nueva; imprimir es una consulta sin efectos de negocio.
- **Backend y API:** el módulo `catalog` añade una consulta de solo lectura, con los mismos filtros de productos, que entrega identificador, código interno, nombre, descripción, número de parte, marca, cantidad de contenido y unidad de medida. El resumen autenticado de la entidad comercial expone el nombre visible (nombre comercial con reserva a razón social). El contrato OpenAPI se actualiza.
- **Frontend:** lista y ficha de productos; modal de preparación; hoja A4; SVG Code 128; integración con la identidad comercial y el diálogo de impresión del navegador.
- **Dependencias:** depende funcionalmente de `logotipos-por-ruc`; sin logo se imprime solo el nombre. No se añade ninguna dependencia de runtime.
- **Operación:** requiere impresora o destino PDF configurado en el navegador. El usuario debe imprimir al 100 %, sin encabezados ni pies del navegador; la vista advertirá si la configuración puede alterar medidas.
- **Riesgos:** diferencias de margen entre impresoras, hojas cargadas con una orientación equivocada, lotes grandes que consuman memoria, códigos internos no representables por el subconjunto de Code 128 elegido y logotipos que aún no hayan cargado al abrir impresión.
- **Trazabilidad:** DP-009; CT-001; RN-CAT-001/003/011; RN-SEG-001/007; RF-CAT-001/004; CU-006; UI-030/031; RNF-REN-005; RNF-USA-001/004/006/007/008/009/011/012; RNF-COM-001/005; specs `catalogo-de-productos-y-categorias`, `patrones-de-pantalla-frontend`, `sistema-visual-frontend`, `experiencia-adaptable-frontend` y cambio `logotipos-por-ruc`.

## Fuera de alcance

- Escanear códigos de barras, buscar productos mediante lector o registrar movimientos a partir del escaneo.
- Impresoras térmicas, lenguajes ZPL/EPL, etiquetas continuas o aplicaciones nativas de impresión.
- Guardar plantillas, tamaños, cantidades, posiciones o trabajos de impresión como preferencias persistentes.
- Cargar, guardar o mostrar imágenes del producto en la etiqueta.
- Ofrecer varios tamaños de etiqueta o medidas libres o personalizadas.
- Incluir precios, existencias, costos, impuestos, ubicaciones, QR u otros datos en la etiqueta.
- Modificar las reglas o el formato del código interno, importar códigos externos o generar códigos internos nuevos.
- Registrar auditoría de impresiones o descontar existencias por imprimir.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`.
- Producto: `vision.md`, `alcance-v1.md`, `reglas-negocio.md` y `glosario.md`.
- Requisitos: `actores-y-roles.md`, `requisitos-funcionales.md`, `requisitos-no-funcionales.md`, `casos-de-uso.md`, `interfaz-y-navegacion.md`, `cobertura-catalogos.md` y `matriz-trazabilidad.md`.
- Specs principales: `catalogo-de-productos-y-categorias`, `patrones-de-pantalla-frontend`, `sistema-visual-frontend` y `experiencia-adaptable-frontend`.
- Cambio archivado `logotipos-por-ruc`: propuesta, specs y diseño; ADR-0007.
- Arquitectura: `arquitectura-inicial.md`, C4 de contexto y contenedores, ADR-0001, ADR-0002 y ADR-0003.
- Código actual, solo como evidencia: consultas y API de `catalog`; `ProductsPage`, `ProductDetailPage`, `DocumentSheet`, `useSheetBrandReady` y `useIssuerBrand`.

**Contradicciones:** ninguna entre las fuentes normativas. La interfaz vigente no tiene selección múltiple ni impresión de etiquetas; es una brecha que este cambio cubre. El resumen de logotipos expone hoy la razón social, pero no el nombre comercial requerido por la etiqueta.

**Información insuficiente no bloqueante:** las tolerancias físicas reales dependen de cada impresora. La capacidad fija dimensiones CSS y deja al diálogo del navegador la selección del dispositivo, escala y márgenes.

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
