## 1. Preparación y política de verificación

Dependencias: propuesta, specs y diseño aprobados y registrados en `master` antes de aplicar.

Por instrucción del usuario, solo se ejecutan pruebas focalizadas:
- frontend: `cd frontend && npx vitest run <archivo>`, `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint <archivos tocados>` y `npx prettier --check <archivos tocados>`;
- E2E: solo `e2e/workshop-configuration.spec.ts`, `e2e/fiscal.spec.ts` y el caso de configuración de `e2e/responsive.spec.ts`.

No se ejecuta el backend, porque no cambia. Tampoco se ejecutan `make check`, `make test` ni Playwright completo; si una tarea los pide, se registra qué se ejecutó y qué no. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde.

- [x] 1.1 Comprobar el estado Git y que los artefactos de este cambio estén en `master`. Revisar `git log` por si hay cambios ajenos en `WorkshopConfigurationPage.tsx` o en `features/fiscal/configuration/` y registrar cualquier contradicción nueva.
- [x] 1.2 Ejecutar la línea base focalizada antes de tocar código y registrar el resultado: `npx vitest run src/pages/workshop-configuration src/features/fiscal/FiscalConfigurationSection.test.tsx src/app/configuration-routes.test.tsx`.

## 2. Piezas compartidas

Dependencias: grupo 1. Diseño D1, D3, D4 y D10; specs `sistema-visual-frontend` («Piezas visuales propias del taller») y `organizacion-de-la-configuracion` («Accesibilidad y navegación directa de las secciones»).

- [x] 2.1 Escribir pruebas de `RucPlate` en `src/shared/ui/business/business.test.tsx`:
  - nombre accesible «RUC 1140258475001»;
  - los 13 dígitos sin separadores;
  - tamaños `sm` y `md`.

  Después, crear `src/shared/ui/business/RucPlate.tsx` y exportarlo desde `business/index.ts`.
- [x] 2.2 Escribir `src/shared/ui/navigation/SectionNav.test.tsx`:
  - región `navigation` con nombre accesible;
  - un enlace por elemento, con `href` que conserva los demás parámetros;
  - `aria-current="page"` en el elemento actual y en el hijo actual;
  - hijos visibles solo en el elemento que los declara;
  - indicador con texto accesible;
  - activación por clic sin recarga, mediante el `onSelect` recibido;
  - desplazamiento del elemento actual a la vista.
- [x] 2.3 Crear `src/shared/ui/navigation/SectionNav.tsx` según D1: vertical desde `lg` y horizontal con desplazamiento interno por debajo, elementos de al menos 44 px y marca de selección con `accent`. Exportarlo desde `navigation/index.ts`. `Tabs` no se modifica.
- [x] 2.4 Escribir pruebas y crear `FactList`/`FactRow` en `src/shared/ui/surfaces/`:
  - estructura `dl`/`dt`/`dd`;
  - etiqueta a la izquierda desde `sm` y encima del valor por debajo;
  - separadores `border-line`.
- [x] 2.5 Escribir pruebas y crear `AdvancedInfo` en `src/shared/ui/surfaces/`: `details`/`summary` nativos, plegado por defecto y contenido presente en el DOM.
- [x] 2.6 Añadir `RucPlate`, `SectionNav`, `FactList` y `AdvancedInfo` al catálogo visual interno (`src/dev/visual-catalog/previews.tsx`).
- [x] 2.7 Verificar: `npx vitest run` de los archivos de prueba de 2.1 a 2.5, más `tsc`, ESLint y prettier sobre los archivos tocados.

## 3. Estado de facturación derivado

Dependencias: grupo 1. Diseño D5 y D6; specs «Resumen del estado de la configuración» y «Subsecciones de facturación electrónica».

- [x] 3.1 Escribir `src/features/fiscal/configuration/readiness.test.ts`:
  - `sectionForCause` para cada prefijo o código de la tabla del diseño (`conditions.*`, `tax_mapping.*`, `point_missing`, `default_point_required`, `establishment_address`, `payment_forms_missing`, `default_payment_form_required`, `certificate_*`) y `null` para un código desconocido;
  - `summarizeEntityStatus`: agrupación por subsección, causas desconocidas en `general`, advertencias no contadas como pendientes y la primera causa como destino.
- [x] 3.2 Crear `src/features/fiscal/configuration/readiness.ts` con las funciones puras de 3.1.
- [x] 3.3 Escribir pruebas y crear el hook `useConfigurationReadiness(entityIds)` sobre `useElectronicStatus`: estados de carga y error, suma de pendientes de ambas entidades y destino (`entidad` y `seccion`) de la primera causa.
- [x] 3.4 Añadir en `backend/src/workshop_configuration/application/electronic_status.py` un comentario que remita a la tabla de `readiness.ts` para quien añada códigos de causa. No se cambia comportamiento ni se ejecutan pruebas de backend.
- [x] 3.5 Verificar: `npx vitest run src/features/fiscal/configuration/readiness.test.ts` y la prueba del hook, más `tsc`, ESLint y prettier.

## 4. Hoja de configuración y navegación de secciones

Dependencias: grupos 2 y 3. Diseño D2, D6 y D8; specs «Navegación de secciones de la configuración», «Accesibilidad y navegación directa de las secciones» y «Resumen del estado de la configuración».

- [x] 4.1 Actualizar primero `src/pages/workshop-configuration/WorkshopConfigurationPage.test.tsx` y `src/app/configuration-routes.test.tsx`:
  - pasar de roles `tablist`/`tab` a `navigation`/`link` con `aria-current`;
  - sección inicial *Entidades fiscales*;
  - `tab` desconocido abre *Entidades fiscales*;
  - enlace directo `tab=facturacion&seccion=puntos`;
  - estado conservado al volver a una sección;
  - un modal abierto impide cambiar de sección;
  - sin la insignia «Sistema operativo».

  Confirmar que las pruebas fallan por la razón esperada.
- [x] 4.2 Extraer `EntitiesSection`, `WarehouseSection`, `TaxesSection` y `SeriesSection` a `src/pages/workshop-configuration/sections/`, sin cambiar su lógica ni sus hooks. Las pruebas existentes deben seguir pasando antes del rediseño visual.
- [x] 4.3 Recomponer `ConfiguredWorkshopContent` según D2:
  - una superficie con borde y sin sombra;
  - rejilla `lg:grid-cols-[256px_minmax(0,1fr)]` con `SectionNav` y los paneles conservados mediante `hidden`;
  - *Facturación electrónica* montada en la primera visita;
  - indicadores de registros por sección y de pendientes de *Facturación electrónica*.
- [x] 4.4 Escribir pruebas y crear `ConfigurationSummary` (D6), con sus textos: carga, «No se pudo evaluar el estado de la configuración», «Sin pendientes de configuración» y «N pendientes en Facturación electrónica» con su enlace. Colocarlo en las acciones de `PageHeader`.
- [x] 4.5 Verificar: los archivos de 4.1 y 4.4 en verde, más `tsc`, ESLint y prettier.

## 5. Secciones en modo de consulta

Dependencias: grupo 4. Diseño D3; specs «Consulta primero y edición en modal», «Entidades fiscales en fichas de consulta paralelas» y «Reorganización sin cambio funcional de las áreas existentes».

- [x] 5.1 Escribir pruebas de `EntitiesSection`:
  - vista de consulta sin campos de formulario;
  - ámbito, razón social, `RucPlate` y uso fijo por tipo;
  - estado de facturación con su causa y el enlace a la subsección cuando no está lista;
  - número de series activas con enlace;
  - «Editar» abre el modal, guarda y emite la notificación;
  - un RUC repetido mantiene el modal con el error junto al campo.
- [x] 5.2 Rediseñar `EntitiesSection`: dos columnas desde `xl` (1280 px) separadas por una línea, una columna por debajo y `FactList`. El modal de edición se conserva con sus validaciones actuales.
- [x] 5.3 Escribir pruebas y rediseñar `WarehouseSection` como ficha breve con `FactList` y edición del nombre en modal, conservando validaciones y resultados.
- [x] 5.4 Escribir pruebas y rediseñar `TaxesSection`:
  - tabla agrupada por entidad, con fila de grupo (`FiscalScopeBadge`, razón social y `RucPlate sm`) y vigencias en orden cronológico;
  - crear, suceder o corregir sigue en modal;
  - el error de solapamiento permanece en su modal.
- [x] 5.5 Escribir pruebas y rediseñar `SeriesSection`:
  - COM-ING, COM-PRO y COM-VEN bajo la entidad comercial y ART-SER bajo la artesanal;
  - códigos y números en `font-mono` con `tabular-nums`;
  - acciones de corrección o sustitución según el estado de cada serie;
  - sin puntos fiscales.
- [x] 5.6 Verificar: `npx vitest run src/pages/workshop-configuration`, más `tsc`, ESLint y prettier.

## 6. Facturación electrónica

Dependencias: grupos 3 a 5. Diseño D7 a D10; specs «Subsecciones de facturación electrónica», «Perfil tributario presentado por condición» y «Consulta primero y edición en modal».

- [x] 6.1 Actualizar primero `src/features/fiscal/FiscalConfigurationSection.test.tsx`:
  - aviso permanente con su texto exacto;
  - selección de entidad con dos opciones de radio que muestran razón social, RUC y estado;
  - parámetro `entidad` (lectura, escritura y valor desconocido);
  - al cambiar de entidad se reemplazan datos, errores y formularios;
  - franja de estado con causas y enlace;
  - una causa desconocida aparece en la franja;
  - advertencia del certificado separada del estado;
  - barra de subsecciones solo por debajo de `lg`.
- [x] 6.2 Crear `EntityChoice` y sustituir el `<select>`. Leer y escribir `?entidad=` y conservar `key={selected.id}`.
- [x] 6.3 Sustituir `ElectronicStatusCard` por la franja de estado de D8. Mover «Ambiente disponible: Pruebas» y la aclaración sobre el SRI a `AdvancedInfo`.
- [x] 6.4 Pasar a `SectionNav` los hijos de *Facturación electrónica* con sus indicadores (`Completo`, `N pendientes`, `Opcional` o `Revisar`) cuando `tab=facturacion`, visibles desde `lg`. Por debajo de `lg`, `FiscalConfigurationSection` muestra su `SectionNav` horizontal de subsecciones. Retirar la instancia de `Tabs` con `variant="pill"`.
- [x] 6.5 Escribir pruebas de `ConditionDialog` y de la tabla del perfil:
  - seis filas con declaración en texto y marcador, detalle y vigencia o guion;
  - «Declarar» o «Editar» según el estado;
  - campos según la declaración;
  - «¿Por qué se solicita?» plegado;
  - el envío conserva las otras cinco condiciones y el certificado, con `expected_revision`;
  - el conflicto de revisión muestra el error en el modal y conserva lo escrito;
  - notificación «Condición guardada.».
- [x] 6.6 Reescribir `ProfileConditionsSection` como tabla y crear `ConditionDialog` sobre `FormModal`, sin cambiar el contrato de `saveProfile`.
- [x] 6.7 Agrupar en `AdvancedInfo` los datos técnicos de `TaxMappingsSection` (código oficial, versión de ficha y fuente) y de `PaymentFormsSection` (fuente, versión y fecha de descarga). Añadir o ajustar sus pruebas para comprobar que el nombre comprensible se ve y el código solo al desplegar.
- [x] 6.8 Revisar `LocationsSection` y `CertificateSection`: vista de consulta primero y formularios solo en modal, conservando sus reglas.
- [x] 6.9 Verificar: `npx vitest run src/features/fiscal src/pages/workshop-configuration`, más `tsc`, ESLint y prettier.

## 7. Recorridos E2E y adaptación

Dependencias: grupos 4 a 6. Specs `organizacion-de-la-configuracion` y `experiencia-adaptable-frontend` («Verificación en tamaños representativos»).

- [x] 7.1 Actualizar `e2e/workshop-configuration.spec.ts`:
  - recorrido por la navegación de secciones con teclado;
  - enlace directo `tab=facturacion&seccion=puntos`;
  - el pendiente del resumen abre la entidad y la subsección;
  - edición de una entidad en modal;
  - declaración de una condición.
- [x] 7.2 Actualizar en `e2e/fiscal.spec.ts` los pasos que abren subsecciones por rol `tab`.
- [x] 7.3 Añadir la configuración a `e2e/responsive.spec.ts` en 360, 768, 1024, 1280 y 1440 px, con `axe` y sin desplazamiento horizontal.
- [x] 7.4 Ejecutar solo `npx playwright test e2e/workshop-configuration.spec.ts e2e/fiscal.spec.ts` y el caso de configuración de `e2e/responsive.spec.ts`. Registrar el resultado y lo no ejecutado.

## 8. Documentación, trazabilidad y cierre

Dependencias: grupos 2 a 7. Diseño D12.

- [x] 8.1 Añadir «Placa de RUC» a `docs/negocio/producto/glosario.md`.
- [x] 8.2 Actualizar en `docs/negocio/requisitos/interfaz-y-navegacion.md` UI-013 (navegación de secciones, resumen y parámetro `entidad`) y UI-019 (subsecciones anidadas, selector visible y perfil por condición), junto con sus archivos de referencia de glosario.
- [x] 8.3 Actualizar `DESIGN.md`: composición de la configuración, `SectionNav`, `FactList`, `AdvancedInfo` y `RucPlate` en «Piezas del taller».
- [x] 8.4 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` con las requirements nuevas y modificadas, cada una con su prueba.
- [x] 8.5 Verificación final focalizada:
  - `npm run build`;
  - vitest de todos los archivos tocados;
  - `tsc`, ESLint y prettier sobre los archivos tocados;
  - `openspec validate redisenar-pagina-de-configuracion --strict`.

  Registrar comandos, resultados y lo no ejecutado (suite completa de frontend, backend y resto de Playwright).
- [ ] 8.6 Pedir al usuario que valide la página directamente en la aplicación (`sistema-visual-frontend`, validación directa) y registrar sus correcciones antes de archivar.

## 9. Revisión del usuario: facturación electrónica con menos texto

Dependencias: grupos 1 a 8. Diseño D8b; spec «Subsecciones de facturación electrónica» actualizada.

- [x] 9.1 Actualizar las pruebas de `FiscalConfigurationSection.test.tsx`: sin franja de estado; causa atribuida al inicio de su subsección; causa no atribuible bajo el selector; advertencia del certificado solo en *Certificado*; selector con indicador de selección; botones con icono en el perfil.
- [x] 9.2 Rediseñar el encabezado, `EntityChoice` y la presentación del estado en `FiscalConfigurationSection` y sus subsecciones; acortar descripciones.
- [x] 9.3 Usar nombres breves e indicadores mínimos para las subsecciones en `SectionNav` y ajustar la página y sus pruebas.
- [x] 9.4 Restaurar `cursor: pointer` en `.ui-button` habilitado.
- [x] 9.5 Selector de entidad compacto junto al título, placa del RUC seleccionado bajo el control, encabezado de página con descripción en una línea y hoja con alto completo estable desde `md`.
- [x] 9.6 Verificar: vitest de los archivos afectados, `tsc`, ESLint, Prettier, E2E de configuración y facturación, y capturas comparadas.
- [x] 9.7 Tercera revisión: título por subsección, insignia «Preparación local» y advertencia de pendientes con `HintPopover`, chips de estado con los tonos del sistema, cabeceras de tabla en gris suave y modal amplio del certificado con pasos, atajos y vista previa.
- [x] 9.8 Suavizado de letra global, títulos de página en negrita, indicadores alineados junto a la placa del RUC y botones de tabla compactos.

## Revisión y evidencia (2026-09-26)

**Revisión de la implementación previa.** Una primera aplicación, hecha con otra herramienta, marcó varias tareas sin cumplirlas. Estos son los defectos encontrados:

- Dejó unas 900 líneas de secciones antiguas duplicadas en `WorkshopConfigurationPage.tsx`.
- El resumen decía «Sin pendientes» cuando la única causa no pertenecía a ninguna subsección.
- En *Entidades fiscales* los pendientes se asignaban solo a una entidad.
- Mantuvo tarjetas (`Surface`) dentro de la hoja y errores fuera de los modales.
- El perfil tributario no controlaba los cambios sin guardar ni el conflicto de revisión.
- La composición no seguía la maqueta aprobada.

Se partió de nuevo del código de `master`: el formulario de inicialización se conservó intacto y se reescribieron la composición, las secciones, la sección fiscal y sus subsecciones siguiendo la maqueta y las specs.

Diferencias y decisiones registradas durante la aplicación:

- 4.2: las secciones se extrajeron a `sections/` y se rediseñaron en el mismo paso, conservando hooks, contratos, validaciones y acciones. Sus pruebas están en `WorkshopConfigurationPage.test.tsx`.
- 5.5: además de corregir el código de una serie sin uso, se ofrece «Sustituir serie» para una serie usada, con el endpoint de sustitución ya existente (`useReplaceSeries`).
- 6.x: `hooks.ts` ahora refresca el estado fiscal al crear un establecimiento o un punto, para que el pendiente desaparezca sin recargar. `ElectronicStatusCard` se retiró porque la sustituyó la franja de estado.
- 7.2: `e2e/fiscal.spec.ts` no tenía pasos con rol `tab`, así que no hubo cambios.
- 7.3: la comprobación de los cinco anchos con `axe` se añadió a `e2e/workshop-configuration.spec.ts` y no a `responsive.spec.ts`. Esta última usa el backend real, donde el taller no está inicializado, mientras que la primera simula las respuestas de configuración.
- Adaptación: las etiquetas `sr-only` (con posición absoluta) ensanchaban el documento porque los contenedores con desplazamiento no estaban posicionados. Se añadió `relative` a esos contenedores y a la hoja.
- Tipografía: el título de página se mantiene en unos 22 px (`sistema-visual-frontend`) y los modales usan el ancho estándar de `FormModal`, como registró la propuesta.

Ejecutado:

- `npx vitest run src/shared/ui src/features/fiscal src/pages/workshop-configuration src/app/configuration-routes.test.tsx src/dev` → 54 archivos, 301 pruebas pasan.
- `npx tsc --noEmit -p tsconfig.app.json` sin errores.
- ESLint y Prettier (`--check`) sobre los 38 archivos TypeScript tocados, sin incidencias.
- `npm run build` correcto, con el aviso previo de tamaño de chunks.
- `npx playwright test e2e/workshop-configuration.spec.ts e2e/fiscal.spec.ts` → 15 pruebas pasan, incluidas `axe` y la ausencia de desplazamiento horizontal en 360, 768, 1024, 1280 y 1440 px.
- Capturas de la aplicación a 1440 y 390 px (entidades, series, facturación, puntos y modal de condición), comparadas con la maqueta.

No ejecutado, por instrucción del usuario: `make check`, `make test`, la suite completa de frontend, el backend (solo cambió un comentario en `electronic_status.py`) y el resto de Playwright.

### Revisiones del usuario (grupo 9)

Primera revisión: se retiraron la franja de estado, el aviso del certificado fuera de su subsección, la «Información avanzada» superior y la etiqueta «Preparación local». Las descripciones quedaron en una frase, las subsecciones usan nombres breves e indicadores mínimos, y las acciones de tabla son botones con icono. La causa `profile` del backend se asigna a *Perfil tributario*. `.ui-button` recupera `cursor: pointer`, que el reinicio de Tailwind v4 había quitado a todos los botones de la aplicación.

Segunda revisión: el selector de entidad pasó a un control segmentado compacto junto al título, con la placa del RUC seleccionado debajo. El encabezado tiene la descripción en una línea y, desde `md`, la hoja ocupa todo el alto disponible.

Tercera revisión: el título es la subsección actual, con icono en el tono del ámbito. «Preparación local» y los pendientes se consultan en `HintPopover` (puntero, foco o toque), los estados usan chips con los tonos del sistema y las cabeceras de tabla van en gris suave. El certificado es una tarjeta, y su modal amplio tiene pasos, atajos de duración y vista previa en vivo.

Verificación: vitest de los archivos afectados → 287 pruebas pasan; `tsc`, ESLint y Prettier sin incidencias; `npx playwright test e2e/workshop-configuration.spec.ts e2e/fiscal.spec.ts` → 15 pasan; capturas a 1440 × 900 y 390 px revisadas. No se ejecutaron la suite completa, el backend ni el resto de Playwright.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
