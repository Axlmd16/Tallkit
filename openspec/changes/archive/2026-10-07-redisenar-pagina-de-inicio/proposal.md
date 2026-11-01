## Why

La página de inicio repite el menú lateral: muestra las mismas áreas y opciones que ya están siempre a la vista, sin dar ningún dato ni acortar ningún camino. Quien abre el sistema por la mañana no sabe qué quedó pendiente ni puede empezar con un toque lo que hace todos los días. `interfaz-y-navegacion.md` ya pide en UI-002 una página con accesos rápidos e indicadores, y hoy el sistema tiene los datos para cumplirla en casi todo.

## What Changes

Sustituir el contenido de la página de inicio por un resumen de trabajo breve, compuesto solo con lo que cada persona puede ver según sus permisos. No se pretende un tablero de reportes: son cuatro bloques y un único gráfico pequeño.

### Decisiones

| ID | Comportamiento | Estado |
|---|---|---|
| D1 | La página tiene cuatro bloques: acciones rápidas, pendientes, por cobrar y un gráfico pequeño. | Confirmada por el usuario (2026-10-06) |
| D2 | La página sigue los estilos, tokens, piezas y patrones ya definidos del sistema Tallkit; no introduce un lenguaje visual propio. | Confirmada por el usuario (2026-10-06) |
| D3 | El listado de áreas y opciones desaparece del inicio, porque la navegación lateral ya lo ofrece. | Aprobada con la propuesta (2026-10-06) |
| D4 | El gráfico muestra el dinero cobrado en los últimos 7 días, uno por entidad fiscal. | Aprobada con la propuesta (2026-10-06) |
| D5 | Las alertas de stock bajo y el estado del respaldo quedan fuera de este cambio. | Aprobada con la propuesta (2026-10-06) |

### Alcance

- **Acciones rápidas.** Accesos directos a lo más frecuente: nueva venta, nueva proforma, nuevo mantenimiento, registrar entrada y cobrar. Cada acceso aparece solo con el permiso que ya exige su pantalla de destino y lleva a esa pantalla; no crea ni confirma nada por sí mismo.
- **Pendientes.** Conteos que llevan a la lista correspondiente, ya filtrada:
  - mantenimientos abiertos (registrados o reabiertos);
  - ventas de contado confirmadas que siguen sin cobrar;
  - proformas vigentes que vencen hoy o mañana;
  - retenciones recibidas con el comprobante por completar;
  - borradores de venta y de proforma sin terminar;
  - para el Administrador, la calificación artesanal por vencer, con el mismo aviso de 60 días de DP-031.
- **Por cobrar.** El saldo pendiente y el número de clientes que deben, en dos indicadores separados: repuestos (RUC comercial) y servicios (RUC artesanal). Nunca se suman ni se presenta un total conjunto. Cada uno lleva a su lista de cuentas por cobrar.
- **Gráfico pequeño.** Dinero cobrado por día en los últimos 7 días de America/Guayaquil, por entidad fiscal y sin sumar las dos. Cuenta solo dinero efectivamente cobrado y vigente: no incluye retenciones recibidas (DP-032) ni pagos anulados.
- **Lo que ve cada persona.** El servidor decide qué bloques e indicadores entrega según los permisos efectivos; un indicador sin permiso no se muestra ni se envía. Una persona con varios roles ve la unión. Quien no tenga ningún indicador ni acción disponibles ve un estado vacío comprensible.
- **Comportamiento de los datos.** Los valores se calculan al consultar, a partir de operaciones existentes; no se guardan como hechos nuevos. Cada bloque carga, falla y se reintenta por separado, sin tumbar el resto de la página.

### Cómo se respeta el estilo existente (D2)

- Lienzo, paneles con borde fino, cabeceras en gris suave y tipografía contenida, como en el resto de las pantallas. Los pendientes se agrupan en un panel compacto y comparable, sin convertir cada dato en una tarjeta ni usar sombras, conforme a `sistema-visual-frontend`.
- Azul Tallkit solo para la acción principal y petróleo para enlaces, selección y foco. Cada ámbito fiscal se identifica con su nombre, icono y tono propios, y ningún estado depende solo del color.
- Importes con la pieza de dinero existente; estados de carga, vacío y error con el patrón PPF-07; página a todo el ancho y adaptable desde 360 px, con objetivos táctiles de 44 px y uso completo por teclado.
- El gráfico se construye con los tokens del sistema y sin añadir una librería: hoy el proyecto no tiene ninguna de gráficos. Sus valores deben poder leerse también como texto.
- Las piezas nuevas (indicador con conteo y gráfico breve) se incorporan al catálogo visual para reutilizarlas, en lugar de quedar como estilos sueltos de esta página.

### Fuera de alcance

Alertas de stock bajo y configuración de umbrales (RF-INV-011, decisión pendiente); estado del respaldo (DA-003 abierta); cierre diario de caja (RF-REP-011); margen, ganancias, costos o valorización; centro de reportes, visor y exportación (UI-080/081); comparativas entre períodos, filtros o selección de fechas en el inicio; total conjunto de los dos RUC; personalización del inicio por usuario; búsqueda global; notificaciones en tiempo real o actualización automática continua; cambios en permisos, roles, rutas existentes o reglas de las operaciones que se resumen.

## Capabilities

### New Capabilities

- `pagina-de-inicio`: resumen de trabajo al entrar al sistema: acciones rápidas, pendientes con acceso a su lista, saldos por cobrar separados por entidad fiscal y cobros de los últimos 7 días, todo limitado por los permisos efectivos y calculado en el servidor.

### Modified Capabilities

- `sistema-visual-frontend`: añadir a las piezas propias del taller el indicador con conteo y el gráfico breve, con sus reglas de color, ámbito fiscal y lectura sin depender del color.

## Impact

**Usuarios y operación.** Afecta a los tres roles. El Vendedor ve lo comercial, el Encargado del taller lo artesanal y el Administrador ambos, siempre separados. No se crean permisos: cada indicador se rige por uno existente (`ventas.*`, `proformas.*`, `mantenimientos.*`, `ingresos.*`, `pagos_comerciales.*`, `pagos_artesanales.*`). El permiso que gobierna la calificación artesanal se fijará en el diseño tras inspeccionar el código.

**Reutilización.** Ventas, proformas, mantenimientos, cobros, retenciones y perfil del emisor ya exponen los datos; las listas de destino ya existen. Se reutilizan la navegación por permisos, las piezas de `shared/ui` (encabezado, paneles, dinero, etiqueta de ámbito, estados) y el patrón de consultas del frontend.

**Modificación.** `frontend/src/pages/home/HomePage.tsx` se sustituye por completo; hoy solo lista los grupos de `navigation.ts`, que no cambia. El backend incorpora consultas de solo lectura para el resumen y el contrato OpenAPI se amplía. No se prevén tablas, migraciones ni cambios en datos existentes; el diseño lo confirmará. Algunas listas podrían necesitar aceptar un filtro que hoy no tienen para que el acceso desde un pendiente llegue ya filtrado.

**Dependencias y riesgos.**

- *Mezclar los dos RUC.* Se evita con indicadores y gráficos separados y sin totales conjuntos (RN-FIS-008/009, RN-CON-005, RF-REP-008).
- *Mostrar datos a quien no corresponde.* El servidor filtra por permiso; ocultar en pantalla no basta (RNF-SEG-003). El Vendedor no recibe costos ni valoración.
- *Lentitud al entrar.* Es la primera pantalla de cada sesión; debe responder dentro de RNF-REN-001 con el volumen esperado.
- *Saturar la página.* El alcance se limita a cuatro bloques y un gráfico; añadir un indicador nuevo requiere su propio cambio.
- *Romper la coherencia visual.* Se atiende con D2, el catálogo visual y la validación contra la maqueta Tallkit.

### Fuentes consultadas y trazabilidad

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`, leído completo: separación fiscal, CT-001, DP-019, DP-027, DP-030, DP-031, DP-032 y DP-033; pendiente RF-INV-011; DA-003 abierta.
- `docs/arquitectura/modelo-dominio.md`, leído completo: invariantes 1 a 3, conceptos calculados (saldo pendiente) y §11.7 sobre retenciones.
- `docs/negocio/requisitos/interfaz-y-navegacion.md`: §2.1 marco de aplicación y UI-002 página de inicio.
- `docs/negocio/requisitos/requisitos-funcionales.md`: RF-REP-006, RF-REP-008, RF-REP-010, RF-INV-011 y RF-REP-011.
- `docs/negocio/requisitos/requisitos-no-funcionales.md`: RNF-SEG-003, RNF-REN-001, RNF-USA-001, RNF-USA-006…010.
- `docs/negocio/requisitos/actores-y-roles.md`: catálogo de permisos por rol. `docs/negocio/producto/reglas-negocio.md`: RN-FIS-005/008/009 y RN-CON-004/005/008.
- `openspec/specs/sistema-visual-frontend/spec.md`, y requisitos aplicables de `patrones-de-pantalla-frontend` (PPF-07), `experiencia-adaptable-frontend` y `autorizacion-y-navegacion` («Navegación conforme a permisos»).
- Código actual como evidencia: `frontend/src/pages/home/HomePage.tsx`, `frontend/src/app/navigation.ts` y `frontend/src/shared/ui/`.
- No se usó `grill-me`: las dudas restantes son D4 y D5, que se presentan como recomendaciones.

### Contradicciones, pendientes e información insuficiente

- UI-002 pide alertas de stock bajo y estado del respaldo. No pueden cumplirse todavía: no existe umbral por producto (RF-INV-011 pendiente, y `sistema-visual-frontend` prohíbe clasificar existencias con un umbral no decidido) y DA-003 sigue abierta. Este cambio cubre UI-002 de forma parcial y lo deja registrado; UI-002 se actualizará al sincronizar.
- UI-002 lista «registrar pago» como acceso rápido. Un cobro siempre se aplica a una operación concreta (DP-013), así que el acceso lleva a las cuentas por cobrar para elegirla, no a un cobro suelto.
- El comentario de `HomePage.tsx` afirma que ningún indicador tiene respaldo en el servidor; quedó desactualizado.
- `decisiones-confirmadas.yaml` todavía describe el dominio como no implementado. Es una brecha ajena a este cambio.

Estado: propuesta aprobada por el usuario el 2026-10-06 mediante «está bien, continúa», después de su presentación para revisión. La aprobación comprende D1…D5. Autoriza redactar las specs; no autoriza design, tasks ni implementación.

Specs aprobadas por el usuario el 2026-10-06 mediante «está bien, haz commit y continúa», incluidas sus cuatro concreciones: el pendiente de servicios de contado sin cobrar, los pendientes en cero visibles, los cobros recientes sin restar reembolsos y el aviso de la calificación artesanal ya vencida. Se autoriza registrar propuesta y specs en `master` y continuar con el design; no autoriza tasks ni implementación.

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
