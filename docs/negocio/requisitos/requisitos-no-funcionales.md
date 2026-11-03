# Requisitos no funcionales

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.3 |
| Estado | Alineado con el modelo de dominio aprobado |
| Fecha | 2026-09-08 |

> Estos requisitos fijan cualidades verificables del sistema objetivo. Los valores marcados como **objetivo provisional** deben validarse durante el diseño y la prueba piloto antes de aprobar la línea base.

## 1. Seguridad y privacidad

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-SEG-001 | Las contraseñas deben almacenarse únicamente mediante el mecanismo de hash seguro y actualizado provisto por el framework; nunca en texto legible ni mediante cifrado reversible. | Debe |
| RNF-SEG-002 | Toda ruta y operación interna debe exigir autenticación, salvo recursos expresamente declarados públicos; V1 no define funciones públicas de negocio. | Debe |
| RNF-SEG-003 | El backend debe autorizar cada acción y acceso a datos conforme a los permisos fijos de Administrador, Vendedor o Encargado del taller, independientemente de los controles del frontend. | Debe |
| RNF-SEG-004 | Las sesiones deben usar cookies o credenciales protegidas contra acceso no autorizado; si se usan cookies, deben aplicar `HttpOnly`, `SameSite` y `Secure` cuando exista HTTPS. | Debe |
| RNF-SEG-005 | Las solicitudes que cambien estado deben protegerse contra CSRF cuando el mecanismo de autenticación sea susceptible a ese ataque. | Debe |
| RNF-SEG-006 | El inicio de sesión debe limitar intentos repetidos y registrar eventos sospechosos sin almacenar contraseñas. El umbral exacto se definirá en arquitectura. | Debe |
| RNF-SEG-007 | Los mensajes de error no deben revelar contraseñas, secretos, trazas internas, consultas SQL ni detalles innecesarios de la infraestructura. | Debe |
| RNF-SEG-008 | Secretos, credenciales de base de datos y claves deben suministrarse mediante variables de entorno o un mecanismo seguro equivalente, fuera del repositorio. | Debe |
| RNF-SEG-009 | Las fotografías y exportaciones deben estar disponibles únicamente para usuarios autorizados y no deben exponerse mediante rutas predecibles sin control. | Debe |
| RNF-SEG-010 | La instalación futura en Internet debe utilizar HTTPS y encabezados de seguridad; el diseño local no debe impedir activar estas medidas. | Debe |
| RNF-SEG-011 | Las dependencias deben revisarse con herramientas automáticas y no deben liberarse versiones con vulnerabilidades críticas conocidas sin una excepción documentada. | Debe |
| RNF-SEG-012 | Los respaldos deben recibir protección de acceso equivalente a los datos operativos y no incluirse en directorios públicos del servidor web. | Debe |

## 2. Integridad, transacciones y concurrencia

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-INT-001 | Confirmar ingresos, reservas, ventas, devoluciones, anulaciones, pagos, ajustes, desarmes, consumos y reposiciones debe ser atómico: todos sus efectos se confirman o ninguno. | Debe |
| RNF-INT-002 | La concurrencia no debe producir existencias o disponibilidades negativas, incluso si dos usuarios reservan o venden el último producto al mismo tiempo. | Debe |
| RNF-INT-003 | La generación concurrente de secuenciales debe garantizar unicidad por entidad fiscal, tipo de documento y serie. | Debe |
| RNF-INT-004 | Las operaciones críticas deben ser idempotentes o detectar reintentos para evitar documentos, cobros o movimientos duplicados. | Debe |
| RNF-INT-005 | Las restricciones críticas de unicidad —códigos, identificaciones, placas, VIN y secuenciales— deben reforzarse en la base de datos cuando sea técnicamente aplicable. | Debe |
| RNF-INT-006 | Los importes monetarios deben manejarse con tipos decimales y reglas de redondeo explícitas; no se permite usar coma flotante binaria para cálculos económicos. | Debe |
| RNF-INT-007 | Las cantidades deben conservar la precisión definida por unidad y los cálculos de costo promedio deben poder reproducirse desde los movimientos. | Debe |
| RNF-INT-008 | Las fechas y horas deben almacenarse con una estrategia uniforme y presentarse en la zona horaria del negocio `America/Guayaquil`, salvo decisión arquitectónica documentada que preserve el mismo resultado. | Debe |
| RNF-INT-009 | Una falla a mitad de una operación crítica no debe dejar documentos confirmados sin sus movimientos, secuenciales o saldos correspondientes. | Debe |
| RNF-INT-010 | Las migraciones y actualizaciones de esquema deben preservar datos o incluir un procedimiento de recuperación probado antes de aplicarse en producción. | Debe |
| RNF-INT-011 | Crear, cambiar o liberar una reserva de mantenimiento debe mantener coherentes la venta abierta, la cantidad reservada y la disponibilidad. | Debe |
| RNF-INT-012 | El desarme de un kit debe conservar exactamente el costo total distribuido aun con redondeos decimales. | Debe |

## 3. Rendimiento y capacidad

Los siguientes valores son objetivos provisionales para una instalación local de tamaño pequeño; deben medirse con datos representativos.

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-REN-001 | Con una red local estable y carga normal, al menos el 95 % de las consultas habituales de listados y fichas debe responder en 2 segundos o menos, excluyendo descarga de archivos. | Debería |
| RNF-REN-002 | Confirmar una operación de hasta 100 líneas debe responder en 3 segundos o menos en el 95 % de las pruebas, sin sacrificar atomicidad. | Debería |
| RNF-REN-003 | Los reportes ordinarios de hasta un año deben mostrarse en 5 segundos o menos en el 95 % de las pruebas con el volumen objetivo. | Debería |
| RNF-REN-004 | El sistema debe soportar al menos 10 usuarios activos concurrentes en la instalación inicial sin violar los objetivos de integridad. | Debe |
| RNF-REN-005 | Las tablas potencialmente grandes deben usar paginación del lado del servidor y no descargar el conjunto completo para mostrar la primera página. | Debe |
| RNF-REN-006 | Búsquedas frecuentes por código, identificación, placa, fechas y relaciones deben contar con índices o mecanismos equivalentes justificados por medición. | Debería |
| RNF-REN-007 | La carga de fotografías debe limitar tamaño y tipos permitidos; los límites definitivos se documentarán en arquitectura y serán visibles antes de subir. | Debe |

## 4. Disponibilidad, respaldo y recuperación

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-DIS-001 | La aplicación debe poder operar durante la jornada del taller mientras estén disponibles la computadora principal y la red local; no se exige servicio 24/7 en V1. Solo la emisión de comprobantes electrónicos necesita Internet, únicamente de salida (`DP-034`). | Debe |
| RNF-DIS-002 | Debe existir un procedimiento automatizable para respaldar la base de datos y las fotografías como un conjunto coherente. | Debe |
| RNF-DIS-003 | Debe generarse al menos un respaldo diario y conservarse más de una copia según la política operativa aprobada. | Debe |
| RNF-DIS-004 | El objetivo provisional de punto de recuperación (RPO) es 24 horas y el objetivo de tiempo de recuperación (RTO) es 4 horas. | Debería |
| RNF-DIS-005 | La restauración debe probarse antes de la puesta en producción y luego al menos trimestralmente en un entorno distinto de la instalación activa. | Debe |
| RNF-DIS-006 | El resultado de cada respaldo y prueba de restauración debe registrarse con fecha, responsable y estado. | Debe |
| RNF-DIS-007 | Una actualización debe requerir respaldo previo, validación de versión y un procedimiento documentado de reversión o recuperación. | Debe |
| RNF-DIS-008 | El sistema debe mostrar un error controlado y no confirmar parcialmente una operación cuando la base de datos o el almacenamiento de archivos no estén disponibles. | Debe |
| RNF-DIS-009 | Sin Internet, la venta y el cobro deben confirmarse con normalidad y el comprobante electrónico debe quedar en espera en Tallkit, sin presentarse como autorizado. La fecha y el plazo del comprobante en espera dependen de `NOR-008`. Aprobado y todavía no implementado: cambio 3. | Debe |

## 5. Usabilidad y accesibilidad

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-USA-001 | La interfaz debe ser adaptable y utilizable desde 360 px de ancho hasta pantallas de escritorio, sin desplazamiento horizontal en los formularios principales. | Debe |
| RNF-USA-002 | En teléfono, las tablas extensas deben transformarse, permitir desplazamiento controlado o mostrar columnas prioritarias sin ocultar las acciones críticas. | Debe |
| RNF-USA-003 | Las acciones destructivas o con efectos económicos deben mostrar una confirmación que indique documento, efecto y necesidad de motivo cuando corresponda. | Debe |
| RNF-USA-004 | Los errores de validación deben mostrarse junto al campo o acción afectada y explicar cómo corregirlos en lenguaje del negocio. | Debe |
| RNF-USA-005 | El sistema debe advertir cambios sin guardar antes de abandonar formularios con información modificada. | Debería |
| RNF-USA-006 | Los estados deben comunicarse mediante texto o iconografía además del color; el color no puede ser el único indicador. | Debe |
| RNF-USA-007 | La navegación y los formularios esenciales deben ser utilizables con teclado, con foco visible y etiquetas asociadas a controles. | Debería |
| RNF-USA-008 | El contraste y componentes esenciales deben orientarse al nivel AA de WCAG 2.2, sujeto a validación en pruebas de interfaz. | Debería |
| RNF-USA-009 | La terminología visible debe seguir los «Términos visibles en pantalla» de `../producto/glosario.md`, en lenguaje que no exija conocimientos contables, y distinguir crédito, forma de pago, venta, mantenimiento, intervención y operación de servicios. No se muestran conceptos internos si no ayudan a la tarea (`DP-036`, regla 3). Aprobado y todavía no implementado: U4 de `docs/cambios-pendientes.md`; hasta entonces rige el texto anterior, que exigía seguir todo el glosario. | Debe |
| RNF-USA-010 | Cada operación debe identificar su negocio (entidad fiscal) por el nombre comercial o, si no lo tiene, por la razón social, en documentos, cobros, reportes y operaciones donde exista riesgo de confusión. El RUC permanece visible en facturas, comprobantes y «Ajustes» (`DP-036`, regla 3; `RN-FIS-009`). Aprobado y todavía no implementado: U4 de `docs/cambios-pendientes.md`; hasta entonces las pantallas muestran «RUC comercial» y «RUC artesanal». | Debe |
| RNF-USA-011 | Las búsquedas principales deben permitir iniciar con teclado, limpiar filtros y conservar contexto al volver desde una ficha. | Debería |
| RNF-USA-012 | Los comprobantes internos deben ser legibles en impresión A4 y no presentarse como facturas electrónicas. | Debe |
| RNF-USA-013 | La usuaria diaria debe completar un **servicio simple**, cobrado, con su factura solicitada y la orden cerrada, en **8 a 10 acciones** (hoy 25). Objetivo provisional. Aprobado y todavía no implementado: U6 de `docs/cambios-pendientes.md`. | Debe |
| RNF-USA-014 | La usuaria diaria debe completar una **venta de mostrador**, cobrada y con su factura solicitada, en **5 a 6 acciones** (hoy 16). Objetivo provisional. Aprobado y todavía no implementado: U6. | Debe |
| RNF-USA-015 | La usuaria diaria debe completar un **mantenimiento con un servicio y un repuesto**, cobrado, con sus dos facturas solicitadas y la orden cerrada, en **12 a 14 acciones** (hoy 47). Objetivo provisional. Aprobado y todavía no implementado: U6. | Debe |
| RNF-USA-016 | Las acciones se cuentan con el método de la línea base: se parte del Inicio con la sesión iniciada; el cliente ya está registrado, con su correo y, en las tareas de taller, con un solo vehículo; los catálogos y la configuración fiscal están completos; cada clic, cada campo escrito y cada elección en una lista cuentan como una acción, y escribir un campo cuenta una sola vez sin importar su longitud; las ventanas de confirmación, los cambios de pestaña y los regresos a otra pantalla cuentan; la tarea termina cuando las facturas quedan solicitadas y, en las tareas de taller, la orden queda finalizada. Mientras la emisión real no esté habilitada, «factura solicitada» significa que la solicitud quedó registrada, sin presentarse como autorizada (`DP-034`, regla 8). El recorrido se observa con la usuaria diaria en el prototipo (U2) y se compara con el Facturador del SRI antes de aprobar U6. Aprobado y todavía no implementado: U2 y U6. | Debe |

> **Rapidez sin omitir reglas** (`DP-036`, regla 7). `RNF-USA-013` a `RNF-USA-016` son objetivos provisionales, estimados por el titular a partir de `docs/analisis-del-sistema.md` y sujetos a la comprobación con la usuaria diaria; se verifican al cerrar U6 con el método `USA`. Un recorrido que los cumpla mezclando entidades fiscales, uniendo cobros o facturas, aceptando stock negativo, saltándose un permiso o un dato exigido por el SRI, o presentando una factura como autorizada sin estarlo se considera incumplido. Una medición con un cliente sin correo o con varios vehículos se registra aparte y no se compara con los objetivos. La spec asociada es `objetivos-de-uso-diario` del cambio `reenfocar-tallkit-en-el-uso-diario`.

## 6. Compatibilidad y portabilidad

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-COM-001 | La interfaz debe funcionar en las dos versiones estables más recientes de Chrome, Edge y Firefox disponibles al liberar V1. | Debe |
| RNF-COM-002 | Las funciones principales deben probarse en un navegador móvil basado en Chromium y en Safari móvil cuando exista un dispositivo disponible. | Debería |
| RNF-COM-003 | El backend objetivo debe poder desplegarse en un sistema Linux soportado usando configuración reproducible y PostgreSQL. | Debe |
| RNF-COM-004 | La configuración específica del entorno debe mantenerse separada del código para permitir pasar de red local a Internet sin reescribir la lógica del negocio. | Debe |
| RNF-COM-005 | Las rutas, nombres de archivos y procesos no deben depender innecesariamente de una única estación cliente. | Debería |
| RNF-COM-006 | La API debe intercambiar texto en UTF-8 y conservar correctamente caracteres del español. | Debe |
| RNF-COM-007 | La emisión electrónica no debe depender de un proveedor específico: cambiar de proveedor debe requerir agregar un adaptador y cambiar una configuración, sin tocar ventas, taller, cobros ni pantallas. Aprobado y todavía no implementado: cambios 3 y 4. | Debe |

## 7. Mantenibilidad, arquitectura y calidad

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-MAN-001 | La solución debe mantener separación modular entre identidad, datos maestros, inventario, ventas/pagos, taller y reportes, evitando dependencias circulares no justificadas. | Debe |
| RNF-MAN-002 | Las reglas críticas de negocio deben implementarse en servicios o capas verificables y no depender exclusivamente de componentes visuales. | Debe |
| RNF-MAN-003 | Los cambios de reglas, API, arquitectura o datos deben actualizar la documentación y trazabilidad correspondiente en el mismo cambio. | Debe |
| RNF-MAN-004 | Todo cambio de esquema debe utilizar migraciones versionadas, revisables y compatibles con el procedimiento de despliegue. | Debe |
| RNF-MAN-005 | El backend debe aplicar análisis estático, formato y pruebas automatizadas definidos por el repositorio; el frontend debe aplicar sus equivalentes. | Debe |
| RNF-MAN-006 | Los módulos que afectan dinero, inventario, permisos y secuenciales deben tener pruebas unitarias y de integración automatizadas. | Debe |
| RNF-MAN-007 | Los flujos críticos deben tener escenarios de aceptación trazables a requisitos y reglas. | Debe |
| RNF-MAN-008 | Las decisiones arquitectónicas relevantes deben registrarse mediante ADR antes o junto con su implementación. | Debería |
| RNF-MAN-009 | El contrato de API debe mantenerse en OpenAPI y diferenciar comportamiento vigente, objetivo y obsoleto. | Debe |
| RNF-MAN-010 | Los registros de aplicación deben ser suficientes para diagnosticar fallos sin incluir contraseñas, secretos ni datos personales innecesarios. | Debe |

## 8. Auditoría y observabilidad

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-AUD-001 | Cada evento crítico debe registrar sello temporal, usuario, acción, tipo e identificador del objeto, resultado y motivo cuando corresponda. | Debe |
| RNF-AUD-002 | Los eventos de auditoría no deben poder modificarse desde funciones ordinarias de la aplicación. | Debe |
| RNF-AUD-003 | Los registros técnicos deben incluir un identificador de correlación que permita seguir una solicitud crítica entre frontend, API y error registrado. | Debería |
| RNF-AUD-004 | Deben registrarse fallos de autenticación repetidos, denegaciones críticas, errores de transacción y resultados de tareas de respaldo. | Debe |
| RNF-AUD-005 | Las horas de auditoría deben ser consistentes con la estrategia temporal definida y mostrarse en la zona horaria del negocio. | Debe |
| RNF-AUD-006 | La retención y acceso a registros deben documentarse antes de producción y evitar crecimiento indefinido sin rotación. | Debe |

## 9. Datos personales y retención

| ID | Requisito verificable | Prioridad |
|---|---|---|
| RNF-DAT-001 | El sistema debe solicitar y conservar solo datos de clientes, vehículos y usuarios necesarios para los procesos definidos. | Debe |
| RNF-DAT-002 | Las exportaciones con datos personales deben requerir permiso y reflejar únicamente los campos necesarios para el reporte. | Debe |
| RNF-DAT-003 | Desactivar un registro con historial debe impedir su uso nuevo sin borrar la trazabilidad existente. | Debe |
| RNF-DAT-004 | Antes de producción se debe documentar una política de retención para fotografías, auditoría, respaldos y exportaciones. | Debe |
| RNF-DAT-005 | Los datos de prueba no deben copiar información personal real sin anonimización o autorización. | Debe |

## 10. Método de verificación

| Código | Método |
|---|---|
| `REV` | Revisión de configuración, código, documentación o evidencia. |
| `PRU` | Prueba funcional o automatizada. |
| `CAR` | Prueba de carga o concurrencia. |
| `SEG` | Análisis o prueba de seguridad. |
| `RES` | Ejercicio de respaldo y restauración. |
| `USA` | Inspección o prueba de usabilidad y accesibilidad. |

La futura `matriz-cobertura.md` debe asociar cada RNF con uno o más métodos, entorno, responsable y evidencia.

## 11. Valores pendientes de ratificación

Antes de aprobar este documento deben ratificarse mediante diseño o prueba piloto:

- Cantidad esperada y máxima de usuarios concurrentes.
- Volumen estimado de productos, clientes, movimientos, ventas, mantenimientos y fotografías.
- Objetivos definitivos de respuesta para consultas y reportes.
- RPO, RTO, frecuencia y retención de respaldos.
- Tamaño, formato y cantidad permitida de fotografías.
- Retención de auditoría y registros técnicos.
- Plataformas móviles disponibles para pruebas.
