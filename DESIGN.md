# Sistema visual Tallkit · Grafito y cobre

> **Dirección aprobada el 2026-11-12 con el prototipo de U2** (`DP-036`, regla 6; `docs/cambios-pendientes.md`, U2). Se aplica al frontend mediante U3 (`renovar-sistema-visual`). Hasta archivar U3, el código sigue la dirección anterior, «Banco de trabajo», descrita en `openspec/specs/sistema-visual-frontend/spec.md` y en el historial de este archivo (`git show f6c4cea:DESIGN.md`). Esta guía no define reglas del negocio ni sustituye las specs; U3 decide qué requisitos visuales vigentes se conservan.

## Referencia

- **Prototipo aprobado:** lienzo «Tallkit · Prototipo U2» (<https://claude.ai/artifact/Xdc8YNnWYq5UyC3QFzLai8>), con copia de las fuentes en [`docs/prototipo/`](docs/prototipo/README.md). Cubre 18 pantallas y el menú, con datos de ejemplo y un selector «Prototipo» para cambiar de escenario.
- **Estilo de referencia del titular:** sus prototipos «Prototipos de Competencia», con tipografía geométrica, barra lateral oscura con un motivo gráfico propio, un solo color fuerte para la acción principal, pestañas tipo píldora y huecos punteados para agregar.
- El prototipo fija fundamentos y patrones, no fidelidad píxel a píxel ni comportamiento del backend.

## Principios

1. **Color con regla.** Neutros para casi todo; un solo color de marca, el cobre, para la acción principal y lo activo; cada negocio con un color discreto en su logo y sus marcas; tres estados apagados. Ningún otro color decorativo.
2. **Una acción fuerte por pantalla.** Solo un botón cobre por vista: lo demás va en contorno o sin fondo.
3. **Poco texto visible.** Encabezado con una sola línea de descripción; la ayuda y los avisos van en iconos o chips que se despliegan.
4. **Lenguaje del negocio.** Cada negocio se nombra por su nombre comercial y su logo, nunca «RUC comercial» ni «RUC artesanal» (`DP-036`, regla 3). Los estados son los reales del dominio: el mantenimiento está abierto, finalizado o reabierto, y el cobro y la factura llevan estado propio en cada documento.
5. **Interacción visible.** Filtros, pestañas, selección y confirmaciones responden en la misma pantalla; las confirmaciones son toast.
6. **Sin saturar.** Modales centrados y cortos, de uno a tres campos; lo largo va en la página o en una guía por pasos.

## Tipografía

- **Montserrat** en 300, 400, 500, 600 y 700 para toda la interfaz, servida desde la instalación (sin depender de Internet, como hoy IBM Plex). U3 elige el paquete y registra su licencia (OFL-1.1).
- No hay fuente monoespaciada: placas, códigos, RUC y números usan cifras tabulares (`font-variant-numeric: tabular-nums`) y un ligero espaciado entre letras.
- Escala: texto base 14 px; títulos de página 28 px en 700; títulos de bloque 15–16 px en 700; etiquetas 12–12,5 px en 500; importes destacados 24–40 px en 300.
- Jerarquía por peso: nombres en 700, datos en 400 gris, importes en 700 en tablas y en 300 cuando son cifras grandes.

## Paleta

Todas las parejas de texto y fondo cumplen WCAG AA (4,5:1 o más), medidas el 2026-11-12.

| Rol | Valor | Uso | Contraste |
|---|---|---|---|
| Grafito | `#1E2226` | Barra lateral, tarjetas oscuras, encabezados de vehículo | Texto del menú `#BEC2C7`: 8,9:1 |
| Tinta | `#1C1F23` | Texto principal; fondo de placas, stock y cantidades | Sobre blanco: 16,5:1 |
| Texto de apoyo | `#5E6369` | Descripciones y etiquetas | Sobre blanco 6,1:1; sobre fondo 5,5:1 |
| Fondo | `#F4F3F0` | Lienzo de la aplicación | — |
| Superficie | `#FFFFFF` | Tarjetas, tablas y modales | — |
| Neutros de apoyo | `#EFEEEB`, `#F8F7F4`, `#EAE7E2` | Fondo de controles, cabeceras de tabla, segmentos | — |
| Líneas | `#E4E1DC` / `#D5D1CB` / `#CCC8C1` | Borde de tarjeta / de campo / punteado | — |
| Cobre (marca) | `#B5582A`, intenso `#9C4A22`, suave `#F5E8E0` | Acción principal, elemento activo, motivo del tacómetro | Blanco sobre cobre: 4,8:1 |
| Negocio de servicios | Pizarra `#4A6280`, texto `#3E546F`, suave `#E9EDF2` | Logo y marcas de Transmisiones y Embragues Jimenez | Blanco 6,3:1; texto sobre suave 6,6:1 |
| Negocio de repuestos | Arena `#8C6B3F`, texto `#6E5430`, suave `#F2ECE2` | Logo y marcas de Transmisiones y Embragues Repuestos Automotrices | Blanco 4,9:1; texto sobre suave 6,0:1 |
| Correcto | `#2F6B4A` sobre `#E5EFE8` | Pagado, completo, al día | 5,4:1 |
| Atención | `#855E16` sobre `#F5EDDC` | Reabierto, falta un dato, plazo próximo | 5,0:1 |
| Deuda o error | `#A8392F` sobre `#F5E5E2` | Saldo pendiente, vencido, agotado, rechazada | 5,2:1 |
| Enlaces y foco | `#3E546F`; foco de 2 px en `#4A6280` | Enlaces y foco visible | Enlace sobre blanco: 7,8:1 |

Reglas:

- El cobre no se usa para estados ni para un negocio.
- El color de un negocio aparece solo en su logo, su marca pequeña y los tintes de sus bloques; nunca en botones.
- Los estados neutros (por ejemplo, «Solicitada» o «Finalizado») usan grafito sobre `#ECEBE8`, sin color propio.
- Ningún estado depende solo del color: lleva texto y un punto o icono.
- Mientras el negocio no cargue su logo, se muestran sus iniciales: círculo en pizarra para el taller y cuadrado redondeado en arena para el almacén. Los dos nombres comerciales se parecen, así que forma, color y logo deben distinguirlos.

## Formas, espacio y movimiento

- Radios: chips y placas 6–7 px; controles y botones 10 px; tarjetas 14–16 px; modales 18–20 px; píldoras de estado y segmentos redondeados por completo.
- Sombras solo en modales, toast, selector flotante y tarjetas al pasar el puntero; las tarjetas en reposo tienen solo borde.
- Separación de 20 a 28 px entre bloques. Las páginas usan todo el ancho, sin ancho máximo.
- Movimiento breve, solo como respuesta (entrada de modal y toast, pestaña o paso nuevo), y desactivado con `prefers-reduced-motion`.

## Marco

- **Barra lateral** grafito de 264 px:
  - Logotipo y «Taller y repuestos».
  - Grupo «Día a día» con Inicio, Mantenimientos, Ventas, Facturas, Clientes, Productos, Servicios y Cuentas, y grupo «Poco frecuente» con Ajustes (`DP-036`, regla 1; la estructura del menú rige con U4).
  - Opción activa con fondo `#2C3137` y una barra cobre a la izquierda; contadores pequeños a la derecha.
  - Al pie, un tacómetro en líneas finas con un arco y una aguja cobre: es el motivo gráfico propio, inspirado en el oficio. Se repite en las tarjetas oscuras.
- **Barra superior** blanca: migas, búsqueda global subrayada (rige con U5), nombre y permisos de la persona, avatar cobre y botón de salir.
- **Encabezado de página:** icono en un cuadro suave, antetítulo pequeño, título y una línea de descripción; acciones a la derecha.

## Patrones

- **Inicio:** banda grafito con la pregunta del día, el buscador grande, «Nuevo mantenimiento», «Venta rápida» y un gráfico circular de lo cobrado hoy por negocio. Debajo, tres columnas con datos reales: en el taller (mantenimientos abiertos), falta cobrar (documentos con saldo) y falta facturar (cobros sin factura pedida).
- **Listas:** búsqueda subrayada, segmentos tipo píldora con contador, tabla con cabecera gris y columnas fijas. El código, la marca y el número del fabricante van en columnas propias.
- **Maestro y detalle:** lista agrupada a la izquierda y vista previa a la derecha (clientes, facturas).
- **Fichas:** encabezado con la identificación (placa, nombre o código), estado real y acciones; pestañas subrayadas para separar la información.
- **Cobro:** los dos negocios lado a lado, cada uno con su total y su factura; forma de pago en recuadros grandes; total y botón «Cobrar y facturar» en una columna fija.
- **Modales:** centrados, de 420 a 980 px según el contenido, con uno a tres campos. El de nuevo mantenimiento es el más amplio: búsqueda a la izquierda y datos del vehículo a la derecha.
- **Huecos punteados** «+ …» para agregar donde aún no hay contenido.
- **Estados de contenido:** vacío con acción, sin resultados con explicación breve y nunca datos inventados.
- **Toast** de confirmación arriba a la derecha.

## Piezas del taller

- **Placa:** chip tinta con letras blancas espaciadas; en las tarjetas oscuras, chip blanco con letras grafito.
- **Código:** chip gris (`#EFEEEB`) para productos y chip pizarra suave para servicios (`SRV-000012`).
- **Stock:** marcador tinta con la cantidad y rojo suave cuando está agotado; nunca «stock bajo» mientras `RF-INV-011` siga sin decidir.
- **Cantidad editable:** botones − y + alrededor de un marcador tinta.
- **Importes:** USD con dos decimales y cifras tabulares, alineados a la derecha.
- **Logo de negocio:** iniciales o logo cargado, con la forma y el color de cada negocio.

## Accesibilidad

- Objetivos táctiles de 44 px en controles esenciales.
- Foco visible en todos los controles, modales que contienen el foco y cierran con Escape.
- Etiquetas reales en campos, `aria-label` en botones de solo icono y estados con texto.
- Las pruebas automáticas de accesibilidad y de ancho (360 a 1440 px) que exige la spec vigente se conservan en U3.

## Pendiente de decidir en U3

- Si se usará tableta en el taller (sin confirmar en U2); define la prioridad del diseño táctil entre 768 y 1279 px.
- Qué requisitos de `sistema-visual-frontend`, `patrones-de-pantalla-frontend` y `experiencia-adaptable-frontend` se reemplazan o se conservan.
- El tema oscuro, que hoy no está disponible, queda fuera de esta dirección.
