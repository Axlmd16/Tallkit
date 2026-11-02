## Context

La página `frontend/src/pages/workshop-configuration/WorkshopConfigurationPage.tsx` (unas 1450 líneas) monta cinco secciones con el componente compartido `Tabs`. Usa pestañas ARIA con flechas, `keepMounted` y el parámetro `?tab=`. Las secciones *Entidades fiscales*, *Bodega*, *Impuestos* y *Series y numeración* están dentro de la página. Cada una apila `Surface` y `DetailCard`, y ya edita en `Dialog`.

*Facturación electrónica* está en `features/fiscal/FiscalConfigurationSection.tsx` y contiene:

- un aviso;
- un `<select>` de entidad;
- `ElectronicStatusCard`;
- una segunda instancia de `Tabs` con `variant="pill"` y el parámetro `?seccion=`.

`ProfileConditionsSection` guarda las seis condiciones en un único formulario. Envía todo el perfil con `expected_revision` mediante `mutations.saveProfile`.

El estado fiscal por entidad (`GET` de estado electrónico) devuelve `state`, `causes[]` y `warnings[]`. Cada causa trae `code`, `kind` y `message`. Los códigos los construye `backend/src/workshop_configuration/application/electronic_status.py` con prefijos estables:

| Prefijo o código de la causa | Subsección donde se resuelve |
|---|---|
| `conditions.<clave>.unknown`, `.future` o `.expired` | Perfil tributario |
| `tax_mapping.<id>.missing`, `.expired` o `.review` | Impuestos y catálogo SRI |
| `point_missing`, `default_point_required` o `establishment_address` | Establecimientos y puntos de emisión |
| `payment_forms_missing` o `default_payment_form_required` | Formas de pago SRI |
| `certificate_*` (solo como advertencia) | Certificado electrónico |

Restricciones:

- Las specs vigentes de `sistema-visual-frontend`, `patrones-de-pantalla-frontend` y `experiencia-adaptable-frontend` siguen aplicando: título de unos 22 px, modales de 420 a 480 px, notificaciones temporales y 44 px táctiles.
- El marco de la aplicación ocupa 240 px desde 1280 px y 72 px entre 768 y 1279 px.
- No se cambian backend, API, datos, permisos ni reglas (propuesta, Impact).

## Goals / Non-Goals

**Goals:**

- Presentar la configuración como una sola hoja: navegación de secciones a la izquierda desde 1024 px y barra horizontal por debajo.
- Mostrar primero una vista de consulta y editar solo en modales.
- Llevar las subsecciones de facturación a la navegación, con estados derivados de las causas existentes.
- Sustituir el formulario único del perfil por una tabla con un modal por condición.
- Añadir la placa de RUC como pieza compartida.
- Conservar los enlaces `?tab=` y `?seccion=`, y el estado de cada sección al volver.

**Non-Goals:**

- Cambios de backend, OpenAPI, modelos o migraciones.
- Nuevas reglas fiscales, nuevas causas o cambios de textos obligatorios.
- Rediseñar la inicialización del taller (`InitializeWorkshopForm`), que sigue siendo un formulario en página (PPF-03).
- Rediseñar otras páginas o el marco de la aplicación.
- Tema oscuro.

## Decisions

### D1. Componente compartido `SectionNav` en lugar de ampliar `Tabs`

Se crea `frontend/src/shared/ui/navigation/SectionNav.tsx`, exportado desde el índice de navegación.

- **Estructura:** un `<nav aria-label>` con una lista de enlaces `<a href="?tab=…">`. Cada elemento lleva icono de Phosphor, etiqueta e indicador (`indicator: ReactNode`) y, opcionalmente, hijos (`children`) con la misma forma. El enlace actual lleva `aria-current="page"`.
- **Navegación:** el clic se intercepta para actualizar los parámetros con `setSearchParams(…, { replace: true })`, como hoy. Así se evita recargar y la dirección sigue siendo un enlace real que se puede abrir en otra pestaña.
- **Disposición:** vertical desde `lg` (1024 px). Por debajo es una fila con `overflow-x-auto`. El elemento actual se lleva a la vista con `scrollIntoView({ block: 'nearest', inline: 'nearest' })`, como hace `Tabs`.
- **Estilo del elemento actual:** fondo `accent-soft`, texto `accent-strong`, peso 600 y marca de 3 px en `accent`, a la izquierda en vertical y abajo en horizontal. Cada elemento mide al menos 44 px de alto.

*Alternativa descartada:* añadir a `Tabs` una orientación vertical. Una lista de pestañas ARIA no admite elementos anidados, y las flechas arriba/abajo con subsecciones confundirían la semántica. `Tabs` se conserva sin cambios para las fichas de mantenimiento y los demás usos.

### D2. Hoja única y paneles conservados

`ConfiguredWorkshopContent` pasa a componer:

- el `PageHeader` con el resumen (D6);
- una sola superficie con borde (`rounded-panel border border-line bg-surface`, sin sombra) en rejilla `lg:grid-cols-[256px_minmax(0,1fr)]`: `SectionNav` en la columna izquierda y, en la derecha, los cinco paneles.

Los paneles inactivos se conservan montados con el atributo `hidden`, que reproduce la conducta de `keepMounted`. *Facturación electrónica* se monta en la primera visita, como hoy.

Un `Dialog` abierto ya bloquea la interacción con el resto de la página. Así se cumple que un modal impide cambiar de sección.

Las secciones se extraen de la página a archivos propios en `frontend/src/pages/workshop-configuration/sections/` (`EntitiesSection`, `WarehouseSection`, `TaxesSection` y `SeriesSection`). Así la página baja de tamaño sin cambiar su lógica: se trasladan los mismos hooks de `features/workshop-configuration/queries.ts`.

### D3. Modo de consulta con `FactList`

Para las filas etiqueta–valor se añade `FactList`/`FactRow` en `frontend/src/shared/ui/surfaces/`:

- estructura `<dl>` con filas separadas por `border-line`;
- desde `sm`, etiqueta a la izquierda (columna de unos 180 px) y valor a la derecha;
- en teléfono, etiqueta encima del valor.

`DetailItem` se mantiene para las fichas que ya lo usan.

Las tablas de impuestos y series reutilizan el estilo de tabla existente, con una fila de grupo por entidad. La fila de grupo muestra `FiscalScopeBadge`, la razón social y `RucPlate`. Los códigos y números usan `font-mono` y las cifras, `tabular-nums`.

El texto de uso de cada entidad se toma de las decisiones confirmadas y se fija por tipo:

- comercial: «Proveedores, ingresos, inventario y ventas de repuestos»;
- artesanal: «Mantenimientos, reparaciones, servicios y mano de obra».

### D4. `RucPlate` como pieza del taller

Se crea `frontend/src/shared/ui/business/RucPlate.tsx`, junto a `PlateTag`.

- **Estructura:** borde de 1,5 px en `ink`, radio contenido, segmento «RUC» en `ink` con texto `surface` y número en `font-mono` con `tracking-wide`.
- **Accesibilidad:** el marcado es `<span>RUC</span> <span>1140258475001</span>`, con un espacio real, para que se anuncie «RUC 1140258475001» sin `aria-label` duplicado. No inserta separadores en el número.
- **Tamaños:** `md` para las fichas y `sm` para los grupos de tabla y el selector de entidad.
- Se añade al catálogo visual interno.

### D5. Estado de facturación derivado en el frontend

La lógica se reparte en dos módulos:

- `frontend/src/features/fiscal/configuration/readiness.ts`:
  - `sectionForCause(code)` devuelve una de `'perfil' | 'puntos' | 'impuestos' | 'formas-pago' | 'certificado' | null` según la tabla del contexto;
  - `summarizeEntityStatus(status)` agrupa `causes` por subsección y conserva en `general` las causas no atribuibles.
- `useConfigurationReadiness(entityIds)`: consulta el estado de las dos entidades con el hook `useElectronicStatus` existente, que comparte caché con la sección.

Con eso se alimentan:

- el resumen del encabezado: la suma de `causes` de las dos entidades, sin `warnings`;
- el indicador de *Facturación electrónica* en `SectionNav`;
- el estado de cada entidad en la sección *Entidades fiscales*;
- los indicadores de las subsecciones para la entidad seleccionada: `Completo`, `N pendientes`, `Opcional` o `Revisar`;
- el enlace «Resolver» de la franja de estado, que abre la subsección de la primera causa.

*Alternativa descartada:* añadir un campo `section` a la respuesta del servidor. Sería más robusto frente a códigos nuevos, pero cambia la API y OpenAPI en un cambio que la propuesta declara solo de presentación. El riesgo se mitiga con el tratamiento `general` y con pruebas de la tabla de correspondencia.

### D6. Resumen del encabezado

`ConfigurationSummary` sustituye la insignia «Sistema operativo» en las acciones del `PageHeader`:

- mientras carga, un marcador de posición;
- con error, «No se pudo evaluar el estado de la configuración»;
- sin causas, «Sin pendientes de configuración»;
- con causas, «N pendientes en Facturación electrónica», con enlace a `?tab=facturacion&entidad=<id>&seccion=<subsección>` de la primera causa.

Ningún texto menciona validación del SRI.

### D7. Entidad seleccionada en la dirección

Para que el resumen y la ficha de entidad abran la entidad correcta, `FiscalConfigurationSection` lee y escribe `?entidad=<id>`. Si el valor falta o no corresponde a una entidad, usa la primera, como hoy.

El selector deja de ser un `<select>` y pasa a un `fieldset` con `legend` «Entidad fiscal» y dos `input type="radio"` estilizados como opciones de al menos 64 px de alto (`EntityChoice`). Cada opción muestra el tono de su ámbito, la razón social, `RucPlate sm` y el estado en texto. La opción marcada usa un borde de 1,5 px y el fondo suave de su ámbito, además del estado nativo del control.

El contenido se sigue montando con `key={selected.id}`, que ya garantiza que no queden datos, formularios ni errores de la otra entidad.

### D8. Subsecciones en la navegación y en teléfono

Cuando `tab=facturacion`, `ConfiguredWorkshopContent` pasa a `SectionNav` los cinco hijos con sus indicadores (D5). Para ello `FiscalConfigurationSection` expone la entidad seleccionada mediante los parámetros de la dirección (D7) y ambos componentes leen la misma fuente.

Por debajo de `lg`, `FiscalConfigurationSection` muestra su propio `SectionNav` horizontal solo con las subsecciones y `aria-label="Subsecciones de facturación electrónica"`. Lo oculta con `lg:hidden`. Los hijos del `SectionNav` principal se ocultan con `hidden lg:block`. `display: none` saca de la vista y del árbol accesible la navegación que no aplica, así que nunca hay dos navegaciones visibles para las subsecciones.

La franja de estado reemplaza a `ElectronicStatusCard` como bloque: una sola banda con el tono del estado, el nombre, las causas en texto y el enlace. «Ambiente disponible: Pruebas» y la aclaración de que no hay validación del SRI pasan a «Información avanzada».

### D8b. Revisión con el usuario: menos texto en facturación

Tras la validación directa del usuario (2026-09-26), la sección *Facturación electrónica* se aligera:

- se retira la franja de estado a todo el ancho; el estado de cada entidad vive en su opción del selector y cada causa se muestra en una línea breve al inicio de la subsección que la resuelve (`sectionForCause`); las causas no atribuibles, en una línea bajo el selector;
- el aviso permanente queda como única línea bajo el título y se retira la etiqueta «Preparación local», que lo repetía;
- «Ambiente disponible: Pruebas» y la aclaración sobre el SRI dejan de mostrarse arriba: el ambiente sigue en *Establecimientos y puntos de emisión* y la aclaración, en la descripción del perfil;
- el selector de entidad usa opciones grandes con indicador de selección visible, `ScopeLabel`, razón social, `RucPlate` y estado;
- las subsecciones tienen nombres breves en la navegación (`READINESS_SECTION_SHORT_LABELS`) e indicadores mínimos; las acciones de tabla son botones secundarios con icono;
- `.ui-button` recupera `cursor: pointer`, que el reinicio de Tailwind v4 quita a todos los botones.

Segunda revisión del usuario (2026-09-26):

- el selector de entidad pasa a un control segmentado compacto en las acciones del título de *Facturación electrónica*; cada opción muestra ámbito, razón social y marcador de estado, y la placa de RUC de la entidad seleccionada va debajo del control;
- la página usa un encabezado propio con la descripción breve en una línea (sin el `max-w-[72ch]` de `PageHeader`);
- desde `md`, la página es una columna flexible con alto mínimo `calc(100dvh - 100px)` (barra superior de 60 px más el relleno vertical del contenido) y la hoja ocupa el resto con `flex-1`, de modo que su altura no cambia entre secciones.

Tercera revisión del usuario (2026-09-26):

- se retira el título «Facturación electrónica»; el título es la subsección actual, con icono en el tono del ámbito seleccionado;
- el aviso permanente pasa a la insignia «Preparación local» (`HintPopover`, con el aviso como descripción accesible) y los pendientes, a un indicador de advertencia con su detalle en `HintPopover`; `PendingNotes` se retira;
- `HintPopover` (en `shared/ui/overlays`) se abre con puntero, foco o toque, se cierra con Escape o al tocar fuera y mide 44 px en dispositivos táctiles; el `Tooltip` existente es de una sola línea y no sirve para listas;
- los estados usan `StateChip` con los tonos semánticos de Tallkit y las cabeceras de tabla, el gris suave de la especificación visual;
- a pedido del usuario, la aplicación entera usa suavizado de letra (`-webkit-font-smoothing: antialiased` en `body`) y los títulos de página pasan a negrita (700) en `PageHeader`; el tamaño se mantiene en 22 px;
- en facturación, la advertencia de pendientes y «Preparación local» se alinean en una fila fija junto a la placa del RUC, bajo el selector; el título queda solo con su descripción, y las acciones de tabla usan botones compactos (32 px, 44 px en táctil);
- el certificado se muestra como tarjeta (`CertificateCard`) y su modal usa el nuevo tamaño `large` de `Modal` (860 px), con pasos numerados, atajos de duración y vista previa en vivo.

### D9. Perfil tributario por condición

`ProfileConditionsSection` pasa a una tabla de seis filas: condición, declaración con marcador y texto, detalle y vigencia desde, con guion si falta. Cada fila tiene la acción «Declarar» o «Editar».

`ConditionDialog` usa `FormModal`, que ya ofrece el aviso al cerrar con cambios, con el ancho estándar de modal. El modal muestra:

- la declaración como `fieldset` de tres radios;
- los campos condicionales actuales (valor, fundamento, inicio y fin);
- la ayuda de la condición;
- un `<details>` «¿Por qué se solicita?» con el texto de ayuda de `CONDITIONS`.

Al guardar se construye el mapa completo: las condiciones de `profile.data.conditions` con la editada sustituida. Se envía `saveProfile` con `expected_revision` y el certificado actual, sin tocar el contrato.

Si el servidor rechaza por revisión obsoleta, el modal muestra el error con `errorMessage`, conserva lo escrito y ofrece recargar el perfil. No reintenta en silencio. El éxito cierra el modal y emite «Condición guardada.» como notificación temporal.

### D10. Información avanzada

Un componente `AdvancedInfo`, basado en `<details>`/`<summary>` nativos y con estilo Tallkit, agrupa:

- en *Impuestos y catálogo SRI*: los códigos oficiales, la versión de ficha y la fuente;
- en *Formas de pago SRI*: la fuente, la versión y la fecha de descarga;
- en la franja de estado: el ambiente y la aclaración sobre el SRI.

Los datos siguen en el DOM y son accesibles al desplegar.

### D11. Pruebas

La estrategia sigue TDD, vinculada a los escenarios de las specs.

**Vitest:**

- `SectionNav`: enlaces, `aria-current` en la sección y en la subsección, `href` conservando otros parámetros e indicadores.
- `RucPlate`: nombre accesible y ausencia de separadores.
- `readiness.ts`: cada prefijo, un código desconocido (`general`) y las advertencias no contadas.
- `ConfigurationSummary`: carga, error, sin pendientes, con pendientes y destino del enlace.
- `EntitiesSection`: vista de consulta sin campos, estado con causa y enlace, y edición en modal con notificación y con error de RUC repetido.
- `ConditionDialog`: campos según la declaración, conservación de las otras condiciones en el envío y conflicto de revisión.
- Se actualizan `WorkshopConfigurationPage.test.tsx`, `FiscalConfigurationSection.test.tsx` y `app/configuration-routes.test.tsx`: roles `tab`/`tablist` pasan a `navigation`/`link` con `aria-current`, `tab`, `seccion` y `entidad` desconocidos, y el estado conservado al volver.

**Playwright:** se actualiza `frontend/e2e/workshop-configuration.spec.ts`: recorrido por secciones, enlace directo a `tab=facturacion&seccion=puntos`, pendiente del resumen y edición de una condición. También los pasos de `fiscal.spec.ts` que abren subsecciones por rol `tab`. La comprobación de `responsive.spec.ts` para la configuración cubre 360, 768, 1024, 1280 y 1440 px con `axe` y sin desplazamiento horizontal.

Conforme a la práctica del proyecto, se ejecutan solo las pruebas de los archivos y E2E afectados, `tsc`, ESLint sobre los archivos tocados y Prettier. El backend no se ejecuta porque no cambia.

### D12. Documentación

- `docs/negocio/requisitos/interfaz-y-navegacion.md`: UI-013 (navegación de secciones, resumen, `entidad`) y UI-019 (subsecciones anidadas, selector visible, perfil por condición).
- `DESIGN.md`: marco de la página de configuración, `SectionNav`, `FactList` y `RucPlate` en «Piezas del taller».
- `docs/negocio/producto/glosario.md`: «Placa de RUC».
- `docs/negocio/requisitos/matriz-trazabilidad.md`: nuevas requirements.
- Las specs principales se sincronizan al archivar.

No se requiere ADR: la decisión es de presentación, local a una página y reversible.

## Risks / Trade-offs

- [Códigos de causa nuevos o renombrados en el backend dejan una subsección sin su pendiente.] → Las causas no atribuibles se muestran y cuentan en la franja general. Una prueba de `readiness.ts` fija la tabla, y una nota en `electronic_status.py` enlaza a esa tabla para quien añada causas.
- [Guardar condiciones por separado aumenta los conflictos de revisión entre administradores.] → El backend ya rechaza revisiones obsoletas. El modal lo explica y ofrece recargar sin perder lo escrito.
- [Dos consultas de estado fiscal al abrir la página, antes una sola al visitar *Facturación electrónica*.] → Son dos solicitudes ligeras, compartidas en caché con la sección, y solo para el Administrador.
- [El paso de pestañas ARIA a enlaces cambia el modelo de teclado: Tab en lugar de flechas.] → Es el patrón habitual de navegación. Se documenta en UI-013 y lo cubren pruebas de teclado.
- [Pruebas existentes que buscan roles `tab` fallarán.] → Se actualizan en el mismo grupo de tareas que el cambio de componente.
- [La maqueta usa medidas que las specs no permiten: título de 28 px y modal de 600 px.] → Se implementa lo que dicen las specs (propuesta, «Diferencias de la maqueta»).

## Migration Plan

No hay migración de datos. Los enlaces existentes `?tab=` y `?seccion=` siguen funcionando, y `?entidad=` es opcional. El despliegue es el del frontend. La vuelta atrás consiste en revertir los commits del cambio, sin efectos en datos.

## Open Questions

Ninguna que bloquee. Si más adelante se prefiere que el backend informe la subsección de cada causa, requerirá un cambio propio con actualización de OpenAPI.

### D8c. Cuarta revisión: mismo estilo que las demás secciones

El usuario pidió que las subsecciones de facturación sigan el estilo de *Entidades fiscales*, *Bodega* y *Series*, y que la estructura sea simétrica:

- `EntitySwitch` pasa a una barra de pestañas rectas con línea inferior (como `SectionNav` horizontal) y la placa del RUC a la derecha de la misma fila;
- cada subsección vuelve a su `SheetHeading` (título, descripción y acciones); los avisos se inyectan como `hints` desde `FiscalConfigurationSection`;
- `HintPopover` gana la variante `button`, con el alto, el borde y la esquina de `Button` secundario, y su panel se alinea al borde del disparador;
- los estados vuelven a `StateMark` y las acciones de fila, a `Button` `quiet`; el certificado en consulta usa `FactList` y la tarjeta queda solo como vista previa del modal.

En la verificación final, la hoja pasó de alto mínimo a alto fijo desde `md` (`h-[calc(100dvh-100px)]`), con desplazamiento interno del contenido (`md:overflow-y-auto`) y de la navegación (`lg:overflow-y-auto`), para que su altura no cambie aunque una sección tenga más contenido que la ventana.
