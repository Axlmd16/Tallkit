## Context

La propuesta y las specs de este cambio incorporan una **etiqueta de producto** imprimible sin persistencia ni efectos de negocio. Debe poder prepararse desde una selección manual, desde todos los resultados del filtro vigente o desde una ficha, y usar la identidad del **RUC comercial** definida por `logotipos-por-ruc`.

Estado actual, verificado en el código:

- `catalog.application.queries.list_products` concentra los filtros de búsqueda, estado, categoría, marca de producto y marca de vehículo; ordena por nombre normalizado e identificador, pero la API ordinaria pagina con un máximo de 100 elementos.
- `ProductsPage` conserva búsqueda, filtros y página en la URL. `ProductDetailPage` ya conoce todos los datos necesarios para una etiqueta. `DataTable` admite selección accesible en escritorio y teléfono, pero `ElevatedDataList` todavía no expone esas propiedades.
- `Product.code` admite hasta 64 caracteres, se normaliza a mayúsculas y no limita el alfabeto a ASCII. Por tanto, existen códigos válidos de catálogo que un subconjunto de Code 128 podría no representar.
- `entity-logos/` entrega la razón social y el logotipo por tipo de entidad. Aún no expone el nombre visible comercial, aunque `FiscalEntity` sí posee `trade_name`.
- `DocumentSheet`, `useSheetBrandReady` y el CSS de impresión resuelven hojas económicas y la espera del logotipo. Una hoja de etiquetas no es un documento económico y necesita su propia composición.
- `Modal` admite tamaños `large` y `media`, foco contenido, retorno de foco y adaptación a pantalla estrecha. `FormModal` agrega semántica de guardado que no corresponde a una impresión sin escritura.

Restricciones: monolito modular (ADR-0001), REST con OpenAPI (ADR-0002), sesión y mismo origen (ADR-0003), sin cambios de modelo de datos y sin dependencias nuevas. Solo se ejecutarán pruebas focalizadas durante la aplicación.

## Goals / Non-Goals

**Goals:**

- Obtener exactamente una vez todos los productos de un filtro sin recorrer la paginación ordinaria.
- Conservar el orden de una selección manual y mantener juntas las copias de cada producto.
- Componer páginas A4 con dimensiones físicas, primera posición configurable y vista previa paginada.
- Generar Code 128 verificable como SVG con código propio y bloquear, de forma explícita, códigos no representables.
- Imprimir solo las hojas de etiquetas después de resolver la identidad comercial y el logotipo.
- Mantener el flujo conforme a Tallkit y disponible con `productos.ver`.

**Non-Goals:**

- Persistir trabajos, preferencias, plantillas o auditoría de impresión.
- Cambiar el código interno, el catálogo, el inventario o las reglas de permisos.
- Reutilizar `DocumentSheet`, añadir una biblioteca de códigos de barras o soportar impresoras térmicas.
- Garantizar las tolerancias mecánicas de todas las impresoras; la aplicación fija las medidas CSS y comunica la configuración requerida del navegador.

## Decisions

### D1 — Proyección específica no paginada para «Todos los del filtro actual»

Se añade `GET /api/v1/products/label-data/`, declarada antes de la ruta `products/<int:pk>/`. Usa `HasBusinessPermission("productos.ver")`, acepta exactamente `search`, `is_active`, `category_id`, `product_brand_id` y `vehicle_brand_id` —los nombres vigentes del listado—, y responde:

```json
{
  "count": 2,
  "results": [
    {
      "id": 41,
      "code": "FIL-00125",
      "name": "Filtro de aceite",
      "description": "Para motores diésel de trabajo pesado",
      "manufacturer_code": "OC-90",
      "product_brand": { "id": 7, "name": "Mahle" },
      "content_quantity": "1.000000",
      "unit": { "id": 3, "name": "Unidad" }
    }
  ]
}
```

`catalog.application.queries` extrae de `list_products` un constructor interno de `QuerySet` filtrado y ordenado. Tanto el listado como `list_product_label_data` lo usan, para impedir que los filtros diverjan. La proyección selecciona solo los campos indicados, usa `select_related` para la marca y conserva el orden estable `Lower(name), id`. No acepta `page`, `page_size` ni criterios propios.

La respuesta no se pagina porque esta ruta representa un lote de impresión/exportación, no una pantalla navegable. Una petición produce una sola operación lógica y una sola evaluación ordenada del conjunto. No hay bloqueo de edición, transacción de escritura, clave de idempotencia ni auditoría.

- **Alternativa descartada:** pedir sucesivamente todas las páginas del listado. Entre peticiones podrían cambiar el total y el orden, generando omisiones o duplicados; además eleva la latencia y acopla la preparación al tamaño de página.
- **Selección manual y ficha:** no llaman esta ruta. La lista guarda una instantánea mínima de cada fila seleccionada, y la ficha adapta su producto ya cargado. Esto conserva el orden de selección, evita URLs extensas con identificadores y no repite lecturas.

El contrato se incorpora a `backend/schema.yml` mediante `drf-spectacular`, incluidos los errores de filtros existentes.

### D2 — Nombre visible calculado en el resumen de identidad

El resumen autenticado `entity-logos/` añade `display_name` a cada entidad. El backend lo calcula como `trade_name.strip()` cuando no está vacío y, en caso contrario, como `legal_name`. `legal_name` se conserva para compatibilidad con los comprobantes existentes.

`frontend/src/shared/api/entity-logos.ts` añade `display_name` al contrato y `useIssuerBrand` expone `displayName`. El flujo de etiquetas solicita únicamente `COMERCIAL`; nunca infiere el nombre ni combina datos de la entidad artesanal.

- **Por qué en el backend:** la reserva de nombre comercial a razón social es una regla común de identidad. Entregar el valor resuelto evita duplicarla en cada consumidor.
- **Alternativa descartada:** consultar el detalle de configuración desde el modal. Expondría más datos, requeriría permiso de administración y cruzaría una frontera ya resuelta por el resumen de logotipos.

### D3 — Selección ordenada y explícita en la lista

`ElevatedDataList` amplía su contrato, sin cambiar el comportamiento por omisión, para pasar a `DataTable` `selectedKeys`, `onSelectRow` y `onSelectAll`. Así se reutilizan las casillas, el estado indeterminado y la representación móvil existentes.

`ProductsPage` mantiene un `Map<number, ProductLabelData>` cuyo orden de inserción es el orden manual del lote. Seleccionar una fila guarda su proyección mínima; deseleccionarla la elimina. «Seleccionar todas» actúa sobre la página visible, mientras «Todos los del filtro actual» es una acción separada que carga D1. Cambiar de página no altera el mapa.

Antes de aplicar una búsqueda o filtro distinto, si el mapa no está vacío, un `ConfirmationPanel` avisa que la selección se limpiará. Al confirmar, se vacía el mapa y se aplica el filtro; al cancelar, los controles vuelven a los valores vigentes. La paginación no cuenta como cambio de filtro.

La barra de acciones muestra el número seleccionado y habilita «Imprimir etiquetas» solo con elementos. «Todos los del filtro actual» queda disponible aunque no haya selección manual y reemplaza el lote del modal con la respuesta completa de D1. `ProductDetailPage` abre el mismo modal con un único elemento, activo o inactivo. Ninguna acción depende de permisos de crear, editar o desactivar.

### D4 — Modal especializado, no formulario CRUD

Se crea `frontend/src/features/product-labels/` con:

- `ProductLabelPrintModal.tsx`: coordinación de carga, opciones, validación, foco y acciones;
- `ProductLabelSheet.tsx` y `ProductLabel.tsx`: composición de hoja y etiqueta;
- `label-layout.ts`: cálculo puro de cuadrícula, posiciones y páginas;
- `code128.ts`: codificación y SVG;
- `product-label-print.css`: reglas físicas y aislamiento de impresión;
- tipos y pruebas colocados junto a cada pieza.

El modal usa `Modal size="media" mobileFullWidth`, no `FormModal`: «Imprimir» no guarda datos y debe mantener el estado después de volver del diálogo. En escritorio dispone controles y vista previa en dos zonas; por debajo del ancho disponible se apilan. La lista de cantidades tiene altura acotada y desplazamiento propio para que un lote numeroso no empuje la configuración. El pie con «Cancelar» e «Imprimir» permanece fijo. La página previa se centra en un lienzo distinguible y ofrece reducir/aumentar en pasos de 10 %, desde 30 % hasta 130 %, un porcentaje accesible y «Ajustar hoja» para volver a 50 %. La transformación es exclusivamente visual y los controles conservan alturas, esquinas, colores semánticos y estados Tallkit.

Cada producto empieza con una copia. Las cantidades viven en un mapa por identificador; «Aplicar a todos» solo se ejecuta con un entero positivo. Los errores aparecen junto al control correspondiente y un resumen accesible anuncia impedimentos generales. La vista previa usa botones anterior/siguiente y anuncia «Página n de m».

### D5 — Cálculo físico de cuadrícula y paginación

Las constantes son `PAGE_WIDTH_MM = 210` y `PAGE_HEIGHT_MM = 297`. El tamaño inicial es 100 × 60 mm. Para cualquier tamaño válido:

```text
columnas = floor(210 / ancho)
filas    = floor(297 / alto)
capacidad = columnas × filas
```

La cuadrícula se centra en la página completa; el margen sobrante se distribuye por igual a ambos lados. Con 100 × 60 mm resultan 2 columnas, 4 filas y 8 posiciones, con márgenes naturales de 5 mm a los lados y 28,5 mm arriba y abajo. No se resta un margen oculto al tamaño útil: una dimensión que cabe en A4 produce al menos una posición. No hay separación entre celdas: cada borde de 0,2 mm es una línea de corte y se evita duplicarlo entre celdas contiguas.

Las dimensiones aceptan decimales positivos en milímetros. Son inválidas cuando no son finitas, no son positivas o producen cero filas o columnas. Al cambiar la capacidad, la posición inicial se limita a `1..capacidad`; si deja de existir, vuelve a 1 y se anuncia mediante estado accesible.

`buildLabelPages` consume descriptores `{product, copyIndex}` en orden, deja vacías `startPosition - 1` celdas de la primera página y usa capacidad completa desde la segunda. Las celdas vacías se representan para que la vista previa y la impresión compartan la misma estructura. El cálculo es puro y no materializa imágenes ni SVG hasta renderizar la página correspondiente en pantalla; la superficie de impresión sí renderiza todas las páginas requeridas.

- **Alternativa descartada:** usar `grid-template-columns: repeat(auto-fit, ...)`. El navegador podría elegir una cuadrícula distinta entre vista e impresión y dificultaría validar la posición inicial.

### D6 — Plantilla profesional dentro de medidas rígidas

La celda predeterminada de 100 × 60 mm reproduce la jerarquía de la referencia aprobada sin copiar marcas ni fotografías de terceros:

1. cabecera izquierda con el logotipo comercial mediante `object-fit: contain`; cuando existe no se duplica `displayName`, y cuando falta o falla se muestra ese nombre como reserva;
2. esquina superior derecha con `product-label-truck-background.png`, un asset original fijo, desaturado en azul y recortado mediante `clip-path`, más diagonales naranjas construidas en CSS;
3. bloque de código interno monoespaciado como texto de mayor jerarquía;
4. nombre limitado a dos líneas y descripción secundaria gris azulada limitada a dos líneas;
5. zona derecha deliberadamente blanca, sin marco ni marcador, reservada para una imagen dinámica que no forma parte de este cambio;
6. franja técnica inferior con código del fabricante, marca, presentación y Code 128. La presentación concatena la cantidad normalizada y el nombre de la unidad recibidos del catálogo; no interpreta texto libre.

Los separadores, iconos geométricos y acentos se dibujan con CSS/SVG para conservar nitidez. El fondo permanece mayoritariamente blanco; azul oscuro, gris azulado y naranja se usan como jerarquía, no como masas de tinta. Número de parte y marca solo se renderizan cuando existen. La dimensión exterior nunca crece.

Para tamaños alternativos, la composición conserva las zonas y reduce espacios dentro de límites legibles, pero no escala la dimensión exterior. Si el contenido esencial no cabe en el tamaño elegido, la validación bloquea la impresión y pide aumentar la etiqueta, en vez de desbordar u ocultar código y barras. El precio y cualquier dato no incluido en `ProductLabelData` no llegan a la pieza.

### D7 — Codificador propio Code 128 con juegos B y C

`code128.ts` implementa la tabla oficial de 107 patrones, los juegos B y C, cambios de juego, suma de control módulo 103 y parada. El alfabeto aceptado es ASCII imprimible U+0020–U+007E. Un algoritmo de programación dinámica evalúa en cada posición continuar o cambiar entre B y C y elige la secuencia con menos símbolos, contando inicio y cambios de juego. Los empates se resuelven de forma estable: una corrida numérica impar conserva su primer dígito en B y codifica en C el tramo par restante; para elegir el juego inicial se prefiere B. Así aprovecha también la parte par de una corrida numérica impar y produce siempre el mismo símbolo. Nunca modifica el texto de entrada.

La secuencia es:

```text
inicio + símbolos de datos/cambio + checksum + stop
checksum = (inicio + Σ(valor_i × posición_i)) mod 103
```

El SVG añade diez módulos silenciosos a cada lado, usa coordenadas enteras, `viewBox` y `shape-rendering="crispEdges"`, y agrupa barras contiguas en rectángulos. Recibe un nombre accesible «Código de barras de {código}»; el texto legible sigue siendo el código interno separado del SVG.

Un carácter fuera del alfabeto produce un error tipado con el índice y el carácter. El modal agrega todos los productos incompatibles, los identifica por nombre y código y bloquea «Imprimir». No translitera ni cambia el catálogo.

- **Alternativa descartada:** dependencia de terceros. El alcance solo requiere B/C, la implementación es pequeña y determinista, y `AGENTS.md` impide añadir dependencias sin un uso documentado que aquí no resulta necesario.
- **Alternativa descartada:** restringir ahora `Product.code`. Invalidaría datos admitidos por la capacidad aprobada y amplía el cambio a reglas de catálogo.

### D8 — Marca preparada e impresión aislada

El modal consulta `useIssuerBrand("COMERCIAL")` al abrirse. Reutiliza la disciplina de `useSheetBrandReady`: «Imprimir» espera a que el resumen termine y a que el logotipo cargue o falle. Tras un máximo de 5 segundos, la composición degrada a `displayName` como reserva; cuando el logotipo carga, la cabecera usa solo esa imagen porque el archivo configurado ya integra símbolo y nombre. Un fallo del resumen, a diferencia del fallo de imagen, permanece reintentable y bloquea porque tampoco habría una identidad confiable.

La aplicación mantiene una superficie de impresión hermana del modal, oculta en pantalla. Al activar «Imprimir»:

1. valida cantidades, tamaño, composición, códigos y marca;
2. fija el documento de impresión con todas las páginas;
3. espera un ciclo de renderizado y fuentes (`document.fonts.ready` cuando exista);
4. llama `window.print()` sin cerrar el modal.

`product-label-print.css` usa `@page { size: A4 portrait; margin: 0; }`, hojas de `210mm × 297mm`, saltos después de cada hoja y medidas de cuadrícula en milímetros. En `@media print` oculta la aplicación y muestra exclusivamente la superficie de etiquetas. La interfaz advierte «Escala 100 %» y «Sin encabezados ni pies». Cancelar o terminar el diálogo no muta el estado.

No se reutiliza `DocumentSheet`: se comparten tokens, el hook de disponibilidad de marca y la disciplina de impresión, pero no su encabezado económico, metadatos, pie ni aviso fiscal.

### D9 — Permisos, consistencia y límites operativos

El backend vuelve a comprobar `productos.ver`; ocultar acciones en el frontend solo mejora la experiencia. Administrador, Vendedor y Encargado del taller ya poseen ese permiso. La ruta y el resumen de marca son lecturas autenticadas de mismo origen, sin CORS adicional ni datos personales nuevos.

El lote refleja la instantánea obtenida al abrir el modal. Cambios posteriores del catálogo no alteran una preparación abierta; cerrarla y abrirla de nuevo refresca los datos. Esto es suficiente porque imprimir no confirma una operación ni modifica estados.

Para lotes grandes se muestra el total antes de renderizar la superficie completa. No se fija un límite de negocio arbitrario: la vista previa solo monta una página, y la superficie completa se monta cuando el usuario imprime. Un error de memoria o renderizado se presenta como fallo recuperable sin cerrar el modal.

### D10 — Estrategia de pruebas focalizadas

**Backend:**

- `backend/tests/catalog/test_product_label_data_api.py`: los cinco filtros, mismo orden que el listado, todas las páginas en una respuesta, proyección mínima, conjunto vacío, filtros inválidos y permiso para los tres roles;
- prueba de consulta para confirmar que el listado y la proyección comparten el constructor de filtros y no incurren en N+1 por marca;
- `backend/tests/workshop_configuration/test_entity_logo_api.py`: `display_name` usa nombre comercial y reserva a razón social sin romper `legal_name`;
- prueba focalizada del esquema OpenAPI para la ruta y la respuesta.

**Frontend (Vitest):**

- `code128.test.ts`: vectores conocidos (por ejemplo, `ABC` produce valores `104,33,34,35,1,106`), selección B/C, checksum, zonas silenciosas, determinismo y rechazo sin transliteración;
- `label-layout.test.ts`: 100 × 60 da 2 × 4, tamaño alternativo, tamaño inválido, primera posición y varias páginas;
- `ProductLabel.test.tsx`: composición profesional, logo sin nombre duplicado, reserva textual, descripción, presentación, zona futura vacía, asset fijo y Code 128;
- `ProductLabelPrintModal.test.tsx`: copias, lote numeroso con lista acotada, zoom progresivo, aplicar a todos, error de marca, fallo de imagen, producto incompatible, navegación, impresión y cancelación;
- pruebas focalizadas de `ProductsPage`, `ProductDetailPage`, `ElevatedDataList` y `entity-logos` para selección, filtros, permiso, acción y `displayName`.

**E2E:** un archivo `frontend/e2e/product-labels.spec.ts` cubre selección manual, todos los filtrados, ficha y superficie de impresión. Durante la aplicación se ejecutan únicamente estos archivos y las comprobaciones estáticas directamente afectadas.

### D11 — ADR

No se crea ni modifica un ADR. El endpoint es una proyección local y reversible del módulo `catalog`; el codificador y la hoja son piezas de presentación sin dependencia ni decisión transversal. Se mantienen ADR-0001, ADR-0002, ADR-0003 y la entrega privada de logotipos definida por ADR-0007.

## Risks / Trade-offs

- **Impresoras con área no imprimible o escala automática** → la cuadrícula se centra, pero 100 × 60 mm deja 5 mm laterales y puede acercarse al límite de ciertos equipos. Se usan medidas físicas, aviso de escala 100 % y prueba manual en los navegadores soportados. Un dispositivo con margen superior a 5 mm requerirá otro tamaño, algo que la aplicación permite pero no puede detectar.
- **Lotes muy grandes** → una sola lectura evita inconsistencias, la vista previa renderiza una página y la superficie completa se difiere hasta imprimir. El costo inevitable es que el navegador necesita representar el lote para producir PDF o papel.
- **Código Unicode ya válido en catálogo** → error explícito por producto y ninguna mutación; ampliar el alfabeto requeriría otra decisión porque Code 128 no define Unicode directo.
- **Instantánea manual desactualizada** → es equivalente a mantener abierta la lista; reabrir refresca. No se justifica otra consulta ni bloqueo para una operación sin efectos.
- **Logotipo lento o roto** → espera acotada y reserva al nombre. El fallo del resumen sí bloquea para no imprimir una identidad inventada.
- **Tamaño demasiado pequeño para contenido esencial** → validación previa de composición; se conserva la dimensión elegida y se solicita una mayor.
- **Bordes físicos acumulados** → el cálculo usa milímetros y un solo borde compartido por corte; las pruebas verifican dimensiones y el PDF se inspecciona durante la aplicación.

## Migration Plan

1. No hay migraciones ni transformación de datos.
2. Desplegar primero el backend con la ruta `label-data/`, `display_name` aditivo y OpenAPI; los clientes actuales ignoran el campo nuevo.
3. Desplegar después el frontend con selección, modal, codificador y CSS. Si la ruta no está disponible, «Todos los del filtro actual» muestra un error reintentable; selección manual y ficha no escriben nada.
4. Verificar en Chrome/Chromium y Firefox una hoja predeterminada guardada como PDF al 100 %, además de una prueba física representativa cuando haya impresora disponible.
5. **Reversión:** retirar el frontend y luego las adiciones de API. No hay datos, archivos ni preferencias que limpiar.

## Open Questions

Ninguna que bloquee la aplicación. El usuario confirmó el tamaño 100 × 60 mm, la paleta, el asset fijo de camión, el logotipo sin nombre duplicado, la descripción secundaria, la presentación y la reserva fotográfica vacía. La tolerancia de corte y el área imprimible exactas se validarán con el equipo disponible.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
