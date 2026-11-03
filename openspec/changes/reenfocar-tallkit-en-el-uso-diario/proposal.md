## Why

Tallkit cumple lo que se escribió, pero cuesta usarlo: cobrar un mantenimiento con un repuesto exige 47 acciones, y el recorrido termina en «Datos listos», sin factura. El [análisis del sistema](../../../docs/analisis-del-sistema.md) muestra la causa: «rápido y sencillo» nunca fue un requisito, y varias reglas vigentes ordenan mostrar la jerga.

El titular ya decidió el rumbo el 2026-11-01, pero esas decisiones todavía no sustituyen ninguna regla. Hay que registrarlas antes de diseñar o programar U2 a U6, y antes del cambio 3, que de otro modo agregaría otro botón «Facturar» a pantallas que ya no se usarán como camino.

**Objetivo:** dejar escrito, sin tocar código, para quién se diseña, qué se reemplaza, qué se mantiene y cómo se mide la rapidez.

## What Changes

### A. Decisión nueva `DP-036`

1. **Usuaria diaria:** Tallkit se diseña para la persona que atiende cada día, sin conocimientos contables y con los tres roles. La tabla de permisos no cambia. Lo poco frecuente se agrupa en «Ajustes».
2. **Cobrar y facturar:** una sola pantalla, abierta desde el mantenimiento o la venta, resuelve repuestos y servicios con los dos importes, dos cobros y dos facturas a la vista. Por dentro siguen siendo operaciones separadas. Quien no tiene permiso sobre una parte solo ve la suya. Esa pantalla es la única revisión.
3. **Nombres y lenguaje:** las pantallas identifican cada negocio por su nombre comercial o, si no lo tiene, por su razón social, en lugar de «RUC comercial» y «RUC artesanal». El RUC sigue visible en facturas, comprobantes y «Ajustes». Los conceptos internos siguen existiendo, pero no se muestran si no ayudan a la tarea.
4. **Correo:** al facturar, una casilla activada guarda el correo en la ficha del cliente. Si se desactiva, el correo queda solo en esa factura. Registrar un cliente sigue sin exigirlo.
5. **Búsqueda global:** se busca por placa, cliente, producto o factura desde cualquier pantalla. El servidor decide qué resultados puede ver cada rol.
6. **Dirección visual:** se reemplaza la de septiembre. La nueva se escribe al aprobar el prototipo (U2) y la anterior sigue vigente hasta U3.
7. **Rapidez medible:** los objetivos de la sección B pasan a ser requisitos.
8. **Orden y transición:** la etapa 0 va antes del cambio 3. Registrar esta decisión no cambia ninguna pantalla: cada regla rige al archivar el cambio que la implementa, y hasta entonces siguen las specs vigentes. No habilita la emisión real (`DP-034`, regla 8).

### B. Requisitos nuevos de rapidez

Objetivos provisionales, medidos con el mismo método del análisis para poder comparar: desde el Inicio, con cliente ya registrado, cada clic o campo cuenta como una acción y elegir de una lista cuenta como una.

| Tarea | Hoy | Objetivo provisional |
|---|---:|---:|
| Servicio simple, cobrado, facturado y orden cerrada | 25 | 8 a 10 |
| Venta de mostrador, cobrada y facturada | 16 | 5 a 6 |
| Mantenimiento con repuesto, cobrado, facturado y orden cerrada | 47 | 12 a 14 |

### C. Salida de cada choque

| Regla o decisión | Salida | Se aplica en | Motivo |
|---|---|---|---|
| `RNF-USA-009` | Se ajusta | U4 | Lenguaje simple. Sigue distinguiendo crédito de forma de pago. |
| `RNF-USA-010` | Se ajusta | U4 | El negocio se identifica por su nombre; el RUC, donde importa. |
| `interfaz-y-navegacion.md:37` y `DESIGN.md` | Reemplaza | U5 | Se incorpora la búsqueda global. |
| `DP-035`, regla 1, `RN-CLI-003` y modelo de dominio §11.6 | Se ajusta | U6 | Excepción: la casilla escribe en la ficha. |
| `DP-027` | Se mantiene | U6 | Confirmar y cobrar siguen siendo hechos separados; la pantalla los encadena. Si el cobro falla, la venta sigue confirmada y pendiente. |
| `DP-013` | Se mantiene | U6 | Dos pagos, cada uno a su operación. |
| `DP-021` | Se mantiene | U6 | Quien pulsa cobrar confirma expresamente; finalizar no confirma nada. |
| **Nuevo.** Specs de pagos: sin «pago repartido» ni pago a «la orden como conjunto» | Se mantiene | U6 | Nadie escribe un solo importe para que el sistema lo divida. Un pago parcial se indica por negocio. |
| **Nuevo.** `interfaz-y-navegacion.md`, sección 6.6 | Se ajusta | U6 | El plan lo dejaba para U6, pero la regla 2 depende de él. Sigue prohibido repartir en silencio; un botón es válido si muestra los dos importes. |
| **Nuevo.** `RNF-USA-003`, sección 8.1 y `PPF-06` | Se ajusta | U6 | Pedir el diálogo de confirmación para cada acción impediría los objetivos. La pantalla hace de confirmación y muestra efectos y valores del servidor. |
| **Nuevo.** `RN-FIS-009` y principio 3 de la interfaz | Se mantiene | U4 | El nombre del negocio cumple con identificar la entidad fiscal. |
| **Nuevo.** Encabezado de `glosario.md`: sus términos se usan en pantallas | Se ajusta | U1 | Separa términos de documentación y términos visibles. |
| **Nuevo.** `configuracion-operativa-y-fiscal`: nombre comercial opcional | Se mantiene | U4 | Se usa la razón social como respaldo. U4 lo pide en la configuración inicial. |
| **Nuevo.** `actores-y-roles.md` §5: funciones críticas separadas | Se mantiene | U1 | `CT-001` permite acumular roles. La separación sigue en permisos y auditoría; el riesgo consta abajo. |
| `DP-006` y `DP-008` | Se mantienen | — | Los números internos y los datos exigidos no cambian. |

Quedan para U6, como dice el plan: `DP-029` y el permiso del Encargado sobre repuestos. Quedan para U3 los reemplazos de las specs visuales, y para U4 los de la sección 2.2.

### D. Documentación

- **Registrar:** `DP-036`, los ajustes de `DP-035`, `RNF-USA-009/010`, los requisitos nuevos, `RN-CLI-003`, `actores-y-roles.md`, `vision.md`, `glosario.md`, modelo de dominio, casos de uso y trazabilidad.
- **Corregir lo desactualizado del plan:** `README.md:11`, `AGENTS.md`, `decisiones-confirmadas.yaml:407`, `PRODUCT.md:37`, `DESIGN.md:12` y las secciones 2.2 y 7.3 de `interfaz-y-navegacion.md`.
- **Corregir lo desactualizado que el plan no listaba:** el encabezado de `interfaz-y-navegacion.md`, que cita un cambio ya archivado; el estado «Borrador» de ingreso en su sección 9, sustituido por `DP-030`; y en el modelo de dominio, la leyenda de Negocio Popular que aún figura por confirmar, `DM-001` como aplazada y un enlace roto al final. `PRODUCT.md` también conserva usuarios, posicionamiento y el principio de densidad anteriores.
- **Marcar «en reemplazo»:** `DESIGN.md` y las specs visuales, aclarando que siguen vigentes hasta U3.
- **Actualizar el plan:** `docs/cambios-pendientes.md` recibe los choques nuevos y lo que resulte de la sección «Pendientes».

## Capabilities

### New Capabilities

- `objetivos-de-uso-diario`: persona de referencia, objetivos de rapidez, cómo se cuentan las acciones y cuándo se comprueban.

### Modified Capabilities

- `modelo-dominio-taller`: agrega que una pantalla común no une operaciones, cobros ni facturas, y la sincronización de `DP-036`.
- `sistema-visual-frontend`, `patrones-de-pantalla-frontend` y `experiencia-adaptable-frontend`: solo reciben la marca «en reemplazo», sin cambiar su comportamiento.

### Specs sin cambio en esta propuesta

Conservan su comportamiento hasta que su cambio las modifique. La regla 8 evita que contradigan a `DP-036`.

| Spec | Cambio que la modificará |
|---|---|
| `preparacion-y-seguimiento-fiscal`, `ventas-comerciales`, `ordenes-de-mantenimiento`, `pagos-comerciales-y-credito-simple`, `pagos-artesanales-y-credito-simple` | U6 |
| `autorizacion-y-navegacion`, `pagina-de-inicio`, `gestion-de-clientes`, `configuracion-operativa-y-fiscal` | U4 |
| `catalogo-visual-reutilizable` | U3 |

## Impact

- **Código, datos, API, permisos y pantallas:** sin cambios. El cambio solo modifica documentación.
- **Dependencias y operación:** ninguna dependencia nueva y ninguna diferencia en el uso diario hasta U3.
- **Referencias:** `CT-001`, `DP-006`, `DP-008`, `DP-013`, `DP-021`, `DP-027`, `DP-029`, `DP-030`, `DP-034`, `DP-035`; `RN-CLI-003`, `RN-FIS-009`; `RF-FIS-002`, `RF-PAG-002`; `RNF-USA-003/009/010`; `CU-012`, `CU-013`, `CU-017`, `CU-018`, `CU-019`; `UI-059`, `UI-060`, `UI-075`; `PPF-06`.

## Fuera de alcance

- Código, modelos, migraciones, endpoints y pantallas.
- Prototipo, dirección visual nueva y tokens: U2 y U3.
- Menú, ficha del cliente, stock en Productos, textos y errores de la sección 6.2 del análisis: U4. «Crédito» como valor inicial puede adelantarse como arreglo pequeño.
- Búsqueda global: U5. Pantalla «Cobrar y facturar»: U6.
- Emisión real y estados de la factura: cambios 3 y 4. Consumidor final sin registro: cambio 6.
- Verificación aplazada de `alinear-datos-del-comprobante-con-sri`: al cerrar U6.

## Usuarios afectados

- **Usuaria diaria:** pasa a ser la referencia de diseño. No nota cambios todavía.
- **Titular:** aprueba cada salida y queda con requisitos medibles.
- **Quien desarrolla y los agentes:** dejan de leer documentación que describe lo que ya no se hará.

## Dependencias

- **Necesita:** nada; las decisiones ya están tomadas y `alinear-datos-del-comprobante-con-sri` está archivado.
- **Habilita:** U2 a U6.
- **Orden afectado:** el cambio 3 debe encajar en «Cobrar y facturar», y no agregar otro camino.

## Riesgos

- **Objetivos que U6 no alcanza solo:** antes de cobrar, un servicio simple ya gasta 11 acciones y el mantenimiento con repuesto 16. La segunda cifra supera su objetivo sin haber cobrado nada, así que también debe acortarse la captura. Se asigna a U6 y se prueba antes en U2.
- **Factura aparente:** hasta los cambios 3 y 4, «Cobrar y facturar» no produce una factura real. La pantalla no puede hacer creer que sí (`RF-FIS-002`, `DP-034`, regla 8).
- **Flujo interrumpido:** son dos operaciones, así que una puede quedar hecha y la otra no, por ejemplo si falta stock. U6 debe comprobar antes y mostrar qué quedó hecho.
- **Una persona con todos los roles:** nadie más revisa lo que anula o ajusta, y esa persona ve costos. La auditoría sigue registrándolo. El titular lo aceptó por tratarse de alguien de confianza.
- **Correo equivocado:** con la casilla activada, un error de digitación puede reemplazar un correo correcto. U6 debe avisar si difiere del guardado.
- **Nombres parecidos:** dos negocios con nombres similares pueden confundirse. U2 debe distinguirlos también por color e icono.
- **Marca mal entendida:** «en reemplazo» no significa derogada; la marca debe decir que sigue vigente hasta U3.

## Pendientes e información insuficiente

Decididos por el titular al aprobar esta propuesta (2026-11-03):

- **Quién acorta la captura:** U6, probado antes en U2. Incluye elegir solo el vehículo cuando hay uno, agregar servicios y repuestos en dos acciones y finalizar sin ventana adicional.
- **Medir con una persona real:** en U2. Los objetivos son estimados y las cifras de hoy son de un robot; U2 observa el uso real y lo compara con el Facturador del SRI, como pide el paso 1 del análisis.

Quedan para su cambio:

- **Si «Cobrar y facturar» también finaliza la orden:** U6. Los objetivos cuentan el cierre, igual que las cifras de hoy.
- **Qué muestra «Facturas» antes del cambio 3,** tanto en el menú como en la búsqueda: U4 y U5.
- **Si se usará tableta en el taller:** sin confirmar; U2.

Diferencias entre fuentes, resueltas a favor del plan por ser posterior y más concreto:

- `DP-027`: el análisis decía «Se ajusta» y el plan «Se mantiene».
- La preparación como paso interno: el análisis la asignaba al cambio 3 y el plan a U6.

## Decisiones y recomendaciones

- **Confirmadas por el titular (2026-11-01):** usuaria diaria con todos los roles, «Cobrar y facturar», reemplazo visual con prototipo previo, nombre comercial, correo con casilla, búsqueda global, orden y actualización de la documentación.
- **Aprobadas por el titular con esta propuesta (2026-11-03):** la salida de cada choque marcado **Nuevo**, la razón social como respaldo, los términos de `DP-036` y la asignación de la captura a U6 y de la medición real a U2.

## Fuentes consultadas

`docs/analisis-del-sistema.md`, `docs/cambios-pendientes.md`, `docs/negocio/decisiones/decisiones-confirmadas.yaml`, `docs/arquitectura/modelo-dominio.md`, `PRODUCT.md`, `DESIGN.md`, `docs/negocio/requisitos/requisitos-no-funcionales.md`, `interfaz-y-navegacion.md` y `actores-y-roles.md`; búsquedas dirigidas en `vision.md`, `alcance-v1.md`, `reglas-negocio.md`, `glosario.md`, `requisitos-funcionales.md` y `casos-de-uso.md`; y requisitos de las specs `modelo-dominio-taller`, `sistema-visual-frontend`, `patrones-de-pantalla-frontend`, `experiencia-adaptable-frontend`, `autorizacion-y-navegacion`, `pagina-de-inicio`, `ordenes-de-mantenimiento`, `gestion-de-clientes`, `preparacion-y-seguimiento-fiscal`, `configuracion-operativa-y-fiscal`, `pagos-comerciales-y-credito-simple` y `pagos-artesanales-y-credito-simple`. También la propuesta archivada `incorporar-facturacion-electronica-en-v1`, como precedente. `docs/negocio/historico/` no se consultó.
