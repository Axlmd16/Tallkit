## Why

Hoy, cobrar y dejar lista la factura de una atención en Tallkit obliga a recorrer varias pantallas y confirmaciones repetidas: en un mantenimiento con repuesto la usuaria diaria debe abrir la venta vinculada, confirmarla, cobrarla, preparar su factura, volver a la orden, generar la operación de servicios, confirmarla, cobrarla, preparar la segunda factura y finalmente cerrar la orden (47 acciones en la línea base; 25 en un servicio simple; 16 en una venta de mostrador). Con U3 (sistema visual), U4 (menú y lenguaje), U4b (pantallas diarias) y U5 (búsqueda global) ya cerrados en `master`, U6 completa la etapa 0 («usar el sistema a diario») mediante el flujo **«Cobrar y facturar»** aprobado en `DP-036`, antes de incorporar la emisión electrónica real en el cambio 3.

## What Changes

- **Pantalla única «Cobrar y facturar» (mantenimiento y venta):**
  - Accesible desde la ficha del mantenimiento (reemplazando el desvío temporal de U4b a los cobros separados) y desde la ficha de una venta o la venta rápida de mostrador.
  - Muestra en una sola vista, con los valores revisados por el servidor y el nombre comercial de cada negocio (`DP-036`, regla 3), las dos partes independientes cuando correspondan: **servicios (negocio artesanal)** y **repuestos (negocio comercial)**, cada una con sus líneas, su importe y su propia factura.
  - Ejecuta por dentro, en orden y **sin mezclar nada entre entidades fiscales**:
    1. Comprobación previa en el servidor (permisos, stock disponible, precios vigentes, configuración fiscal del emisor, requisitos de cierre y correo del receptor).
    2. Confirmación de la operación artesanal (documentando una sola vez las líneas iniciales pendientes, `DP-029`) y/o confirmación de la venta comercial vinculada o directa.
    3. Registro de cobros independientes por operación (`DP-013`), en **Efectivo**, **Transferencia**, combinación de ambos, o condición **Crédito («Queda debiendo»)** (`DP-003`), admitiendo pago parcial indicado explícitamente por negocio y cálculo orientativo de vuelto en efectivo.
    4. Preparación local de cada factura independiente (una por negocio), usando la instantánea fiscal vigente de formato 4 (`DP-035`) y el plazo en días cuando quede saldo a crédito, **sin transmisión ni autorización ante el SRI** hasta el cambio 3 (`DP-034`, regla 8).
    5. Cierre opcional de la orden de mantenimiento cuando el usuario lo marca y se cumplen sus requisitos (`DP-021`, `ordenes-de-mantenimiento`).
- **Tolerancia a fallos parciales y transparencia (`DP-034`, regla 5):**
  - Si un paso posterior falla (por ejemplo, la preparación fiscal por un dato incompleto del emisor o del receptor), la venta, la operación artesanal y los cobros ya registrados quedan en firme; la pantalla informa claramente qué quedó completado y qué quedó pendiente para reintentar o corregir sin duplicar documentos ni cobros.
- **Guardado opcional del correo en la ficha del cliente (`DP-036`, regla 4; ajusta `DP-035`, regla 1):**
  - En «Cobrar y facturar» (y al completar una preparación fiscal), una casilla activada por omisión guarda el correo del comprador en la ficha del cliente cuando el usuario tiene permiso para editar clientes, dejando constancia en auditoría.
  - Si el cliente ya tenía otro correo registrado, se muestran ambos antes de reemplazarlo. Si la casilla se desactiva o el usuario no tiene permiso para editar clientes, el correo queda solo en la factura. Registrar un cliente sigue sin exigir correo (`DP-008`).
- **Confirmación única sin diálogos redundantes (`DP-036`, regla 2; ajusta `PPF-06`, `RNF-USA-003`, §8.1):**
  - La pantalla «Cobrar y facturar» actúa como revisión y confirmación única de las acciones que agrupa. Las acciones fuera de este flujo (anulaciones, devoluciones, reaperturas, etc.) mantienen su diálogo de confirmación `PPF-06`.
- **Autorización estricta por rol (`CT-001`, `actores-y-roles.md`):**
  - La usuaria diaria (tres roles) o el Administrador ven y ejecutan ambos negocios.
  - Un Encargado del taller sin rol comercial solo ve y ejecuta la parte de servicios (y el cierre de la orden si no hay repuestos pendientes).
  - Un Vendedor sin rol de taller solo ve y ejecuta la parte comercial de repuestos/ventas.
- **Columna «Falta facturar» en Inicio y reducción de pasos hacia `RNF-USA-013…015`:**
  - Se habilita en Inicio la columna «Falta facturar» prevista en U4b para operaciones confirmadas sin factura local preparada, separada por negocio y filtrada por permisos, con acceso directo a completar su factura.
  - Se pulen las fricciones previas del recorrido (selección automática de vehículo único al elegir cliente en el modal de mantenimiento, cierre sin ventana redundante dentro de «Cobrar y facturar» y venta rápida con factura preparada en un solo paso) para verificar los objetivos `RNF-USA-013` (8–10 acciones), `RNF-USA-014` (5–6 acciones) y `RNF-USA-015` (12–14 acciones) con el método `RNF-USA-016`.
- **Registro de `DP-037` y verificación diferida del cambio 2:**
  - Al aprobarse esta propuesta se registra la decisión `DP-037` con los criterios cerrados para U6.
  - Al verificar U6 se ejecuta también la verificación pendiente de `alinear-datos-del-comprobante-con-sri` (cambio 2), aplazada por el titular el 2026-11-01 hasta después del rediseño.

## Capabilities

### New Capabilities

- `cobro-y-facturacion-en-un-paso`: flujo unificado «Cobrar y facturar» desde mantenimiento y desde venta/venta rápida, con prevalidación en el servidor, ejecución separada por entidad fiscal (confirmación de operación/venta, cobros independientes por negocio, preparación local de facturas, guardado opcional del correo en el cliente y cierre opcional de la orden), manejo claro de fallos parciales y autorización estricta por rol.

### Modified Capabilities

- `preparacion-y-seguimiento-fiscal`: incorpora el guardado opcional del correo del receptor en la ficha del cliente (`DP-036`, regla 4, con aviso ante reemplazo y auditoría) y permite invocar la preparación fiscal como paso interno del flujo «Cobrar y facturar» conservando la pantalla de preparación detallada para casos con información adicional o correcciones.
- `resumen-economico-del-mantenimiento`: ajusta la prohibición de acción conjunta en la orden para admitir la entrada «Cobrar y facturar» (`DP-036`, regla 2) siempre que muestre ambos importes por separado, registre cobros independientes y respete los permisos por negocio.
- `patrones-de-pantalla-frontend`: aplica el ajuste pendiente de `PPF-06` para que «Cobrar y facturar» funcione como confirmación única de las acciones que contiene, manteniendo `PPF-06` intacto fuera de ella.
- `pagina-de-inicio`: agrega la columna «Falta facturar» con operaciones confirmadas sin preparación fiscal completada, separadas por negocio, filtradas por permisos y sin presentarlas como enviadas ni autorizadas.
- `objetivos-de-uso-diario`: habilita la verificación de `RNF-USA-013`, `RNF-USA-014` y `RNF-USA-015` mediante `RNF-USA-016` al cerrar U6.

## Análisis de choques y decisiones por aprobar

Siguiendo la «Regla para cada cambio» de `docs/cambios-pendientes.md`, se contrastaron las decisiones confirmadas, el modelo de dominio, las reglas y las specs vigentes:

| # | Regla / decisión afectada | Análisis de impacto | Salida propuesta |
|---|---|---|---|
| 1 | `interfaz-y-navegacion.md` §6.6 (sin botón único que reparta dinero entre los dos RUC) | Mantener la prohibición literal impide el flujo único; ajustarla mostrando ambos importes por separado y registrando dos pagos independientes preserva `DP-013`, `RN-FIS-008` y cajas separadas (`DP-019`). | **Se ajusta** (ya acordado en `DP-036`, regla 2). Repartir en silencio sigue prohibido; pago parcial se indica por negocio. |
| 2 | `DP-029` y `operacion-artesanal-de-servicios` (documentación única de líneas iniciales de servicio) | Cambiar esta regla duplicaría deuda o impuestos. Mantenerla permite que «Cobrar y facturar» documente una sola vez las líneas iniciales pendientes, o cobre/facture una operación ya confirmada. | **Se mantiene.** |
| 3 | `actores-y-roles.md` (el Encargado del taller no confirma ni cobra ventas de repuestos; el Vendedor no opera servicios) | Ampliar permisos rompería `CT-001` y la separación de funciones (§5). Mantenerlos garantiza que la usuaria diaria (3 roles) opere ambos bloques y quien tenga un solo rol opere únicamente su negocio. | **Se mantiene.** |
| 4 | `preparacion-y-seguimiento-fiscal` y `DP-035` regla 1 (pantalla propia obligatoria y correo sin mutar la ficha del cliente) | Exigir abrir una pantalla aparte por cada factura impide cumplir `RNF-USA-013…015`. Ejecutar la preparación como paso interno y guardar el correo con casilla activada por omisión (y aviso si reemplaza otro correo, auditado) respeta `DP-036` regla 4 y mantiene la pantalla detallada para casos especiales. | **Se ajusta** (`DP-036`, regla 4). |
| 5 | `DP-021` y `ordenes-de-mantenimiento` — **¿«Cobrar y facturar» puede finalizar la orden?** | Si no cierra la orden, la usuaria debe volver a la ficha y finalizar aparte (sumando acciones a `RNF-USA-013` y `RNF-USA-015`). Si se mantiene `DP-021` (el botón «Finalizar» nunca confirma la venta) y en «Cobrar y facturar» se ofrece una casilla **«Cerrar el mantenimiento al cobrar»** (marcada por omisión cuando el usuario tiene `mantenimientos.finalizar` y la orden tiene diagnóstico y al menos un servicio), el cierre se ejecuta *después* de confirmar la venta vinculada, sin violar `DP-021`. | **Recomendación (A):** incluir la casilla «Cerrar el mantenimiento al cobrar» activada por omisión cuando se cumplen los requisitos de finalización. **Alternativa (B):** no cerrar desde «Cobrar y facturar» y exigir volver a la orden. |
| 6 | Medio de pago **«Tarjeta»** visible en el prototipo `Cobrar.dc.html` frente a `DP-003` | `DP-003` limita V1 a `EFECTIVO` y `TRANSFERENCIA` (combinables) y condición `CREDITO`. Introducir tarjeta exige decidir forma de pago SRI, cierre de caja (`DP-019`) y retenciones. | **Se mantiene `DP-003`:** omitir «Tarjeta» (igual que en Venta rápida de U4b); ofrecer Efectivo, Transferencia, combinación de ambos y «Queda debiendo» (Crédito). |
| 7 | Etiqueta de estado fiscal en «Cobrar y facturar» antes del cambio 3 (`DP-034`, regla 8; `RF-FIS-002`) | El prototipo muestra «Factura solicitada» y «se enviarán a…», pero mientras no exista el cambio 3 el sistema solo guarda preparaciones locales en modo pruebas y **no transmite ni envía correos**. | **Recomendación (A):** al completar el paso fiscal en U6, mostrar claramente estado local **«Factura preparada (sin enviar)»** y aviso de pruebas, reservando «Solicitada / Autorizada» para el cambio 3. **Alternativa (B):** mostrar «Factura solicitada» con nota aclaratoria de modo pruebas (riesgo de contradecir `DP-034` regla 8 y U4). |
| 8 | **¿Permitir «Cobrar sin facturar» desde la misma pantalla o exigir siempre ambos pasos?** | En el taller a veces falta la configuración fiscal o el cliente aún no da su correo, pero ya paga (`DP-034` regla 5; `DP-035` regla 1: confirmar y cobrar nunca exigen correo). | **Recomendación (A):** la acción principal es «Cobrar y facturar» (cuando los datos fiscales están listos); si falta correo o la preparación fiscal está bloqueada, ofrecer acción secundaria explícita **«Solo cobrar (facturar después)»** para no frenar la caja y dejar la operación visible en «Falta facturar». **Alternativa (B):** bloquear el cobro hasta completar el correo. |
| 9 | **Retenciones recibidas (`DP-032`) y pago combinado (Efectivo + Transferencia) en «Cobrar y facturar»** | La mayoría de los cobros son de un solo medio, pero algunos clientes agentes de retención pagan menos y otros combinan efectivo + transferencia. | **Recomendación (A):** mantener el flujo principal simple (un clic para Efectivo, Transferencia o Crédito) con opción desplegable en la misma pantalla para pago combinado (Efectivo + Transferencia) y para registrar retención cuando el cliente/entidad lo admite, dejando el completado posterior del comprobante de retención en su pantalla actual. **Alternativa (B):** derivar cobros con retención a la pantalla de cobro individual de cada documento. |
| 10 | **Evaluación de ADR para la coordinación transversal** (`docs/cambios-pendientes.md` U6) | Coordinar mantenimiento, ventas, pagos, clientes y fiscal desde un flujo único define fronteras transaccionales duraderas (qué es atómico por operación y qué tolera fallo parcial). | **Recomendación:** evaluar y, si aplica al concretar el diseño técnico, documentar la frontera de orquestación y compensación en un ADR durante la fase `design`. |

## Impact

- **Usuarios afectados:** usuaria diaria (3 roles acumulados), Administrador, Vendedor y Encargado del taller. Cada rol opera únicamente lo que sus permisos efectivos autorizan en el servidor.
- **Backend y API:**
  - Nueva coordinación de aplicación de prevalidación y ejecución por pasos de «Cobrar y facturar» (reutilizando los servicios de dominio existentes de taller, ventas, pagos, clientes y fiscal, sin mutar modelos ajenos ni mezclar transacciones económicas entre RUC).
  - Extensión controlada del servicio de preparación fiscal / clientes para persistir opcionalmente el correo del receptor en la ficha del cliente con auditoría y verificación de permiso de edición de clientes.
  - Consulta de operaciones confirmadas sin factura preparada para la columna «Falta facturar» de Inicio, filtrada por permisos y separada por negocio.
  - No se prevén cambios destructivos en datos existentes ni mezclas de tablas entre RUC.
- **Frontend:**
  - Nueva pantalla «Cobrar y facturar» (basada en el prototipo aprobado `docs/prototipo/Cobrar.dc.html`, ajustada a `DP-003` y `DP-034` regla 8), accesible desde la ficha del mantenimiento y desde ventas / venta rápida.
  - Integración de la preparación fiscal en Venta rápida y habilitación de la columna «Falta facturar» en Inicio.
  - Ajustes menores de ergonomía en el modal «Nuevo mantenimiento» (preselección automática cuando el cliente tiene un solo vehículo) para cumplir `RNF-USA-013…015`.
- **Operación y documentación:**
  - Registro de `DP-037` en `docs/negocio/decisiones/decisiones-confirmadas.yaml` al aprobar.
  - Verificación de `alinear-datos-del-comprobante-con-sri` (cambio 2) al cerrar U6.
  - Medición documentada de `RNF-USA-013`, `RNF-USA-014` y `RNF-USA-015` con el método `RNF-USA-016`.
- **Nivel de riesgo y pruebas (según `AGENTS.md`):**
  - **Alto (TDD):** separación fiscal en la orquestación, atomicidad por operación, idempotencia ante reintentos/doble envío, fallos parciales (cobro en firme si falla la preparación fiscal), autorización por rol y combinaciones de roles, guardado opcional de correo con auditoría y permiso de cliente, y cierre condicionado a `DP-021`.
  - **Medio (prueba al final):** flujos de la pantalla «Cobrar y facturar», Venta rápida con factura preparada y columna «Falta facturar» en Inicio.
- **Dependencias:** U3, U4, U4b y U5 ya archivados en `master`. El cambio 3 (`emitir-comprobantes-electronicos`) se apoyará en este flujo para reemplazar el paso final de preparación local por la solicitud de emisión mediante el adaptador neutral.
- **Riesgos:**
  - **Fallo a mitad del flujo (parcialidad):** que la venta comercial quede confirmada y cobrada, pero falle la operación artesanal o la preparación fiscal. Mitigación: prevalidación estricta antes de ejecutar, claves de idempotencia por paso y pantalla de resultado que muestra claramente qué quedó hecho y permite completar lo pendiente sin duplicar.
  - **Mezcla accidental entre RUC o reparto silencioso de dinero:** mitigación mediante servicios separados por entidad fiscal, importes explícitos por negocio en pago parcial y pruebas negativas de separación.
  - **Sobrescritura inadvertida del correo del cliente:** mitigación mostrando el correo anterior y el nuevo antes de reemplazarlo y exigiendo permiso de edición de clientes.
  - **Falsa impresión de factura autorizada por el SRI:** mitigación usando etiquetas explícitas de preparación local en modo pruebas (`DP-034`, regla 8).

## Fuera de alcance

- Emisión electrónica real, firma, conexión con Factuplan o el SRI, generación/descarga de RIDE y envío real de correos electrónicos (corresponden a los cambios 3, 4 y 5).
- Venta a consumidor final sin cliente registrado en el sistema (corresponde al cambio 6; aquí solo aplica la elección explícita de receptor «Consumidor final» ya existente en `preparacion-y-seguimiento-fiscal` para montos ≤ USD 50).
- Medio de pago con tarjeta de crédito/débito (`DP-003`).
- Notas de crédito, anulaciones fiscales ante el SRI, devoluciones desde «Cobrar y facturar» o cierre de caja diario (cambios 7 y 8).
- Cambios en las tablas de roles/permisos (`CT-001`), descuentos (`DP-004`) o flexibilización de stock negativo (`DP-002`).

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` (completo; en especial `CT-001`, `DP-002`, `DP-003`, `DP-004`, `DP-006`, `DP-008`, `DP-013`, `DP-017`, `DP-018`, `DP-019`, `DP-021`, `DP-025`, `DP-027`, `DP-029`, `DP-032`, `DP-034`, `DP-035`, `DP-036`).
- `docs/arquitectura/modelo-dominio.md` (completo; invariantes 1, 2, 6, 11, 14, 16, 17, 24 y 25; §3, §7, §11.6, §11.7 y §11.8).
- `docs/cambios-pendientes.md` (secciones «Regla para cada cambio», U1, U4, U4b, U6 y cambio 2).
- `docs/analisis-del-sistema.md` (§8.3 y anexo de línea base de acciones).
- `docs/plan-pantallas-prototipo.md` (§1.1, §1.2, §1.3 y §1.4).
- `docs/prototipo/Cobrar.dc.html` (pantalla 3 aprobada en U2).
- `docs/negocio/producto/reglas-negocio.md` (`RN-CLI-003`, `RN-FIS-008`, `RN-FIS-009`, `RN-VEN-008`, `RN-TAL-004`, `RN-TAL-014`).
- `docs/negocio/requisitos/actores-y-roles.md` (§3, §4 y §5).
- `docs/negocio/requisitos/requisitos-funcionales.md` (`RF-PAG-010`, `RF-TAL-011`, `RF-TAL-012`, `RF-FIS-001`, `RF-FIS-002`).
- `docs/negocio/requisitos/requisitos-no-funcionales.md` (`RNF-USA-003`, `RNF-USA-010`, `RNF-USA-013…016`).
- `docs/negocio/requisitos/interfaz-y-navegacion.md` (§6.6 y §8.1).
- `openspec/specs/objetivos-de-uso-diario/spec.md`, `openspec/specs/resumen-economico-del-mantenimiento/spec.md`, `openspec/specs/patrones-de-pantalla-frontend/spec.md`, `openspec/specs/preparacion-y-seguimiento-fiscal/spec.md`, `openspec/specs/operacion-artesanal-de-servicios/spec.md` y `openspec/specs/ordenes-de-mantenimiento/spec.md`.

**Contradicciones registradas:**
1. El prototipo `docs/prototipo/Cobrar.dc.html` incluye «Tarjeta» como medio de pago y las leyendas «Factura solicitada» / «se enviarán a…»; prevalecen `DP-003` (solo Efectivo y Transferencia, con Crédito como condición) y `DP-034` regla 8 (preparación local en pruebas, sin transmisión ni envío real hasta el cambio 3).
2. `openspec/specs/resumen-economico-del-mantenimiento/spec.md` prohíbe cualquier acción de cobro sobre la orden en conjunto; se ajusta en U6 conforme a `DP-036` regla 2 para admitir «Cobrar y facturar» con dos importes, dos cobros y dos facturas independientes.
3. `openspec/specs/preparacion-y-seguimiento-fiscal/spec.md` prohíbe escribir el correo del receptor en la ficha del cliente; se ajusta en U6 conforme a `DP-036` regla 4 mediante casilla explícita activada por omisión, aviso ante reemplazo, permiso de edición de clientes y auditoría.

**Información insuficiente / decisiones abiertas:** las decisiones #5 (cierre opcional del mantenimiento al cobrar), #7 (etiqueta local de estado fiscal antes del cambio 3), #8 (acción secundaria «Solo cobrar» cuando falta correo o hay bloqueo fiscal) y #9 (manejo de pago combinado y retenciones dentro de «Cobrar y facturar») se presentan arriba con recomendación para aprobación explícita antes de redactar las specs.
