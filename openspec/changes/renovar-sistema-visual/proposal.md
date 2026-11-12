## Why

El titular declaró Tallkit difícil de usar el 2026-11-01: todo blanco, letra sin jerarquía y colores sin función (`docs/analisis-del-sistema.md` §6.4). `DP-036`, regla 6, reemplazó la dirección visual «Banco de trabajo», y el 2026-11-12 el titular aprobó el prototipo de U2 y la dirección nueva **«Tallkit · Grafito y cobre»** (`DESIGN.md`). Esa dirección todavía no rige: según la regla 8, solo rige al archivar el cambio que la implementa, y ese cambio es U3.

**Objetivo:** que todas las pantallas existentes adopten la dirección aprobada sin cambiar qué hacen, y que las specs visuales describan la dirección nueva en lugar de la anterior.

## What Changes

1. **Fundamentos con tokens.** Se aplican la paleta «Grafito y cobre» y las formas de `DESIGN.md`:
   - neutros cálidos, grafito, cobre como único color de marca y estados apagados;
   - pizarra para el taller (entidad artesanal) y arena para el almacén (entidad comercial);
   - radios de 6 a 20 px, sombras solo en superposiciones y más aire entre bloques.

   Los tamaños de letra escritos a mano pasan a tokens: hoy hay unos 384 usos sueltos en `frontend/src`.
2. **Tipografía.** Montserrat, servida desde la instalación, reemplaza a IBM Plex Sans e IBM Plex Mono. Códigos, placas y RUC usan cifras tabulares y espaciado. La escala sube: texto base de 14 px y títulos de página de 28 px. **BREAKING** para las pruebas que fijan fuentes o estilos.
3. **Marco de la aplicación.**
   - Barra lateral grafito con el motivo del tacómetro y la opción activa en cobre.
   - Barra superior con migas, usuario y salida.
   - Encabezado de página con icono, antetítulo, título y una línea de descripción.

   Las entradas y los grupos del menú no cambian; eso es U4.
4. **Componentes y patrones compartidos con el aspecto nuevo:**
   - botones (uno solo cobre por pantalla), segmentos tipo píldora con contador, pestañas subrayadas, búsqueda subrayada;
   - estados en píldora con punto, tablas con cabecera y columnas fijas, modales centrados y cortos, toast y huecos punteados para agregar;
   - piezas del taller: placa, código, stock, importe y marca de cada negocio.

   Se añade el patrón **maestro y detalle**, una lista con vista previa al lado, para cuando una pantalla lo necesite.
5. **Adopción en todas las pantallas** por fases: fundamentos y marco, componentes, piloto y resto. El titular valida cada fase directamente en la aplicación, como en el rediseño anterior.
6. **Specs.** Se reemplazan los requisitos de la dirección «Banco de trabajo» y se quitan las notas «en reemplazo» de las specs visuales. Se conservan los requisitos de accesibilidad, de tamaños de pantalla, de recursos locales y de permisos.
7. **Ajuste de `objetivos-de-uso-diario`.** Se quita el requisito de observar a la usuaria y compararlo con el Facturador del SRI antes de programar U3 a U6. El titular lo declaró no necesario el 2026-11-12. Los objetivos de acciones se siguen comprobando al cerrar U6.

### Decisiones que se piden aprobar

- **D1. Alcance (recomendado).** U3 cambia el aspecto y conserva el contenido de cada pantalla: datos, rutas, permisos, textos y menú. Las recomposiciones del prototipo que cambian contenido van a sus cambios:

  | Recomposición del prototipo | Cambio |
  |---|---|
  | Columnas del Inicio con lo que falta cobrar y facturar, maestro y detalle de clientes, columnas nuevas de productos y servicios, menú de 9 entradas, nombre comercial en lugar de «RUC» | U4 |
  | Búsqueda global | U5 |
  | «Cobrar y facturar» y nuevo mantenimiento en un paso | U6 |

  *Alternativa:* incluir ya esas recomposiciones en U3. El cambio crece y se mezclan aspecto y comportamiento.
- **D2. Sin fuente monoespaciada (recomendado).** Se sigue `DESIGN.md`: Montserrat con cifras tabulares. Es un riesgo que «I» y «l» se parezcan; se comprueba en el piloto con placas y códigos reales. *Alternativa:* conservar IBM Plex Mono solo para códigos y RUC.
- **D3. Tableta (recomendado).** Se mantiene el comportamiento adaptable vigente: barra de iconos entre 768 y 1279 px y controles de al menos 44 px. No hay diseño específico para tableta mientras el titular no confirme si la usará. *Alternativa:* priorizar la tableta, lo que exige confirmarlo antes de las specs.
- **D4. Piloto.** El piloto sería Inicio, la lista de mantenimientos, la ficha del mantenimiento, la lista de productos y un formulario en modal. El resto de pantallas no se rediseña hasta que el titular apruebe el piloto.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `sistema-visual-frontend`:
  - Se reemplazan identidad, jerarquía cromática, tipografía, piezas del taller e indicadores por «Grafito y cobre».
  - Se ajustan las fases de validación al piloto D4.
  - Se retira «Dirección visual en reemplazo».
  - Se conservan los tokens semánticos, los recursos locales, el tema oscuro no disponible y los estados sin depender del color.
- `patrones-de-pantalla-frontend`:
  - PPF-01 a PPF-05, PPF-07 y PPF-08 adoptan el aspecto nuevo.
  - Se agrega el patrón maestro y detalle.
  - Se retira la parte de U3 de «Patrones en reemplazo»; la de U6 sobre `PPF-06` se mantiene.
  - PPF-09 y PPF-10 no cambian: hoja impresa y etiquetas.
- `experiencia-adaptable-frontend`:
  - La navegación lateral adopta el aspecto grafito y la densidad pasa a ser la de `DESIGN.md`.
  - Se retira la parte de U3 de «Navegación y densidad en reemplazo»; la parte de U4, el menú, sigue pendiente.
- `catalogo-visual-reutilizable`: CVR-02 pasa a Montserrat y el catálogo muestra los componentes y patrones nuevos.
- `objetivos-de-uso-diario`:
  - Se retira «Comprobación con la usuaria diaria».
  - Los objetivos dejan de depender de esa comprobación y se verifican al cerrar U6.

## Impact

- **Frontend:**
  - Se modifican `frontend/src/shared/styles/` (tokens y estilos base) y los componentes de `frontend/src/shared/ui/`, incluidos el marco, la navegación y las piezas del taller.
  - Se ajusta el estilo de todas las pantallas de `frontend/src/` y de `frontend/visual-catalog.html`.
  - Se reutilizan la estructura de tokens en dos capas, los componentes existentes, Phosphor y el control de permisos de la navegación.
  - Se sustituyen la paleta, la tipografía, los radios, la densidad y el aspecto del marco.
- **Dependencias:** se añade una distribución local de Montserrat (OFL-1.1) y se retiran IBM Plex Sans y Mono si dejan de usarse. Se conservan `uv.lock` y `package-lock.json`.
- **Pruebas:** se actualizan las pruebas que fijan fuentes, clases o estilos. Las pruebas de accesibilidad (`axe`) y de ancho en 360, 768, 1024, 1280 y 1440 px siguen y deben pasar.
- **Sin impacto:** backend, API, datos, migraciones, permisos, reglas de dinero, inventario y facturación, y textos visibles.
- **Documentación:**
  - Se actualizan `DESIGN.md` (el aviso pasa de «se aplica en U3» a «vigente»), `PRODUCT.md`, `interfaz-y-navegacion.md` §10 y §13, la matriz de trazabilidad y `docs/cambios-pendientes.md` (U3).
  - `RNF-USA-016` y la matriz se ajustan por el cambio en `objetivos-de-uso-diario`.

## Fuera de alcance

- Reorganizar el menú, el lenguaje visible, el nombre comercial en lugar de «RUC» y cambiar el contenido de pantallas: U4.
- Búsqueda global: U5. «Cobrar y facturar», captura más corta del mantenimiento y medición de los objetivos de acciones: U6.
- Tema oscuro, diseño específico para tableta (D3), hoja A4 del comprobante y etiquetas impresas.
- Logotipos reales de los negocios: se cargan desde la configuración existente. Mientras no estén cargados se muestran las iniciales.
- Cualquier cambio en backend, API, permisos o reglas de negocio.

## Usuarios afectados, dependencias y riesgos

- **Usuarios:** la usuaria diaria (tres roles acumulados) y quienes tengan un solo rol. Todos ven las mismas pantallas con aspecto nuevo y sin cambios de permisos (`CT-001`).
- **Depende de:**
  - U2 aprobado y registrado en `master` (`4861a4d`), con `DESIGN.md`.
  - `DP-036`, reglas 3, 6 y 8.
  - `RNF-USA-001`, `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`, `RNF-DIS-001`, `RNF-MAN-003` y `RNF-MAN-005`.
- **Habilita:** U4, U5 y U6, que construyen sobre los componentes nuevos.
- **Riesgos:**
  - Contraste: las parejas de `DESIGN.md` miden entre 4,8:1 y 16,5:1, y hay que repetirlo con `axe` en la aplicación.
  - Legibilidad de códigos sin fuente monoespaciada (D2).
  - Una escala de letra mayor puede romper tablas densas en 1024 y 1280 px.
  - Las pruebas que fijan estilos fallarán y hay que actualizarlas sin perder lo que verifican.
  - Pantallas con el aspecto nuevo y textos antiguos, como «RUC comercial», hasta U4.

## Contradicciones, pendientes e información insuficiente

- **Contradicción resuelta por decisión del titular:** `objetivos-de-uso-diario` exige observar a la usuaria y comparar con el Facturador del SRI antes de programar U3. El titular lo declaró no necesario el 2026-11-12, `docs/cambios-pendientes.md` ya lo registra y este cambio ajusta la spec. `DP-036`, regla 7, no exige esa observación, así que no hay choque con las decisiones confirmadas.
- **Pendiente:** el uso de tableta en el taller, que `DP-036` aplazó a U2, sigue sin confirmar (D3).
- **Insuficiente:** no hay logotipos reales de los negocios. Los nombres comerciales sí se conocen: «Transmisiones y Embragues Jimenez» y «Transmisiones y Embragues Repuestos Automotrices».

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`, completo: `DP-034` a `DP-036`, `CT-001`, `RF-INV-011` pendiente y límites de V1.
- `docs/arquitectura/modelo-dominio.md`, consultado por su índice y secciones: el cambio no toca entidades, estados ni invariantes.
- `openspec/specs/sistema-visual-frontend`, `patrones-de-pantalla-frontend`, `experiencia-adaptable-frontend`, `catalogo-visual-reutilizable` y `objetivos-de-uso-diario`.
- `DESIGN.md`, `docs/prototipo/README.md`, `docs/cambios-pendientes.md` (U2 y U3), `docs/analisis-del-sistema.md` §6.4 y §8.4, `requisitos-no-funcionales.md` (`RNF-USA`, `RNF-DIS`, `RNF-MAN`) e índice de `interfaz-y-navegacion.md`.
