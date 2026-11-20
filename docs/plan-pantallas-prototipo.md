# Plan de implementación · Pantallas del prototipo U2

Este plan aplica en el frontend las pantallas del prototipo aprobado
(`docs/prototipo/`, PDF «Tallkit · Prototipo U2» de 19 pantallas). U3 aplicó los colores y
componentes, y U4 el menú y el lenguaje. Ninguno de los dos cambió la disposición de las pantallas.

**Excepción decidida por el titular (2026-11-14):** este trabajo **no** pasa por OpenSpec (sin
propuesta, specs, diseño ni tareas), porque la entrega es pronto. Este documento es el plan y de aquí se
pasa directo al código. Las reglas del negocio no cambian:
- las decisiones `DP-*` siguen vigentes;
- los permisos los decide el servidor;
- no se mezclan los dos negocios en un mismo documento ni en un total;
- la emisión real sigue deshabilitada (`DP-034`, regla 8).

Si una pantalla exige cambiar una regla del negocio, esa parte se aparta y se anota abajo, en
«Fuera de este plan».

## Reglas de trabajo

- **Presentación primero.** Se reutilizan los endpoints que ya existen. Un endpoint nuevo solo se
  agrega si la pantalla no puede armarse sin él, y siempre de solo lectura.
- **Pruebas, solo las necesarias:**
  - Se ejecutan únicamente las pruebas de los archivos que se tocan.
  - Hay prueba nueva solo cuando se toca dinero, permisos o la separación entre negocios, o cuando
    aparece un endpoint nuevo.
  - La maquetación, los textos y los colores no llevan prueba nueva: alcanza con lint, tipos y una
    revisión visual.
  - Una prueba existente que fija la disposición anterior se ajusta, no se borra.
  - Nunca se corre la suite completa ni E2E salvo que el titular lo pida.
- **Datos de ejemplo.** Los nombres, importes y números del prototipo son de ejemplo; se muestran los
  datos reales del servidor.
- **Avance.** Cada pantalla se marca aquí al terminarla. Cada fase cierra con lint, tipos y las pruebas
  de lo tocado.

## Fase 1 · Trabajo diario

Es la que más se usa. Va antes de U5 (búsqueda) y U6 (cobrar y facturar), que se apoyan en ella.

### 1.1 Inicio (pantalla 1)
- Banda grafito arriba con:
  - fecha y pregunta «¿Qué llegó al taller?»;
  - campo de búsqueda grande, que de momento abre la lista filtrada y pasa a búsqueda global con U5;
  - botones «Nuevo mantenimiento» y «Venta rápida».
- Recuadro «Cobrado hoy»: anillo por negocio con el importe de cada uno. Sale de la respuesta de
  cobros del inicio, tomando solo el día de hoy. Cada negocio va con su importe y no hay total conjunto.
- Tres columnas de tarjetas en lugar de los paneles actuales:
  - **En el taller:** placa, cliente, vehículo, estado, número, hora y total.
  - **Falta cobrar:** negocio, cliente, documento, saldo, estado del plazo y botón «Cobrar», que lleva
    al cobro existente.
  - **Falta facturar:** se muestra solo cuando U6 o la emisión existan; hoy se omite.
- Los bloques actuales (pendientes y gráfico de 7 días) dejan de verse si no están en el prototipo.
- Prueba: ajustar `HomePage.test.tsx` sin perder los casos de permisos y de separación de negocios.

### 1.2 Nuevo mantenimiento en modal (pantalla 1a)
- Modal en dos columnas:
  - **Izquierda:** buscador «¿Qué vehículo llegó?» por placa o cliente, con la lista de coincidencias y
    el acceso «+ Cliente o vehículo que no está registrado».
  - **Derecha:** tarjeta grafito del vehículo (placa, modelo, dueño, último kilometraje y última
    visita), aviso de deuda si la hay, «Kilometraje de hoy» y chips de «Lo que pide el cliente».
- Botón «Abrir mantenimiento». Se abre desde Inicio, desde la lista y desde la ficha del cliente.
- Datos: búsqueda de vehículos existente, última orden del vehículo y deuda del cliente (cuentas por
  cobrar por `customer_id`).
- Los chips llenan el motivo de ingreso existente; no se agrega un campo nuevo.
- Prueba: el flujo de crear (reutilizar la prueba del editor actual).

### 1.3 Ficha del mantenimiento (pantalla 2)
- **Cabecera:**
  - número, hora de llegada, cliente en grande, placa, vehículo y kilometraje;
  - botones «Finalizar» y «Cobrar y facturar USD x», con el desglose mano de obra + repuestos. Hasta
    U6, este botón lleva a los cobros actuales de cada negocio.
- **Franja de estado:** estado del mantenimiento, y por negocio su cobro y su factura.
- **Pestañas:** Trabajo, Vehículo e Historial.
- **Trabajo:**
  - un solo buscador «Agregar servicio o repuesto»;
  - un bloque por negocio con sus líneas: nota para la factura, cantidad con − y +, «Quedan n» y botón
    para quitar.
- **Columna derecha:**
  - «Resumen»: importe por negocio y «Total a cobrar», con la nota «Se harán 2 cobros y 2 facturas»;
  - «Lo que pide el cliente».
- Prueba: ajustar `MaintenanceOrderDetailPage.test.tsx`. Se conservan los casos de permisos por negocio.

### 1.4 Venta rápida (pantalla 4)
- Pantalla de mostrador:
  - bloque «Cliente» (buscador y «Consumidor final»);
  - bloque «Productos» (buscador o lector de códigos, cantidades);
  - columna «Total a cobrar» con «¿Cómo paga?» y el botón principal.
- Usa el borrador de venta existente. Al cobrar encadena **confirmar** y **registrar cobro** con los
  endpoints actuales; si falla el cobro, la venta queda confirmada y se avisa. La factura llega con U6.
- Formas de pago: Efectivo, Transferencia y «Queda debiendo» (venta a crédito). «Tarjeta» no existe
  en el sistema (ver «Fuera de este plan»).
- Valor inicial «Contado», lo que resuelve el arreglo pendiente de «Crédito».
- Prueba: el encadenado confirmar → cobrar y el caso en que falla el cobro (toca dinero).

## Fase 2 · Listas y fichas

### 2.1 Mantenimientos (pantalla 7)
- Cabecera con el nombre del negocio y el botón «Nuevo mantenimiento», que abre el modal 1.2.
- «En el taller ahora»: tarjetas grafito de los abiertos y la tarjeta «+ Recibir vehículo».
- Segmentos Todos, Abiertos, Reabiertos y Finalizados con su contador: agregar `reopened` a
  `status_counts` en el backend, con una prueba en `test_home_summary.py`.
- Tabla con: número, vehículo (placa y modelo), cliente, abierto (fecha y km), estado, «Cobro y
  factura» por negocio y total.
- La columna «Cobro y factura» necesita el estado de cobro de cada negocio en la lista. Si la lista no
  lo trae, se agrega como campo de solo lectura, con una prueba de que no mezcla negocios.

### 2.2 Ventas y proformas (pantalla 8)
- Cabecera con «Nueva proforma» y «Venta rápida».
- Cuatro indicadores:
  - **Vendido hoy:** del resumen del inicio.
  - **Ventas de hoy:** de la lista filtrada por fecha.
  - **Quedaron debiendo:** total por cobrar de repuestos.
  - **Proformas vigentes:** de la lista filtrada por estado.
- Pestañas Ventas y Proformas.
- Tabla de ventas con: número y hora, cliente y productos, forma de pago, cobro y total. La columna
  «Factura» se muestra solo con el estado local («Sin pedir» o «Preparada»), nunca «Solicitada» ni
  «Autorizada».

### 2.3 Facturas (pantalla 9)
- Cabecera con el aviso «Facturación de prueba».
- Segmentos por estado y por negocio; tabla de número y cliente, «Viene de», estado y total; panel
  derecho con el detalle de la fila elegida.
- Se apoya en la lista local de U4. Los estados del prototipo «Solicitada» y «Rechazada» no existen
  hasta la emisión real: se muestran «Borrador», «Preparada, sin enviar» y «Cancelada».

### 2.4 Clientes (pantalla 10)
- Maestro y detalle:
  - **Izquierda:** lista agrupada por letra, con buscador, segmentos Todos, Con deuda y Empresas, y la
    deuda en rojo.
  - **Derecha:** tarjeta del cliente elegido con sus datos, «Este año», «Debe», vehículos, «Lo último»
    y las acciones «Nuevo mantenimiento», «Venta rápida» y «Registrar pago».
- Ya existe el componente `MasterDetail`.
- Los segmentos «Con deuda» y «Este año» necesitan datos agregados por cliente. Se agregan en una sola
  lectura nueva por cliente (deuda por negocio y gasto del año), con una prueba de permisos y de
  separación por negocio.

### 2.5 Ficha del cliente (pantalla 5)
- Cabecera con avatar, «Cliente desde», contacto y los botones Editar, «Venta rápida» y «Nuevo
  mantenimiento».
- Indicadores: visitas del año, gastado del año, última visita y «Debe». La deuda se muestra por
  negocio, nunca sumada; si el prototipo pide un solo número, van dos.
- Pestañas Vehículos (tarjetas grafito), Historial y Deuda, sobre la ficha por pestañas de U4.

### 2.6 Productos (pantalla 11)
- Cabecera con «Nuevo producto», «Imprimir etiquetas» y «Entrada de mercadería».
- Indicadores: productos activos, marcas y agotados.
- Segmentos por categoría y «Agotados».
- Tabla con: código, producto y presentación, marca con su sigla, número del fabricante, categoría,
  «Quedan» (existencia de U4, solo con permiso de inventario) y precio.

### 2.7 Ficha del producto (pantalla 11a)
- Cabecera con «Ajustar stock», «Imprimir etiqueta» y «Registrar entrada».
- **Tarjeta grafito:** «Quedan en bodega», con lo que entró y salió en los últimos 30 días.
- **Precio:**
  - El precio de venta lo ve todo el que ve el producto.
  - El costo promedio y la ganancia por unidad, solo quien tiene permiso de valoración.
- **Proveedor de la última entrada.**
- Pestañas «Movimientos» (con filtros Todos, Entradas y Salidas) y «Datos del producto».
- Prueba: que el costo y la ganancia no aparezcan sin permiso de valoración.

### 2.8 Entrada de mercadería (pantalla 11b)
- Proveedor y número de factura, ambos opcionales.
- Tabla de productos con: cantidad (− y +), costo por unidad, subtotal y «Hay n · quedarán m».
- Resumen con el total a costo, la opción «Imprimir etiquetas al guardar» y el botón «Guardar entrada».
- Usa el flujo de entradas existente.

### 2.9 Servicios (pantalla 12)
- Buscador, segmentos Activos, Inactivos y Todos, y tabla con código, servicio y descripción, precio
  de lista, estado y «Editar». Formulario en modal.

### 2.10 Cuentas (pantalla 13)
- En lugar de las pestañas actuales, dos tarjetas de negocio con «Le deben» y el número por cobrar y
  de retenciones. Elegir una tarjeta cambia la tabla.
- Segmentos «Por cobrar» y «Retenciones».
- Tabla con: cliente y documento, desde, plazo (vence o vencido) y saldo, más el botón «Registrar
  pago».
- Se conserva la regla: un usuario con un solo negocio ve solo su tarjeta y nunca un total conjunto.
  Ajustar la prueba de `AuthenticatedShell` o de la página.

## Fase 3 · Ajustes y configuración inicial

### 3.1 Ajustes (pantalla 14)
- Reemplaza la página de opciones de U4.
- Pestañas:
  - **Negocios:** una tarjeta por negocio con logo, nombre, avance «n de 5 datos completos» y filas
    (datos del negocio, logo, numeración, firma electrónica e impuestos), cada una con su estado y su
    enlace a la configuración actual.
  - **Personas con acceso:** usuarios.
  - **Proveedores.**
  - **Marcas:** de vehículos y de productos, con categorías y unidades.
  - **Historial de cambios:** auditoría.
  - **Sistema:** estado técnico.
- Cada pestaña aparece solo con su permiso. El avance de cada negocio sale de la preparación fiscal
  existente.

### 3.2 Configuración inicial (pantalla 14a)
- Asistente de cinco pasos con barra de avance:
  1. Los dos negocios: nombre que verán los clientes y RUC.
  2. Facturación electrónica.
  3. Impuestos.
  4. Personas con acceso.
  5. Listo.
- Cada paso tiene «Hacerlo después» y «Guardar y seguir».
- El paso 1 usa la inicialización existente más el nombre comercial (U4).
- La razón social «que se completa sola con el RUC» exige consultar al SRI: no existe. Se pide a mano
  y se anota abajo.

## Fuera de este plan

| Del prototipo | Motivo | Dónde va |
|---|---|---|
| Búsqueda global (pantalla 6) | Ya tiene su cambio | U5 |
| Cobrar y facturar en un paso (pantalla 3) | Ya tiene su cambio | U6 |
| «Falta facturar», «Solicitada», «Rechazada», «Ver PDF», «Reenviar correo» | No hay emisión real (`DP-034`, regla 8) | U6 y cambio 3 |
| Forma de pago «Tarjeta» | No existe en el sistema; agregarla toca dinero y la factura | Decisión del titular |
| Razón social automática a partir del RUC | No hay consulta al SRI | Diferido |
| «Repetir la guía inicial» | Depende de 3.2 | Después de la fase 3 |
| Estado «cancelado» de un mantenimiento | No existe en el código | Brecha registrada en U4 |
| «Consumidor final» en la venta rápida | Toda venta exige un cliente registrado y las reglas de consumidor final están pendientes (`FUT-001`) | Decisión del titular |
| «Correo para la factura» en la venta rápida | Es parte de facturar; hoy sale el recibo interno | U6 |
| «Ganancia por unidad» y «Proveedor de la última entrada» en la ficha del producto (2.7) | La ganancia exige el precio sin impuesto y el costo calculados por el servidor; el proveedor vive en Entradas y no en el Kardex | Campo de solo lectura en el servidor |
| «Ajustar stock» en la ficha del producto (2.7) | No existe una pantalla de ajustes manuales | Cambio de inventario |
| «Plazo (vence o vencido)» en Cuentas (2.10) | Las ventas y los servicios guardan antigüedad, no fecha de vencimiento | Decisión del titular |
| «Registrar retención» desde Cuentas (2.10) | Hoy las retenciones se completan desde el cobro y su lista de pendientes | Después de U6 |
| «Lo que pide el cliente» como campo propio | La spec de órdenes dice que no existe motivo de ingreso; los chips se guardan en las observaciones | Brecha plan/spec registrada |

## Notas de la fase 2

- **2.1** La lista trae el cobro de cada negocio (`billing`: repuestos y servicios por separado, sin total) y `reopened` en `status_counts`.
- **2.4 y 2.5** Dos lecturas nuevas de solo lectura en `/home/customers/` (clientes con deuda y resumen por cliente), con el permiso de cada negocio. «Este año» es el año calendario del negocio.
- **2.8** Los costos se capturan por defecto; el subtotal y el total a costo son una referencia y el servidor los recalcula al revisar. «Imprimir etiquetas al guardar» imprime las líneas de la entrada.
- **2.10** Las pestañas por negocio del marco se reemplazaron por las tarjetas de la pantalla; cada negocio sigue en su propia ruta.

## Avance

- [x] Fase 1: 1.1, 1.2, 1.3 (rediseñada con la versión nueva del prototipo, 2026-11-15) y 1.4 (`/sales/quick`)
- [x] Fase 2: 2.1 a 2.10 (2026-11-19; lo que no entró está en «Fuera de este plan»)
- [ ] Fase 3: 3.1, 3.2
