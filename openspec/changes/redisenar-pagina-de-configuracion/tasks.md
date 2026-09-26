## 1. Preparación y política de verificación

Dependencias: propuesta, specs y diseño aprobados y registrados en `master` antes de aplicar.

Por instrucción del usuario, solo se ejecutan pruebas focalizadas:
- frontend: `cd frontend && npx vitest run <archivo>`, `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint <archivos tocados>` y `npx prettier --check <archivos tocados>`;
- E2E: solo `e2e/workshop-configuration.spec.ts`, `e2e/fiscal.spec.ts` y el caso de configuración de `e2e/responsive.spec.ts`.

No se ejecuta el backend, porque no cambia. Tampoco se ejecutan `make check`, `make test` ni Playwright completo; si una tarea los pide, se registra qué se ejecutó y qué no. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde.

- [ ] 1.1 Comprobar el estado Git y que los artefactos de este cambio estén en `master`. Revisar `git log` por si hay cambios ajenos en `WorkshopConfigurationPage.tsx` o en `features/fiscal/configuration/` y registrar cualquier contradicción nueva.
- [ ] 1.2 Ejecutar la línea base focalizada antes de tocar código y registrar el resultado: `npx vitest run src/pages/workshop-configuration src/features/fiscal/FiscalConfigurationSection.test.tsx src/app/configuration-routes.test.tsx`.

## 2. Piezas compartidas

Dependencias: grupo 1. Diseño D1, D3, D4 y D10; specs `sistema-visual-frontend` («Piezas visuales propias del taller») y `organizacion-de-la-configuracion` («Accesibilidad y navegación directa de las secciones»).

- [ ] 2.1 Escribir pruebas de `RucPlate` en `src/shared/ui/business/business.test.tsx`:
  - nombre accesible «RUC 1140258475001»;
  - los 13 dígitos sin separadores;
  - tamaños `sm` y `md`.

  Después, crear `src/shared/ui/business/RucPlate.tsx` y exportarlo desde `business/index.ts`.
- [ ] 2.2 Escribir `src/shared/ui/navigation/SectionNav.test.tsx`:
  - región `navigation` con nombre accesible;
  - un enlace por elemento, con `href` que conserva los demás parámetros;
  - `aria-current="page"` en el elemento actual y en el hijo actual;
  - hijos visibles solo en el elemento que los declara;
  - indicador con texto accesible;
  - activación por clic sin recarga, mediante el `onSelect` recibido;
  - desplazamiento del elemento actual a la vista.
- [ ] 2.3 Crear `src/shared/ui/navigation/SectionNav.tsx` según D1: vertical desde `lg` y horizontal con desplazamiento interno por debajo, elementos de al menos 44 px y marca de selección con `accent`. Exportarlo desde `navigation/index.ts`. `Tabs` no se modifica.
- [ ] 2.4 Escribir pruebas y crear `FactList`/`FactRow` en `src/shared/ui/surfaces/`:
  - estructura `dl`/`dt`/`dd`;
  - etiqueta a la izquierda desde `sm` y encima del valor por debajo;
  - separadores `border-line`.
- [ ] 2.5 Escribir pruebas y crear `AdvancedInfo` en `src/shared/ui/surfaces/`: `details`/`summary` nativos, plegado por defecto y contenido presente en el DOM.
- [ ] 2.6 Añadir `RucPlate`, `SectionNav`, `FactList` y `AdvancedInfo` al catálogo visual interno (`src/dev/visual-catalog/previews.tsx`).
- [ ] 2.7 Verificar: `npx vitest run` de los archivos de prueba de 2.1 a 2.5, más `tsc`, ESLint y prettier sobre los archivos tocados.

## 3. Estado de facturación derivado

Dependencias: grupo 1. Diseño D5 y D6; specs «Resumen del estado de la configuración» y «Subsecciones de facturación electrónica».

- [ ] 3.1 Escribir `src/features/fiscal/configuration/readiness.test.ts`:
  - `sectionForCause` para cada prefijo o código de la tabla del diseño (`conditions.*`, `tax_mapping.*`, `point_missing`, `default_point_required`, `establishment_address`, `payment_forms_missing`, `default_payment_form_required`, `certificate_*`) y `null` para un código desconocido;
  - `summarizeEntityStatus`: agrupación por subsección, causas desconocidas en `general`, advertencias no contadas como pendientes y la primera causa como destino.
- [ ] 3.2 Crear `src/features/fiscal/configuration/readiness.ts` con las funciones puras de 3.1.
- [ ] 3.3 Escribir pruebas y crear el hook `useConfigurationReadiness(entityIds)` sobre `useElectronicStatus`: estados de carga y error, suma de pendientes de ambas entidades y destino (`entidad` y `seccion`) de la primera causa.
- [ ] 3.4 Añadir en `backend/src/workshop_configuration/application/electronic_status.py` un comentario que remita a la tabla de `readiness.ts` para quien añada códigos de causa. No se cambia comportamiento ni se ejecutan pruebas de backend.
- [ ] 3.5 Verificar: `npx vitest run src/features/fiscal/configuration/readiness.test.ts` y la prueba del hook, más `tsc`, ESLint y prettier.

## 4. Hoja de configuración y navegación de secciones

Dependencias: grupos 2 y 3. Diseño D2, D6 y D8; specs «Navegación de secciones de la configuración», «Accesibilidad y navegación directa de las secciones» y «Resumen del estado de la configuración».

- [ ] 4.1 Actualizar primero `src/pages/workshop-configuration/WorkshopConfigurationPage.test.tsx` y `src/app/configuration-routes.test.tsx`:
  - pasar de roles `tablist`/`tab` a `navigation`/`link` con `aria-current`;
  - sección inicial *Entidades fiscales*;
  - `tab` desconocido abre *Entidades fiscales*;
  - enlace directo `tab=facturacion&seccion=puntos`;
  - estado conservado al volver a una sección;
  - un modal abierto impide cambiar de sección;
  - sin la insignia «Sistema operativo».

  Confirmar que las pruebas fallan por la razón esperada.
- [ ] 4.2 Extraer `EntitiesSection`, `WarehouseSection`, `TaxesSection` y `SeriesSection` a `src/pages/workshop-configuration/sections/`, sin cambiar su lógica ni sus hooks. Las pruebas existentes deben seguir pasando antes del rediseño visual.
- [ ] 4.3 Recomponer `ConfiguredWorkshopContent` según D2:
  - una superficie con borde y sin sombra;
  - rejilla `lg:grid-cols-[256px_minmax(0,1fr)]` con `SectionNav` y los paneles conservados mediante `hidden`;
  - *Facturación electrónica* montada en la primera visita;
  - indicadores de registros por sección y de pendientes de *Facturación electrónica*.
- [ ] 4.4 Escribir pruebas y crear `ConfigurationSummary` (D6), con sus textos: carga, «No se pudo evaluar el estado de la configuración», «Sin pendientes de configuración» y «N pendientes en Facturación electrónica» con su enlace. Colocarlo en las acciones de `PageHeader`.
- [ ] 4.5 Verificar: los archivos de 4.1 y 4.4 en verde, más `tsc`, ESLint y prettier.

## 5. Secciones en modo de consulta

Dependencias: grupo 4. Diseño D3; specs «Consulta primero y edición en modal», «Entidades fiscales en fichas de consulta paralelas» y «Reorganización sin cambio funcional de las áreas existentes».

- [ ] 5.1 Escribir pruebas de `EntitiesSection`:
  - vista de consulta sin campos de formulario;
  - ámbito, razón social, `RucPlate` y uso fijo por tipo;
  - estado de facturación con su causa y el enlace a la subsección cuando no está lista;
  - número de series activas con enlace;
  - «Editar» abre el modal, guarda y emite la notificación;
  - un RUC repetido mantiene el modal con el error junto al campo.
- [ ] 5.2 Rediseñar `EntitiesSection`: dos columnas desde `xl` (1280 px) separadas por una línea, una columna por debajo y `FactList`. El modal de edición se conserva con sus validaciones actuales.
- [ ] 5.3 Escribir pruebas y rediseñar `WarehouseSection` como ficha breve con `FactList` y edición del nombre en modal, conservando validaciones y resultados.
- [ ] 5.4 Escribir pruebas y rediseñar `TaxesSection`:
  - tabla agrupada por entidad, con fila de grupo (`FiscalScopeBadge`, razón social y `RucPlate sm`) y vigencias en orden cronológico;
  - crear, suceder o corregir sigue en modal;
  - el error de solapamiento permanece en su modal.
- [ ] 5.5 Escribir pruebas y rediseñar `SeriesSection`:
  - COM-ING, COM-PRO y COM-VEN bajo la entidad comercial y ART-SER bajo la artesanal;
  - códigos y números en `font-mono` con `tabular-nums`;
  - acciones de corrección o sustitución según el estado de cada serie;
  - sin puntos fiscales.
- [ ] 5.6 Verificar: `npx vitest run src/pages/workshop-configuration`, más `tsc`, ESLint y prettier.

## 6. Facturación electrónica

Dependencias: grupos 3 a 5. Diseño D7 a D10; specs «Subsecciones de facturación electrónica», «Perfil tributario presentado por condición» y «Consulta primero y edición en modal».

- [ ] 6.1 Actualizar primero `src/features/fiscal/FiscalConfigurationSection.test.tsx`:
  - aviso permanente con su texto exacto;
  - selección de entidad con dos opciones de radio que muestran razón social, RUC y estado;
  - parámetro `entidad` (lectura, escritura y valor desconocido);
  - al cambiar de entidad se reemplazan datos, errores y formularios;
  - franja de estado con causas y enlace;
  - una causa desconocida aparece en la franja;
  - advertencia del certificado separada del estado;
  - barra de subsecciones solo por debajo de `lg`.
- [ ] 6.2 Crear `EntityChoice` y sustituir el `<select>`. Leer y escribir `?entidad=` y conservar `key={selected.id}`.
- [ ] 6.3 Sustituir `ElectronicStatusCard` por la franja de estado de D8. Mover «Ambiente disponible: Pruebas» y la aclaración sobre el SRI a `AdvancedInfo`.
- [ ] 6.4 Pasar a `SectionNav` los hijos de *Facturación electrónica* con sus indicadores (`Completo`, `N pendientes`, `Opcional` o `Revisar`) cuando `tab=facturacion`, visibles desde `lg`. Por debajo de `lg`, `FiscalConfigurationSection` muestra su `SectionNav` horizontal de subsecciones. Retirar la instancia de `Tabs` con `variant="pill"`.
- [ ] 6.5 Escribir pruebas de `ConditionDialog` y de la tabla del perfil:
  - seis filas con declaración en texto y marcador, detalle y vigencia o guion;
  - «Declarar» o «Editar» según el estado;
  - campos según la declaración;
  - «¿Por qué se solicita?» plegado;
  - el envío conserva las otras cinco condiciones y el certificado, con `expected_revision`;
  - el conflicto de revisión muestra el error en el modal y conserva lo escrito;
  - notificación «Condición guardada.».
- [ ] 6.6 Reescribir `ProfileConditionsSection` como tabla y crear `ConditionDialog` sobre `FormModal`, sin cambiar el contrato de `saveProfile`.
- [ ] 6.7 Agrupar en `AdvancedInfo` los datos técnicos de `TaxMappingsSection` (código oficial, versión de ficha y fuente) y de `PaymentFormsSection` (fuente, versión y fecha de descarga). Añadir o ajustar sus pruebas para comprobar que el nombre comprensible se ve y el código solo al desplegar.
- [ ] 6.8 Revisar `LocationsSection` y `CertificateSection`: vista de consulta primero y formularios solo en modal, conservando sus reglas.
- [ ] 6.9 Verificar: `npx vitest run src/features/fiscal src/pages/workshop-configuration`, más `tsc`, ESLint y prettier.

## 7. Recorridos E2E y adaptación

Dependencias: grupos 4 a 6. Specs `organizacion-de-la-configuracion` y `experiencia-adaptable-frontend` («Verificación en tamaños representativos»).

- [ ] 7.1 Actualizar `e2e/workshop-configuration.spec.ts`:
  - recorrido por la navegación de secciones con teclado;
  - enlace directo `tab=facturacion&seccion=puntos`;
  - el pendiente del resumen abre la entidad y la subsección;
  - edición de una entidad en modal;
  - declaración de una condición.
- [ ] 7.2 Actualizar en `e2e/fiscal.spec.ts` los pasos que abren subsecciones por rol `tab`.
- [ ] 7.3 Añadir la configuración a `e2e/responsive.spec.ts` en 360, 768, 1024, 1280 y 1440 px, con `axe` y sin desplazamiento horizontal.
- [ ] 7.4 Ejecutar solo `npx playwright test e2e/workshop-configuration.spec.ts e2e/fiscal.spec.ts` y el caso de configuración de `e2e/responsive.spec.ts`. Registrar el resultado y lo no ejecutado.

## 8. Documentación, trazabilidad y cierre

Dependencias: grupos 2 a 7. Diseño D12.

- [ ] 8.1 Añadir «Placa de RUC» a `docs/negocio/producto/glosario.md`.
- [ ] 8.2 Actualizar en `docs/negocio/requisitos/interfaz-y-navegacion.md` UI-013 (navegación de secciones, resumen y parámetro `entidad`) y UI-019 (subsecciones anidadas, selector visible y perfil por condición), junto con sus archivos de referencia de glosario.
- [ ] 8.3 Actualizar `DESIGN.md`: composición de la configuración, `SectionNav`, `FactList`, `AdvancedInfo` y `RucPlate` en «Piezas del taller».
- [ ] 8.4 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` con las requirements nuevas y modificadas, cada una con su prueba.
- [ ] 8.5 Verificación final focalizada:
  - `npm run build`;
  - vitest de todos los archivos tocados;
  - `tsc`, ESLint y prettier sobre los archivos tocados;
  - `openspec validate redisenar-pagina-de-configuracion --strict`.

  Registrar comandos, resultados y lo no ejecutado (suite completa de frontend, backend y resto de Playwright).
- [ ] 8.6 Pedir al usuario que valide la página directamente en la aplicación (`sistema-visual-frontend`, validación directa) y registrar sus correcciones antes de archivar.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
