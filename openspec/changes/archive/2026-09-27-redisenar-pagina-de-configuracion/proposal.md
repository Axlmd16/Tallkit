## Why

La página *Configuración del taller* ya está organizada en pestañas, pero se lee como una colección de cajas y formularios. Cada pestaña apila tarjetas y paneles. *Facturación electrónica* añade dentro de su panel una segunda barra de subpestañas, un selector de entidad y un bloque de estado. El perfil tributario muestra las seis condiciones abiertas a la vez como un formulario largo. El Administrador tiene que entender y recorrer todos los campos para consultar un solo dato, y la insignia «Sistema operativo» del encabezado no indica qué falta ni dónde.

Este cambio reorganiza la presentación como una hoja de consulta: primero se leen los datos y solo después se edita, cuando hace falta. Es un cambio de presentación: no cambia datos, reglas, permisos ni contratos del servidor. Se hace ahora porque la configuración fiscal acaba de ampliarse en `simplificar-flujo-fiscal-y-configuracion-centralizada`, y es la pantalla que el Administrador usa para dejar lista la preparación local.

Estado: **propuesta aprobada** por el usuario el 2026-09-26 (America/Guayaquil). El usuario revisó la maqueta «Configuración del taller» y pidió crear directamente la propuesta, las specs y el diseño. La aprobación no autoriza tasks ni implementación.

## What Changes

### Composición general

1. **Una sola hoja de trabajo.** La página muestra una superficie blanca principal, sin una tarjeta por sección ni por registro. Los datos se separan con líneas finas, filas y jerarquía tipográfica, conforme al sistema Tallkit. Las sombras siguen reservadas a diálogos, menús y notificaciones.
2. **Navegación de secciones adaptable.** Las cinco secciones actuales se conservan con su orden y nombres. Desde 1024 px se presentan como una lista vertical a la izquierda, dentro de la misma hoja. Cada elemento lleva icono, nombre y un indicador breve: número de registros o pendientes. La sección activa se marca con una línea petróleo, fondo suave y texto, no solo con color. Por debajo de 1024 px sigue siendo una barra horizontal desplazable.
3. **Resumen útil en el encabezado.** La insignia «Sistema operativo» se sustituye por un resumen del estado de la configuración, por ejemplo «4 de 5 secciones al día · 1 pendiente en Facturación electrónica». El resumen enlaza a la sección que requiere atención.
4. **Leer primero, editar después.** Cada sección muestra primero sus datos en modo de consulta: fichas de filas etiqueta–valor o tablas. La edición se abre desde una acción explícita en un **modal** corto, conforme a PPF-04. No se edita en línea ni en paneles laterales. Las confirmaciones siguen siendo notificaciones temporales y los errores permanecen en el modal o en la sección de origen.

### Secciones

5. **Entidades fiscales.** Las dos entidades se muestran lado a lado desde 1280 px y apiladas en pantallas estrechas, separadas por una línea. Cada una muestra su ámbito con nombre, icono y tono propios, su razón social y su RUC en una **placa de RUC** monoespaciada. Debajo aparecen filas de consulta: razón social, nombre comercial, uso según su ámbito, estado de facturación electrónica con su causa y series activas. Cada entidad tiene una sola acción «Editar».
6. **Bodega.** Una ficha breve con nombre y estado de la bodega única de V1 y la acción de editar su nombre.
7. **Impuestos.** Tabla compacta agrupada por entidad fiscal, con vigencias en orden cronológico. Crear, suceder o corregir una vigencia se hace en modal, como hoy.
8. **Series y numeración.** Tabla agrupada por entidad fiscal (COM-ING, COM-PRO y COM-VEN en la comercial; ART-SER en la artesanal, con sus sustitutas). Los códigos y números van en tipografía monoespaciada. Las acciones de corrección o sustitución se mantienen según el estado de cada serie.
9. **Facturación electrónica.**
   - Sus cinco subsecciones se muestran como elementos anidados bajo *Facturación electrónica* en la misma navegación de secciones, cada uno con su estado: completo, pendiente u opcional. Desaparece la segunda barra de subpestañas.
   - La entidad se elige con dos opciones visibles, cada una con nombre, RUC, tono de ámbito y estado, en lugar de una lista desplegable.
   - El estado de la entidad aparece en una sola franja con su causa y un enlace a la subsección que la resuelve.
   - El aviso permanente de preparación local se conserva con su texto actual.
   - Los datos técnicos (códigos oficiales, versiones y fuentes) se agrupan en «Información avanzada», plegada por defecto.
10. **Perfil tributario en tabla.** Cada condición declarada es una fila con su declaración (*Sin declarar*, *Aplica* o *No aplica*), su detalle y su vigencia. Cada fila se edita en su propio modal, con ayuda contextual y «¿Por qué se solicita?». El formulario único con las seis condiciones abiertas desaparece. Guardar una condición conserva el control de revisión vigente del perfil y no altera las demás condiciones.

### Decisiones de la revisión de diseño

- **R1 — Modal en lugar de edición en la misma zona.** La propuesta externa sugería editar dentro de la ficha. Se descarta porque contradice PPF-04 (formularios cortos en modal) y la decisión del usuario de no usar paneles laterales para editar.
- **R2 — Un solo árbol de navegación.** Se descarta un índice lateral propio de *Facturación electrónica*. Junto con la navegación principal de la aplicación, sumaría tres columnas de navegación y reduciría el ancho útil.
- **R3 — Enlaces con posición actual, no pestañas ARIA.** La navegación de secciones tiene elementos anidados, algo que una lista de pestañas ARIA no admite. Pasa a ser una navegación de enlaces que marca la posición actual. Se conservan los enlaces directos (`?tab=`, `?seccion=`), la restauración al recargar y el estado de cada sección al volver.
- **R4 — Textos.** Se retiran «Sistema operativo» y cualquier mensaje de guardado automático. El aviso permanente de *Facturación electrónica* conserva el texto exigido por la spec vigente.

### Diferencias de la maqueta que se corrigen

La maqueta aprobada fija la dirección visual, no una fidelidad píxel a píxel. La implementación sigue las specs vigentes donde la maqueta difiere:

| Aspecto | En la maqueta | En la implementación |
|---|---|---|
| Título de página | Unos 28 px | Unos 22 px (`sistema-visual-frontend`) |
| Ancho de los modales | 600 px | 420 a 480 px en escritorio (`experiencia-adaptable-frontend`) |
| Aviso de *Facturación electrónica* | Texto abreviado | Texto exacto exigido por la spec |
| Series de ejemplo | Códigos inventados | Series reales de DP-006 |

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `organizacion-de-la-configuracion`:
  - la navegación por pestañas pasa a una navegación de secciones adaptable, con subsecciones anidadas de *Facturación electrónica* e indicadores de estado;
  - se añaden el resumen del encabezado, el modo de consulta con edición en modal y la selección visible de entidad;
  - se modifican los requisitos de accesibilidad por teclado de las pestañas y la presentación de las subsecciones.
- `sistema-visual-frontend`: las piezas visuales propias del taller incorporan la **placa de RUC**, que muestra el RUC monoespaciado con su etiqueta.

`configuracion-operativa-y-fiscal` no cambia: sus reglas, validaciones, estados, textos obligatorios y permisos siguen vigentes, y este cambio solo cambia su presentación.

## Impact

- **Usuarios afectados:** solo el **Administrador**, único con acceso a la configuración (CT-001). Vendedor y Encargado del taller no ven cambios.
- **Frontend:**
  - página `WorkshopConfigurationPage`;
  - sección `FiscalConfigurationSection` y subsecciones de `features/fiscal/configuration/`;
  - componentes compartidos de navegación y de filas de consulta;
  - pruebas de Vitest y el recorrido E2E `workshop-configuration.spec.ts`.
- **Backend, API, datos y migraciones:** sin cambios. El estado por subsección se deriva de las causas que ya devuelve el estado de la configuración fiscal.
- **Permisos y seguridad:** sin cambios. El backend sigue validando cada acción de configuración.
- **Documentación:**
  - `interfaz-y-navegacion.md` (UI-013 y UI-019);
  - `matriz-trazabilidad.md`;
  - `glosario.md`, que recibe el término «Placa de RUC»;
  - las specs principales al archivar.
- **Dependencias:** ninguna nueva. Se reutilizan Phosphor Icons, IBM Plex y los tokens Tallkit.
- **Riesgos:**
  - Las pruebas E2E y de Vitest que buscan pestañas ARIA deben actualizarse.
  - Si el servidor añade causas nuevas, la correspondencia entre causas y subsecciones puede quedar incompleta; una causa desconocida debe seguir mostrándose en la franja general.
  - Guardar una condición por separado aumenta la probabilidad de conflictos de revisión si dos administradores editan a la vez; el conflicto ya se rechaza y debe explicarse.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`: CT-001, DP-001, DP-006, DP-018 y separación fiscal.
- `docs/arquitectura/modelo-dominio.md`: entidad fiscal, bodega, documento interno y extensión fiscal local.
- Specs principales:
  - `openspec/specs/organizacion-de-la-configuracion`;
  - `openspec/specs/configuracion-operativa-y-fiscal`;
  - `openspec/specs/patrones-de-pantalla-frontend` (PPF-02, PPF-04, PPF-07 y PPF-08);
  - `openspec/specs/sistema-visual-frontend`;
  - `openspec/specs/experiencia-adaptable-frontend`.
- `docs/negocio/requisitos/interfaz-y-navegacion.md`: UI-013, UI-019 y sección 5.
- Referencias de requisitos: RNF-USA-004/005/006/011, RF-ACC-010…012 y CU-003.
- Maqueta «Configuración del taller», revisada con el usuario el 2026-09-26.
- Cambio archivado `2026-09-26-simplificar-flujo-fiscal-y-configuracion-centralizada`.

No se encontraron decisiones de negocio abiertas afectadas. Las contradicciones detectadas entre la maqueta y las specs vigentes se resuelven a favor de las specs, en la tabla anterior.

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
