# Sistema visual de Sys-Taller

## Propósito

Esta guía define el lenguaje visual implementado en el frontend de Sys-Taller. Mantiene una experiencia luminosa, amable y operativa en computadora, tableta y teléfono. No define reglas del negocio ni sustituye las especificaciones OpenSpec.

## Dirección visual y atribución

El sistema adapta la composición y el lenguaje visual de [SAAS Dashboard (Community)](https://www.figma.com/community/file/1065510379888107603/saas-dashboard), creado por Jiangyu y publicado bajo CC BY 4.0. La plantilla es referencia para color, tipografía, espaciado, geometría, elevación y patrones de interacción.

Sys-Taller no reutiliza la marca, el logotipo, los textos demostrativos, nombres, datos, fotografías ni funcionalidades de la plantilla. Conserva los iconos de navegación y la ilustración neutral de confirmación exportados del archivo Figma; el resto del contenido corresponde a Sys-Taller. Todo contenido visible responde al producto y a sus permisos reales. El gráfico de acceso `frontend/src/assets/workshop-diagnostic.svg` es un recurso original del proyecto. Se compone con formas neutras e iconos locales dentro de la región 647 × 602 px del frame, conservando la paleta y evitando datos demostrativos.

## Recursos locales

- Interfaz y cifras: Nunito 400, 600, 700 y 800, con números tabulares cuando se comparan valores.
- Iconos: Category, Document y Chart exportados de Figma para la navegación; Phosphor para las acciones propias, siempre con nombre accesible. Recursos en `frontend/src/assets/figma/`, nodos 4:645, 4:622 y 4:637. Confirmación: 4:9343, 4:9346 y 4:9349, sin marcas ni datos.
- Ilustración de acceso: SVG local, decorativo y sin contenido remoto.
- Ningún recurso visual esencial depende de Internet durante la operación.

Las versiones reproducibles son `@fontsource/nunito@5.3.0` (OFL-1.1), `@phosphor-icons/react@2.1.10` (MIT) y, solo para pruebas, `@axe-core/playwright@4.13.0` (MPL-2.0). El lockfile conserva sus versiones exactas.

## Tokens

| Rol | Valor | Uso |
|---|---:|---|
| `canvas` | `#FAFAFB` | Fondo general de la aplicación. |
| `surface` | `#FFFFFF` | Navegación, tarjetas, filas y superposiciones. |
| `surface-muted` | `#F7F7F8` | Campos y agrupaciones neutras. |
| `ink` | `#030229` | Texto principal. |
| `ink-muted` | `#626176` | Texto secundario con contraste accesible. |
| `line` | `#E7E6EB` | Separación sutil dentro de una superficie. |
| `primary` | `#605BFF` | Acción principal y ubicación activa. |
| `primary-soft` | `#EFEEFF` | Selección, iconos y acciones secundarias. |
| `info` | `#5B93FF` | Información destacada. |
| `cyan` | `#26C0E2` | Acento auxiliar. |
| `yellow` | `#FFD66B` | Acento de advertencia. |
| `coral` | `#FF8F6B` | Acento cálido. |
| `orange` | `#F29339` | Acento naranja original. |
| `pink` | `#EF37FF` | Acento rosa original. |
| `green` | `#3A974C` | Acento verde original. |
| `success` | `#27763A` | Texto de resultado satisfactorio. |
| `warning` | `#A65F0C` | Texto de atención. |
| `danger` | `#D11A2A` | Error o acción destructiva. |

Los tonos semánticos de texto se oscurecen frente a los colores originales del kit cuando el contraste lo exige. Cada estado dispone de un fondo pastel y siempre se expresa también con texto o icono.

La retícula principal usa márgenes y separaciones de 30 px, con 32 px entre las dos filas de paneles de Inicio. Los controles usan radio de 5 px; tarjetas y botones, 10 px. Las tarjetas y filas ordinarias son planas. La sombra `1px 17px 44px rgba(3, 2, 41, 0.07)` corresponde a fila destacada, hover o foco; `0 10px 20px rgba(0, 0, 0, 0.1)` a menús. No se aplica una sombra general a todos los componentes.

## Composición adaptable

- Desde 768 px: sidebar de 80 px, margen exterior de 30 px, contenido desde x=140. Es la variante del dashboard solicitada también para listas; estas últimas tienen sidebar de 218 px en sus frames originales.
- Bajo 768 px: encabezado compacto y navegación en drawer con etiquetas completas.
- Inicio a 1366 × 1047: cuatro tarjetas de 116 px; paneles de 719/447 px, alturas 408/335 px, coordenadas y=242/682.
- Usuarios: filas de 60 px y separación de 10 px, según Customer List. Auditoría: filas de 70 px según Invoice List. En tableta la tabla conserva un ancho legible y desplazamiento local accesible por teclado; en teléfono se convierte en tarjetas.
- Drawer: 409 px con márgenes de 30 px y campos de 349 × 50 px; una columna. En móvil ocupa todo el ancho. Los roles y la advertencia de cambios conservan su comportamiento.
- Acceso a 1440 × 1112: región blanca de 448 px; contenido desde x=50; marca de 92 px en y=200; título 25/600 en y=332; campos en y=557/657; botón en y=791.
- Recover: diálogo administrativo cuadrado de 658 px, radio 10; marca en y=331, campo informativo en y=603, botón en y=678 a 1440 × 1112. Confirm: superficie cuadrada de 726 px e ilustración de 184 px. Los avisos y la credencial temporal existentes requieren contenido adicional respecto al frame y se conservan antes de la acción de cierre.
- No hay rutas públicas de recuperación/confirmación nuevas. Los diez frames del archivo `GRvgnODulXXrLTz4BsaToK` fueron consultados individualmente mediante propiedades estructuradas; la comparación y aceptación se registran en `docs/tecnico/revision-visual-frontend.md`.

## Componentes base

- Acciones: `Button`, `IconButton` y `ButtonGroup`.
- Formularios: `Field`, `Input`, `Select`, `Checkbox` y `FieldError`.
- Estado: `StatusBadge`, `FiscalScopeBadge`, `InlineNotice`, `LoadingState` y `EmptyState`.
- Composición: `PageHeader`, `Toolbar`, `FilterPanel`, `Surface`, `StatCard`, `ElevatedDataList`, `ResponsiveDataView`, `Pagination` y `RowActions`.
- Superposición: `Drawer` para formularios contextuales y `Dialog` para decisiones bloqueantes.

Las variantes son cerradas y semánticas. El frontend oculta opciones según el permiso efectivo, pero el backend conserva la autoridad sobre toda acción.

## Patrones por superficie

- Acceso: formulario prioritario; composición dividida solo en pantalla amplia; sin registro público ni proveedores sociales.
- Marco autenticado: navegación blanca, selección violeta suave, identidad reemplazable y sesión al pie.
- Listas: filtros compactos, filas blancas separadas, estado pastel redundante y paginación estable.
- Formularios contextuales: drawer lateral en tableta y escritorio, ancho completo en teléfono y advertencia de cambios sin guardar.
- Confirmaciones críticas: diálogo con objeto y consecuencia identificados.
- Inicio: retícula del dashboard con accesos autorizados, datos reales de sesión y placeholders explícitos en las regiones sin métricas; no se inventan series ni porcentajes.

## Accesibilidad e interacción

- Objetivos táctiles mínimos de 44 px con puntero grueso.
- Foco visible de 2 px con separación suficiente.
- Errores asociados a sus campos y estados expresados sin depender del color.
- Drawer y diálogo contienen el foco, cierran con Escape cuando es seguro y lo devuelven al disparador.
- Movimiento breve y desactivado con `prefers-reduced-motion`.
- Las rutas representativas se auditan con axe; infracciones serias o críticas bloquean E2E.

## Uso futuro del ámbito fiscal

`FiscalScopeBadge` identifica explícitamente “RUC comercial” o “RUC artesanal” con texto, icono y color redundantes. Debe aparecer junto al título o identificador de toda operación económica cuando esas capacidades se implementen; nunca se inferirá únicamente por el color.
