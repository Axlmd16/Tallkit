# Análisis del sistema Tallkit

| Campo | Valor |
|---|---|
| Fecha | 2026-11-01 |
| Motivo | El sistema resulta difícil de usar incluso para quien lo desarrolla |
| Estado | Decisiones respondidas (sección 11). Ninguna regla vigente cambia hasta registrarlas |
| Rama revisada | `develop`, con los cambios sin registrar de `alinear-datos-del-comprobante-con-sri` |

## 1. Conclusión

**El problema es real, y no se arregla con un cambio de colores.** El sistema funciona y sus reglas son sólidas, pero está organizado como lo piensa la contabilidad, no como trabaja el dueño del taller.

Lo más importante:

1. **Hoy no se puede emitir una factura.** El recorrido termina en «Datos listos», una pantalla sin ningún botón. La emisión son los cambios 3 y 4, todavía sin hacer.
2. **Llegar a esa pantalla cuesta demasiado.** Un cambio de aceite a un cliente ya registrado exige 18 acciones. Un mantenimiento con un repuesto, de principio a fin, exige 47.
3. **La factura no existe como lugar.** No hay «Facturas» en el menú, ni una lista, ni un aviso de facturas pendientes en el Inicio.
4. **La pantalla habla como el modelo de datos.** El usuario ve `ART-SER-000001`, «Operación de servicios», «Exigible vigente», «Datos listos».
5. **Lo visual es exactamente lo que se aprobó en septiembre.** Una interfaz densa y neutra. Los números confirman tu impresión, así que hay que cambiar esa dirección, no corregir un error.

**Mi recomendación:** no reescribir. El backend es un activo valioso. Hay que reorganizar lo que el usuario ve y agregar un flujo único de «Cobrar y facturar». Eso debe hacerse **antes** del cambio 3, porque ese cambio agregaría otro botón «Facturar» dentro de pantallas que ya no funcionan como camino.

## 2. Cómo se hizo

Recorrí el sistema como lo haría un usuario, con un navegador automático contra una base de datos temporal. Sembré un taller realista (8 productos, 5 servicios, 4 clientes, 4 vehículos), conté cada acción y saqué capturas. No se tocó tu base de desarrollo.

- **Cobertura:** 30 rutas en computadora, el Inicio y el menú de los otros dos roles, y muestras en tableta y teléfono (37 capturas medidas), además de las capturas de cada flujo.
- **Fuentes:** `decisiones-confirmadas.yaml`, `modelo-dominio.md`, `vision.md`, `alcance-v1.md`, `interfaz-y-navegacion.md`, `actores-y-roles.md`, `requisitos-no-funcionales.md`, `DESIGN.md`, `PRODUCT.md`, `cambios-pendientes.md`, las rutas y pantallas del frontend, y el módulo fiscal del backend.
- **Límites:** son mínimos de un robot que ya sabe dónde hacer clic. Una persona tarda más porque busca, duda y se equivoca. No medí tiempos, no probé con el cliente real y usé pocos datos. La configuración fiscal se completó por la API, así que su carga solo se contó por pasos.

## 3. Los números

| Tarea, desde el Inicio | Acciones | Clics | Campos | Pantallas | Ventanas |
|---|---:|---:|---:|---:|---:|
| Servicio simple, hasta «Datos listos» | **18** | 15 | 3 | 4 | 2 |
| Servicio simple, con cobro y cierre de la orden | **25** | 21 | 4 | 4 | 4 |
| Venta de un filtro con cobro, hasta «Datos listos» | **16** | 13 | 3 | 4 | 2 |
| Mantenimiento con 1 servicio y 1 repuesto, completo | **47** | 40 | 7 | 6 | 7 |
| Registrar un cliente nuevo | 8 | 4 | 4 | 3 | 0 |

Ninguna de estas tareas termina con una factura entregada al cliente. Elegir de una lista desplegable se contó como una acción, así que las cifras son conservadoras.

| Interfaz | Medido |
|---|---|
| Superficie de contenido con color perceptible, en 15 pantallas principales | **2,5 %** (97,5 % blanco, gris o tinta) |
| Superficie con color fuerte | **0,6 %** |
| Texto entre 12 y 14 px | **90,7 %** de los caracteres |
| Texto en gris apagado | **46,3 %** |
| Peso de la letra | 62,5 % normal, 8,8 % media, 23 % seminegrita, 5,4 % negrita |
| Opciones del menú | 18 en 6 grupos plegados; al entrar solo se ve «Inicio» |
| Rutas | 57 |
| «Comercial», «Artesanal» y «RUC» en pantalla | 117 apariciones en las capturas medidas |

## 4. El camino real hasta la factura

Esto es lo que debe hacer alguien para facturar un cambio de aceite:

| # | Acción | Lo que pasa por la cabeza del usuario |
|---|---|---|
| 1 | Inicio → Nuevo mantenimiento | Bien |
| 2-3 | Buscar y elegir cliente | Bien |
| 4 | Elegir vehículo | Tiene uno solo, pero igual debo elegirlo |
| 5-6 | Kilometraje y diagnóstico | Bien |
| 7 | Registrar orden | Bien |
| 8-11 | Agregar servicio, abrir lista, elegir, confirmar | Cuatro pasos por un servicio |
| 12 | Pestaña «Documentos y cobros» | ¿Por qué aquí? Ningún lado dice «factura» |
| 13-14 | «Generar comprobante de servicios» y confirmar | ¿Esto es la factura? La ventana dice que no |
| 15 | Abrir `ART-SER-000001` | Un código que nunca pedí |
| 16 | Preparar factura | Por fin |
| 17 | Revisar datos | |
| 18 | Confirmar datos | Termino en «Datos listos» |
| | **Pantalla final: ningún botón** | ¿Y ahora qué? |

Tres detalles agravan esto:

- En la ventana del paso 13 la palabra «factura» solo aparece para decir lo que algo **no** es.
- La «operación de servicios» que no encontrabas **no tiene entrada en el menú**. Solo se llega por un número dentro de la tercera pestaña de la orden, o desde cobros y retenciones.
- En una venta de mostrador se revisa tres veces seguidas: «Revisar y confirmar», «Revisar» el cobro y «Revisar datos».

La primera vez es peor. Tras esas 18 acciones, sin configuración fiscal, el **administrador** recibe cinco avisos que dicen «Debe resolverlo el Administrador en Configuración». No traen enlace, y aparecen debajo del botón, fuera de la pantalla.

## 5. Por qué pasó

1. **La interfaz copia el modelo de dominio.** Cada concepto interno se volvió una pantalla o un paso: orden, intervención, línea, operación artesanal, comprobante interno, cobro, preparación fiscal. Cada uno es correcto. Juntos son un trámite.
2. **«Rápido y sencillo» nunca se escribió como requisito.** Esas palabras no aparecen en `vision.md`, `alcance-v1.md` ni `casos-de-uso.md`. Solo hay un principio de «Simplicidad operativa» sin medida. Los 12 requisitos de usabilidad cubren temas como adaptación, teclado y contraste, pero ninguno mide cuánto cuesta una tarea. Se cumplió todo lo escrito, pero lo más importante no estaba escrito.
3. **Los requisitos ordenan mostrar la jerga.** `RNF-USA-009` exige distinguir en pantalla venta, intervención y operación de servicios. `RNF-USA-010` exige mostrar la entidad fiscal. Hay que corregir esas reglas, no solo las pantallas.
4. **Se aceptó por partes, nunca completo.** Cada cambio se verificó con sus pruebas, pero nadie midió el recorrido de punta a punta. La sección 13 de `interfaz-y-navegacion.md` pedía prototipar estos flujos y la revisión visual humana sigue pendiente en varias capacidades.
5. **Lo fiscal se construyó antes de saber cómo se emitiría.** Por eso hay una etapa de «preparación» que hoy es un fin en sí misma. `DP-034` ya definió que el proveedor genera y envía la factura, así que esa etapa debe quedar oculta dentro de un solo paso.

## 6. Hallazgos

Prioridad: **A** impide el uso, **B** lo frena cada día, **C** molesta o confunde.

### 6.1 Flujo y navegación

| Prio. | Hallazgo | Evidencia |
|---|---|---|
| A | No se emite ninguna factura; el camino acaba sin acción | `frontend/src/pages/fiscal/FiscalPreparationPage.tsx:840` |
| A | No existen «Facturas» en el menú, ni lista, ni búsqueda | `frontend/src/app/navigation.ts:57`; `/fiscal/preparations` solo consulta por operación |
| A | Inicio dice «Todo al día» en un sistema sin configurar y no guía la puesta en marcha | `frontend/src/pages/home/PendingBlock.tsx:105` |
| A | La ficha del cliente no muestra sus compras ni lo que debe, aunque `UI-021` lo pide | `frontend/src/pages/customers/CustomerDetailPage.tsx` |
| A | No hay reportes ni cierre de caja (son los cambios 8 y 11, ya planificados) | Sin pantallas |
| B | Avisos sin enlace para resolverlos y dirigidos al mismo administrador que los lee | `backend/src/fiscal/application/impediment_messages.py:28` |
| B | El resultado de «Revisar datos» aparece bajo el botón y no se desplaza hasta él | `FiscalPreparationPage.tsx:711` |
| B | Cada acción vive en un sitio distinto: cabecera, pestaña o columna derecha, según la pantalla | Orden, venta y operación de servicios |
| B | Productos está en «Catálogos» y su stock en «Compras e inventario» | `frontend/src/app/navigation.ts:90,172` |
| B | La lista de productos promete existencias y no las muestra, aunque `UI-030` las pide | `frontend/src/pages/products/ProductsPage.tsx:242` |
| B | Sin búsqueda global: la placa solo se busca dentro de cada lista (exclusión escrita) | `interfaz-y-navegacion.md:37` |
| B | Cobrar es distinto en cada lado: dos pasos en ventas, uno en servicios | `MoneyDialog.tsx` y `BillingDialogs.tsx` |
| B | Crear un cliente obliga a salir de la venta o de la orden | `OrderForm.tsx`, `SaleEditorPage.tsx` |
| C | Las filas abren la ficha al hacer clic, pero nada lo indica | Listas |
| C | `/fiscal/archive` y `/fiscal/corrections` existen sin ningún enlace que lleve a ellas | `frontend/src/app/App.tsx:87,95` |

### 6.2 Errores concretos

Se pueden corregir de inmediato. Los tres primeros pueden causar errores reales.

| Prio. | Hallazgo | Evidencia |
|---|---|---|
| A | **Una venta nueva empieza en «Crédito»**, no en «Contado». Quien no lo cambie deja una deuda sin querer. Ningún documento pide ese valor, y el comprobante de servicios empieza en «Contado» | `frontend/src/features/sales/draft.ts:25` |
| B | En un cobro normal, el botón dice **«Registrar retención»** hasta que se escribe el importe | `BillingDialogs.tsx:296` |
| B | El cobro de contado exige el total, pero obliga a escribirlo a mano | `BillingDialogs.tsx`, `MoneyDialog.tsx` |
| B | El correo se pide en cada factura porque nunca se guarda en el cliente (`DP-035`, regla 1). En el flujo del mantenimiento se escribió dos veces | Flujo C, pasos 28 y 39 |
| C | Precios con seis decimales: `USD 790.000000`, `1.000000 Unidad` | `InventoryPage.tsx:49,120` |
| C | `IVA 0% · 0.0000 %` | `ServiceOperationDetailPage.tsx:253` |
| C | «Versión de registro: 1» en la ficha del cliente | `CustomerDetailPage.tsx:190` |
| C | El selector de producto corta el nombre: se ve `FIL-005 -` | Editor de venta |
| C | Los botones de la venta quedan casi fuera de la pantalla a 1440 × 900 | Editor de venta |
| C | Los avisos flotantes tapan el total y el botón de borrar | Ficha de orden |

### 6.3 Lenguaje

El sistema llama igual a cosas distintas y distinto a la misma cosa. El mismo trabajo de servicios recibe cinco nombres: operación de servicios, operación artesanal, `ART-SER`, comprobante de servicios y comprobante interno.

| Hoy en pantalla | Propuesta | Nota |
|---|---|---|
| Orden, `ART-OT-000001` | Mantenimiento N.º 1 | El cliente dice «mantenimiento» |
| Operación de servicios, `ART-SER` | Nada visible: se resuelve al cobrar | Sigue en el fondo |
| Comprobante interno | Recibo | **No usar «nota de venta»:** en Ecuador es un documento legal distinto |
| Preparar factura, Datos listos | Facturar; Por facturar, Autorizada, Rechazada | Los estados los define el cambio 3 |
| RUC comercial, RUC artesanal, entidad | Repuestos, Taller, negocio | El RUC sigue visible en facturas y ajustes |
| Exigible vigente | Total a pagar | |
| Exceso por reembolsar | A devolver al cliente | |
| Precio referencial, aplicado | Precio de lista, Precio | |
| Kardex | Movimientos | |
| Intervención inicial | Nada visible | |
| Cobros de servicios, Cuentas por cobrar | Cuentas | Una entrada con dos pestañas |
| Efectivo o sin sistema financiero | Efectivo | Código SRI, siempre oculto |
| «Existencias por presentación completa en la bodega única…» | Eliminar | Explicación del modelo, no ayuda |

### 6.4 Visual

Tus quejas se confirman, con un matiz importante:

| Lo que notas | Medido | Causa real |
|---|---|---|
| «Todo blanco» | 97,5 % sin color | Lienzo `#F3F4F6` y paneles `#FFFFFF` casi idénticos; el color queda en etiquetas diminutas |
| «La letra es del mismo peso» | Sí hay pesos, pero casi todo mide lo mismo | **90,7 % entre 12 y 14 px**; títulos de solo 22 px; `font-semibold` usado 462 veces, así que ya nada resalta |
| «Muy cuadrado» | Radios de 4 a 10 px y borde fino en todo | Más que las esquinas, pesan las cajas dentro de cajas |
| «Los botones están escondidos» | 13 pantallas usan menús de acciones; cobrar y facturar no se ven al abrir una orden | La acción clave vive en una pestaña, y en una venta o una operación compiten dos botones principales |
| «Mucho texto» | 46 % del texto en gris | Una descripción bajo cada título, repetida en cada panel |

**Esto contradice lo que aprobaste antes.** En septiembre dijiste preferir pantallas compactas, densas y de grises neutros, con poco espacio vacío, y eso quedó en `DESIGN.md`, en `PRODUCT.md` y en la spec `sistema-visual-frontend`. El sistema cumple esa guía. Después, el 26 de septiembre, pediste usar toda la paleta y no dejar pantallas casi blancas, pero el 2,5 % muestra que eso nunca llegó a la mayoría de las pantallas. Hay que elegir una dirección nueva y reemplazar la anterior de forma expresa.

### 6.5 Teléfono y tableta

- Funcionan sin desplazamiento horizontal y las pruebas de accesibilidad existen.
- En teléfono, las pestañas de la orden se cortan («y servicios») y hay que recorrer mucho para llegar a cobrar.
- Falta confirmar si el dueño usará la tableta (ya consta como pendiente). Si la usa en el taller, el flujo debe pensarse con el dedo desde el inicio.

## 7. Qué no se puede simplificar y qué sí

Esto hay que tenerlo claro para no prometer de más.

**Debe seguir igual porque es legal o es una decisión de fondo:**

- **Un trabajo con repuestos genera dos facturas.** Son dos RUC distintos, dos contribuyentes ante el SRI. Una sola factura mezclaría los ingresos de ambos. El sistema puede hacer las dos de una vez, pero siguen siendo dos.
- **El comprobante necesita los datos del SRI:** identificación del comprador, correo, forma de pago y número de cada RUC.
- **Dinero e inventario siguen separados por dentro:** cada cobro va a una sola operación (`DP-013`), hay Kardex, y un documento confirmado no se edita.
- **Las retenciones siguen.** El RUC artesanal recibe varias cada mes (`DP-032`), así que no son contenido sobrante.
- **La configuración inicial no desaparece,** pero se hace una sola vez y puede ser una guía paso a paso.

**Puede cambiar en lo que el usuario ve, sin tocar esas reglas:**

- «Generar comprobante» puede hacerse solo al cobrar.
- Los códigos internos pueden quedar en segundo plano.
- El sistema ya sabe que un servicio es del artesanal y un repuesto del comercial, así que el usuario nunca debe pensar en el RUC.
- Las revisiones repetidas pueden ser una sola.
- Por dentro seguirían existiendo dos operaciones, dos cobros y dos facturas. Lo que cambia es que se resuelven desde una sola pantalla.

**Un desacuerdo con tu análisis:** no todo el contenido sobra. Kardex, retenciones, auditoría o proformas tienen razón de existir. El problema es que están al mismo nivel que lo diario. La solución es esconderlos hasta que se necesiten, no borrarlos.

## 8. Propuesta

### 8.1 Menú sin grupos plegables

| Entrada | Contiene | Reemplaza a |
|---|---|---|
| Inicio | Atender, pendientes, lo que hay que cobrar y facturar | Inicio |
| Mantenimientos | Lista y ficha | Mantenimientos |
| Ventas | Ventas y proformas | Ventas, Proformas |
| Facturas | **Nueva:** todas, con su estado | Nada |
| Clientes | Clientes con sus vehículos, compras y deuda | Clientes, Vehículos |
| Productos | Productos con stock, movimientos y entradas | Productos, Entradas, Inventario |
| Servicios | Catálogo | Servicios |
| Cuentas | Por cobrar y retenciones, por negocio | Cobros de servicios, Cuentas por cobrar |
| Ajustes | Proveedores, marcas, usuarios, auditoría, configuración, estado técnico | El resto |

Serían 9 entradas siempre visibles, en lugar de 18 escondidas, más una búsqueda global de placa, cliente, producto o factura.

### 8.2 Inicio como mostrador

Dos botones grandes: **Nuevo mantenimiento** y **Venta rápida**. Debajo, la lista de lo que hay que atender hoy: trabajos en curso, por cobrar y por facturar, con el botón de acción en cada fila.

### 8.3 Flujo único «Cobrar y facturar»

Un solo botón visible en la ficha del mantenimiento, en cualquier pestaña. Abre esta pantalla:

```text
Cobrar y facturar: Mantenimiento N.º 3 · Carlos Mendoza · GYE-1234

  Taller                          Repuestos
  Cambio de pastillas    20.00    Pastillas de freno    23.00
  Total                  20.00    Total                 23.00

  Total a cobrar: USD 43.00  (se emiten 2 facturas)

  ¿Cómo paga?   [Efectivo]  Transferencia  Queda debiendo
  Correo        carlos@...    [x] Guardar en el cliente

                                       [ Cobrar y facturar ]
```

Por dentro hace lo mismo que hoy, en orden y por separado, sin mezclar nada: genera la operación de servicios, confirma la venta, registra dos cobros y pide dos facturas. Si la emisión falla, el cobro queda en firme (`DP-034`, regla 5) y la factura aparece como pendiente.

| Tarea | Hoy | Objetivo (estimado, por validar) |
|---|---:|---:|
| Servicio simple, cobrado y facturado | 25 acciones, sin factura real | 8 a 10 |
| Venta de mostrador | 16 acciones, sin factura real | 5 a 6 |
| Mantenimiento con repuesto | 47 acciones, sin factura real | 12 a 14 |

La venta rápida sigue la misma idea: cliente, productos, cobrar. Empieza en «Contado» y no obliga a guardar borrador.

### 8.4 Sistema visual

Propuesta para discutir, primero como maqueta:

- **Escala de letra clara:** título 28-32 px, importes grandes, cuerpo 15-16 px, y mucho menos gris.
- **Solo dos pesos con intención:** normal para datos y fuerte para lo importante.
- **Color con función:** menú oscuro de marca, un botón principal fuerte por pantalla, Taller y Repuestos con color propio en toda su superficie, estados bien visibles.
- **Formas más suaves:** radios de 12 a 16 px, sin cajas dentro de cajas, con más aire entre grupos.
- **Menos texto:** sin descripción bajo cada título; la ayuda va en un icono.
- **Objetivos táctiles de 44 px** como mínimo, ya que se usará en un taller.

Los tokens ya están centralizados, lo que abarata el color. La tipografía cuesta más: hay 298 tamaños escritos a mano en el código, y deben pasar a tokens.

## 9. Choques con lo vigente

Es una lista preliminar. Cada cambio debe repetir la búsqueda según la regla de `cambios-pendientes.md`.

| Fuente | Dice | Propuesta | Salida sugerida |
|---|---|---|---|
| `interfaz-y-navegacion.md`, sección 6.6 | Ningún botón reparte dinero *silenciosamente* entre los dos RUC | Pantalla con los dos importes a la vista | Se ajusta |
| `DP-013` | Cada pago va a una sola operación | Se registran dos pagos | Se mantiene |
| `DP-027` | Confirmar y cobrar son independientes | Siguen siéndolo; la pantalla los encadena | Se ajusta |
| `DP-021` | Finalizar nunca confirma la venta | Quien pulsa cobrar confirma de forma expresa; finalizar no cambia | Se mantiene |
| `DP-029` | Las líneas se documentan una sola vez | Se documentan solas al cobrar | Se mantiene |
| `actores-y-roles.md` | El Encargado no confirma ni cobra repuestos | Sin ese permiso, solo ve su parte | Se mantiene |
| `DP-035`, regla 1 | El correo no cambia la ficha del cliente | Casilla «Guardar en el cliente» | Se ajusta |
| `RNF-USA-009` y `RNF-USA-010` | Mostrar términos y entidad fiscal | Lenguaje simple; RUC donde importa | Se ajustan |
| `interfaz-y-navegacion.md:37` y `DESIGN.md` | Sin búsqueda global | Búsqueda global | Se reemplaza |
| Sección 2.2 de `interfaz-y-navegacion.md` | Navegación por áreas | Menú de 9 entradas | Se reemplaza |
| Specs `sistema-visual-frontend` y `patrones-de-pantalla-frontend`, `DESIGN.md` | Dirección densa y neutra | Dirección nueva | Se reemplazan |
| Spec `preparacion-y-seguimiento-fiscal` | Preparación como pantalla propia | Paso interno del flujo | Se decide en el cambio 3 |

## 10. Plan recomendado

Esto reordena `cambios-pendientes.md`, pero **ese archivo no se modificó**: se actualiza si apruebas el orden.

**Paso 0. Cerrar lo abierto**

- [x] Cerrar `alinear-datos-del-comprobante-con-sri`. Archivado el 2026-11-01 sin verificar, por decisión del titular, que lo revisará después del rediseño. Queda pendiente esa verificación.

**Paso 1. Medir antes de cambiar**

- [ ] Agregar requisitos medibles de usabilidad, con los objetivos de la sección 8.3.
- [ ] Ver al dueño usar el sistema tal como está y compararlo con el Facturador del SRI, que es lo que usa hoy (`DP-032`). Si Tallkit es más lento que esa herramienta gratuita, no lo va a adoptar.

**Paso 2. Corregir y ordenar, sin tocar reglas**

- [ ] Errores de la sección 6.2, empezando por «Crédito» como valor inicial.
- [ ] Cambio `reorganizar-navegacion-y-lenguaje`: menú, nombres, ficha completa del cliente, stock en productos, búsqueda global.
- [ ] Cambio `renovar-sistema-visual`, con maqueta aprobada antes de programar.

**Paso 3. El flujo**

- [ ] Cambio `cobrar-y-facturar-en-un-paso`, con una decisión `DP` nueva, sobre el adaptador simulado.
- [ ] Rediseñar el cambio 3 para que entregue el menú «Facturas» y los estados reales dentro de este flujo.

**Paso 4. Factura real y prueba con el cliente**

- [ ] Cambio 4: conexión con Factuplan y primera factura real del RUC artesanal.
- [ ] Adelantar el cambio 6: sin consumidor final no hay venta rápida de mostrador.
- [ ] Prueba piloto de una semana con el cliente **antes** de construir más.

Los cambios 8 (caja), 9, 10, 11 (reportes) y 12 deben ordenarse según lo que muestre esa prueba.

## 11. Decisiones del usuario

Respondidas el 2026-11-01. Todavía no sustituyen ninguna regla vigente: se registran con un número `DP` en el cambio documental que las incorpore.

- [x] **Usuarios reales.** Una persona usa el sistema cada día con los roles Vendedor y Encargado del taller. El desarrollador es el Administrador por ahora.
- [x] **«Cobrar y facturar».** Aceptado: una sola pantalla para repuestos y servicios, con dos cobros y dos facturas visibles.
- [x] **Dirección visual.** Se reemplaza la aprobada en septiembre, con un prototipo previo que se generará más adelante.
- [x] **Nombres.** Mejor que «Taller» y «Repuestos»: mostrar directamente el nombre comercial de cada negocio, tomado de la configuración, en lugar de «RUC artesanal» y «RUC comercial».
- [x] **Correo.** Se guarda en el cliente al facturar, con una casilla activada.
- [x] **Búsqueda global.** Se incorpora.
- [x] **Orden.** Este plan va antes del cambio 3.
- [x] **Documentación.** Se actualiza la desactualizada, para que ningún agente lea lo que ya no se va a hacer.

- [x] **Quién resuelve lo reservado al Administrador.** La persona del taller es la hija del dueño y es de confianza. Se le asigna también el rol Administrador, con esas opciones agrupadas en «Ajustes». La tabla de permisos no cambia.

## 12. Lo que está bien y hay que conservar

- **El backend:** reglas de dinero, inventario y separación por RUC, con unas 52 000 líneas de código y 58 000 de pruebas.
- **La arquitectura:** el monolito modular con fronteras claras permite agregar un flujo que coordine sin reescribir los módulos.
- **Los permisos** y la autorización en el servidor.
- **Los tokens de diseño,** que abaratan el cambio visual.
- **Buenas piezas de interfaz:** los accesos del Inicio, los atajos «Registrar vehículo» y «Nueva orden» en la ficha del cliente, la vista previa de la venta, la entrada de stock con lector de códigos y las etiquetas.
- **La preparación fiscal ya simplificada** en el cambio 2: su lenguaje mejoró, aunque deba integrarse al flujo.

## 13. Documentación desactualizada

No afecta al usuario, pero confunde a quien lea el proyecto, incluidos los agentes:

| Archivo | Problema |
|---|---|
| `README.md:11` | Dice que ventas, pagos y mantenimientos no están implementados |
| `AGENTS.md:27` | Dice que el dominio funcional aún no está implementado |
| `decisiones-confirmadas.yaml:407` | Repite esa afirmación como estado actual |
| `PRODUCT.md:37` | Dice que no hay nombre comercial ni logotipo |
| `DESIGN.md:12` | Habla de un cambio ya archivado como si siguiera activo |
| `interfaz-y-navegacion.md`, sección 7.3 | Describe el ingreso con borrador, sustituido por `DP-030` |
| `interfaz-y-navegacion.md`, sección 2.2 | El diagrama de navegación ya no coincide con el menú |

## Anexo: flujos medidos

**A. Servicio simple (25 acciones).** Nuevo mantenimiento, buscar cliente, elegir cliente, elegir vehículo, kilometraje, diagnóstico, registrar orden, agregar servicio, abrir lista, elegir servicio, confirmar servicio, pestaña Documentos y cobros, generar comprobante, confirmar comprobante, abrir `ART-SER`, preparar factura, revisar datos, confirmar datos. *Datos listos.* Volver a la operación, cobrar, escribir efectivo, registrar cobro, volver a la orden, finalizar, finalizar orden.

**B. Venta de mostrador (16 acciones).** Nueva venta, buscar cliente, elegir cliente, cambiar a Contado, buscar producto, elegir producto, guardar borrador, revisar y confirmar, confirmar venta, registrar cobro, escribir efectivo, revisar cobro, confirmar cobro, preparar factura, revisar datos, confirmar datos. *Datos listos.*

**C. Mantenimiento con repuesto (47 acciones).** Crear la orden (7), agregar el servicio (4), agregar el repuesto (5), abrir la venta pendiente, editar borrador, cambiar a Contado, guardar, revisar, confirmar venta (6), cobrar repuestos (4), preparar su factura con el correo (4). *Primera factura lista.* Volver a la venta, ir a la orden, abrir la pestaña, generar comprobante, confirmar, abrir `ART-SER` (6), preparar factura con el correo otra vez (4). *Segunda factura lista.* Volver, cobrar servicios (4), volver a la orden, finalizar, finalizar orden (3).

**D. Cliente nuevo (8 acciones).** Abrir el grupo del menú, Clientes, Nuevo cliente, identificación, nombre, teléfono, correo, guardar. La ficha ofrece después «Registrar vehículo» y «Nueva orden».
