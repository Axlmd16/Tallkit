# Registro de implementación visual del frontend

| Campo | Valor |
|---|---|
| Fecha | 2026-09-10 |
| Cambio | `establecer-sistema-visual-frontend` |
| Dirección | Adaptación del kit **SAAS Dashboard** al taller |
| Estado | Implementación anterior rechazada; corrección de fidelidad en curso, sin aprobación visual |

## Línea base anterior al rediseño

- `make frontend-check`: código cero; formato y lint limpios, 23 archivos y 76 pruebas aprobadas, cobertura de sentencias 90,63 %, typecheck y build correctos.
- `cd frontend && npm run test:e2e`: código cero; 14 recorridos aprobados en Chromium. Django encontró una base `test_sys_taller` anterior, la eliminó y continuó sin afectar el resultado.
- El build anterior contenía la tipografía y los tokens descartados. Esta evidencia confirma el estado técnico de partida, no aprueba su apariencia.

## Inventario del diff recibido

### Comportamiento reutilizable

- `AuthenticatedShell`, `PermissionGuard` y `SessionGuard`: rutas, filtrado por permiso, sesión y cierre de sesión.
- `AuthForms`, `UserForm`, `UsersPage` y `AuditPage`: contratos, validación, consultas, mutaciones y tratamiento funcional de estados.
- `Dialog` y las primitivas bajo `frontend/src/shared/ui/`: semántica, foco, roles y APIs que ya estén respaldados por pruebas.
- Las páginas de inicio, cambio de contraseña y estado técnico: contenido y flujos existentes, sin asumir que su composición visual es definitiva.

### Pruebas reutilizables

- Pruebas unitarias de marco, permisos, autenticación, usuarios, auditoría, controles, estados, composición y diálogo.
- Recorridos E2E de autenticación y usuarios, junto con las ayudas de accesibilidad, adaptación y evidencia visual.
- Durante la corrección actual todas las pruebas de comportamiento existentes se conservan byte a byte. Se añaden comprobaciones independientes de propiedades visuales y se observa su fallo antes de corregir producción.

### Decisiones visuales que deben sustituirse

- `DESIGN.md`, `index.css` y la documentación de la dirección visual anterior.
- La tipografía técnica anterior, el azul dominante, los divisores excesivos, la ausencia de elevación y la geometría descartada.
- La composición actual de acceso, navegación, listas, formularios y estados cuando diverja de la referencia Figma aprobada.
- Los cambios de `package.json` y `package-lock.json` se conservarán solo para dependencias que continúen justificadas; ambos archivos permanecerán sincronizados.

## Checklist de fidelidad a la referencia Figma

La verificación conjunta de 360, 768, 1024 y 1440 px usará los siguientes criterios observables:

| Superficie | Criterios verificables |
|---|---|
| Acceso | Región de formulario blanca y prioritaria; composición dividida solo cuando existe espacio; Nunito legible; acción primaria violeta; campos suaves; recurso propio o región neutral; sin registro ni proveedores sociales. |
| Marco autenticado | Lienzo `#FAFAFB`; navegación blanca; selección `#EFEEFF`; violeta `#605BFF`; rail de 80 px desde tableta y drawer etiquetado en teléfono; perfil y salida al pie. |
| Usuarios | Cabecera y acciones despejadas; búsqueda y filtros compactos; filas blancas separadas alineadas a una retícula; estados pastel con texto; formulario en drawer; composición priorizada sin scroll de página a 360 px. |
| Auditoría | Filtros compactos; filas separadas comparables; detalle accesible; fechas y cifras tabulares; paginación estable; ningún control de mutación. |
| Estado técnico | Jerarquía simple de título, explicación y resultado real; superficie blanca; estados de carga, éxito y error semánticos; ningún dato inventado ni secreto. |

En todas las superficies se comprobará: tinta `#030229`, texto secundario derivado de esa tinta al 50 %, líneas derivadas al 8 %, radios dominantes de 5/10 px y píldoras solo donde corresponden, tres elevaciones como máximo, densidad operativa sin saturación, foco visible, objetivos táctiles de 44 px, estados redundantes al color y movimiento reducido.

## Evidencia automática

- `frontend/e2e/responsive.spec.ts`: cuatro tamaños objetivo, panel móvil, formulario contextual y ausencia de desbordamiento; cinco recorridos aprobados.
- `frontend/e2e/visual-evidence.spec.ts`: capturas representativas y axe en cinco superficies; un recorrido aprobado.
- `frontend/e2e/accessibility.ts`: umbral bloqueante para impactos `serious` y `critical`.
- `frontend/e2e/visual-system.spec.ts`: tipografía, lienzo y acción primaria verificados en ejecución; un recorrido aprobado.
- Pruebas unitarias de `Drawer`, `Dialog`, controles, estados, composición, formularios y pantallas.

La batería completa de Playwright del 10 de septiembre de 2026 terminó con 15/15 recorridos aprobados. Las capturas de acceso, inicio y usuarios en computadora, tableta y teléfono no mostraron pérdida de contenido, solapamientos ni desplazamiento horizontal de página. Los colores semánticos secundarios se ajustaron para resolver los contrastes detectados por axe.

`make frontend-check` aprobó formato, lint, tipos, 89 pruebas unitarias, cobertura de sentencias de 88,9 %, cobertura de líneas de 90,48 % y build. `make compose-check` validó la configuración Docker y `make audit` no encontró vulnerabilidades conocidas en backend ni frontend. La validación estricta de OpenSpec también terminó correctamente.

La verificación final no certificará conformidad legal completa con WCAG; será una comprobación proporcional a las superficies V1 implementadas.


## Corrección de fidelidad del 2026-09-10

Los resultados anteriores son históricos y no certifican fidelidad ni aceptación visual. Se reabre la revisión y se agregan tareas correctivas 11.1–11.10 al cambio activo. La evidencia actual se registra por etapa; el usuario exige comparativas al mismo viewport y aprobación explícita antes de cualquier commit, merge o archivo.


## Comparación de tokens antes de la corrección

La comparación se presentó antes de modificar el código. Los valores de Figma proceden de get_design_context individual y lectura estructurada complementaria.

| Propiedad | Árbol recibido | Figma / corrección |
|---|---|---|
| Familia | Nunito local ya presente; no Poppins ni serif | Nunito 400, 600, 700, 800 |
| Fondo / tinta / primario | #FAFAFB / #030229 / #605BFF | Se conservan, coinciden |
| Paleta auxiliar | Azul, cian, amarillo y coral; faltaban tokens rosa, naranja y verde originales | #5B93FF, #26C0E2, #FFD66B, #FF8F6B, #F29339, #EF37FF, #3A974C, #D11A2A |
| Radio de botón | 5 px | 10 px |
| Altura de acción de lista | ≥44 px | 40 px; ≥44 con puntero táctil |
| Campo de formulario | ≥44 px | 50 px; radio 5 px |
| Sidebar escritorio | 218 px desde el borde | 80 px, margen 30 px, radio 10 px (4:344) |
| Inicio | Una superficie de accesos, sin retícula del frame | Cuatro tarjetas de 116 px; paneles 719/447 × 408/335 px |
| Superficies | Sombra generalizada | Tarjetas planas; sombra solo en fila destacada/foco/hover y superposiciones correspondientes |
| Filas | Altura según contenido y acciones largas | Usuarios 60 px; Auditoría 70 px; separación 10 px |
| Drawer | 480 px; formulario de dos columnas | 409 px; campos 349 × 50 px en una columna |
| Login | Campo 352 px; título 30/800; marca 44 px | Campo 348 × 50 px; título 25/600; marca 92 px |
| Recover / Confirm | Diálogos genéricos de hasta 512 px | Superficies 658 / 726 px, radio 10 px, fondo #F7F7F8 |

Componentes corregidos: tokens, Button/Input/Select/Field, Surface/PageHeader/ElevatedDataList, AuthenticatedShell/NavigationItems, HomePage, UsersPage/UserForm/Drawer, AuditPage, LoginPage/LoginForm y variantes visuales de Dialog. Las funciones, permisos, rutas, APIs y pruebas de comportamiento existentes permanecen protegidos.


## Evidencia de la corrección por etapas

Las pruebas existentes de frontend (25 archivos, 89 casos) se ejecutaron después de cada etapa y permanecen sin modificaciones. `figma-fidelity.spec.ts` añade comprobaciones independientes; sus fixtures neutrales están limitados a Playwright y no llegan a producción.

| Etapa | Fallo observado antes de corregir | Comprobación y revisión de capturas |
|---|---|---|
| 1. Fuente y tokens | Token rosa original ausente | Nunito local 400/600/700/800 cargado; paleta completa, fondos y radios contrastados con los frames. |
| 2. Shell | Sidebar de 218 px en x=0 | Sidebar 80 × 987 en (30,30), contenido x=140 a 1366 × 1047. Los recursos SVG vacíos detectados en la comparación se reexportaron y verificaron antes de continuar el dashboard. |
| 3. Controles | Radio de botón de 5 px; altura 42 px por herencia tipográfica | Radio 10, altura 40, campos 50, filas ordinarias sin sombra. |
| 4. Dashboard | No existían las cuatro tarjetas ni la retícula | Tarjetas en y=98, alto 116; primer panel (140,242), 719 × 408. Comparación de estructura completa contra 4:344. |
| 5. Usuarios y drawer | Panel de 480 px | Panel 409, campos 349 × 50 en una columna. Diez filas neutrales a 1440 × 900; fondo sin oscurecimiento en escritorio. |
| 6. Auditoría | Filas de 56 px | Filas de 70 px, seis filtros en una línea a 1440 px, detalle consultable y captura en 1440 × 1016. |
| 7. Credenciales | Campo de acceso de 352 px; diálogos genéricos | Campo 348, título 25/600, superficies 658/726. Se corrigió la preparación CSRF de los fixtures, sin tocar la protección real. Capturas 1440 × 1112. |
| 8. Adaptación | Filas de tableta de 140 px, acceso con errores desbordado y diálogos recortados en móvil | Ancho legible y desplazamiento limitado a la tabla; errores en flujo; diálogos dentro del viewport. Tres recorridos dedicados pasan a 360/768/1024/1440, con axe sin infracciones serias o críticas. |

El contraste se verifica con variantes oscuras de texto; se conservan los acentos originales para recursos decorativos y fondos. Los SVG de navegación usan la tinta de la ruta activa, conservando la geometría exportada.

## Adaptaciones que requieren revisión visual del usuario

- Sidebar de 80 px también en listas, por la instrucción explícita; los frames originales de listas usan 218 px.
- No se reproducen gráficas con datos demostrativos. Se preservan las regiones del dashboard con estados vacíos explícitos y datos reales de sesión/accesos.
- La ilustración del acceso es el recurso original del taller. Se conservan las posiciones del formulario; las bandas sociales son información neutral, sin controles de acceso adicionales.
- Usuarios conserva sus tres acciones directas, filtros, roles y paginación. El drawer conserva roles, aviso de cambios y cancelación. Son contenido funcional adicional respecto al ejemplo.
- Recover y Confirm se aplican al restablecimiento administrativo existente. La credencial de una sola visualización y sus avisos ocupan espacio adicional en Confirm; no se eliminan para imitar un mensaje de creación de cuenta.

Estas diferencias están visibles en las comparativas. La aprobación visual no se deduce de la batería automática.

La comparación final detectó un problema adicional en la máscara de los iconos: la URL inline no se interpretaba como `mask-image`. Se trasladó la referencia a la hoja de estilos local, manteniendo los SVG exportados y su dibujo de 20 px. Se agregó una aserción de máscara efectiva y se repitieron las capturas y verificaciones tras corregirlo.

La región decorativa del acceso se ajustó finalmente a (636,255), 647 × 602 px, con el vehículo propio y elementos neutrales. Se verificó el área completa y se repitieron las capturas de acceso, error y credenciales en los cuatro tamaños tras el ajuste.


## Verificación final del 2026-09-11

| Verificación | Resultado |
|---|---|
| `make check` | Correcto: formato/lint/tipos, chequeo Django y migraciones, cobertura, build y configuración Compose. Backend: 98 pruebas, cobertura 89,89 %. |
| `make test` | Correcto: 98 pruebas backend y 89 frontend. |
| `make frontend-check` después del último ajuste visual | Correcto: 25 archivos, 89 pruebas; sentencias 89,02 %, ramas 81,72 %, funciones 91,08 %, líneas 90,60 %; build correcto. |
| `npm run test:e2e -- --retries=0 --reporter=line` | 25 recorridos completos correctos con Django y Chromium, sin reintentos. |
| Revisión posterior del área decorativa de acceso | Dos recorridos adicionales correctos: geometría de acceso/Recover/Confirm y accesibilidad de credenciales en cuatro anchuras. Se repitió además la captura de acceso tras estabilizar los recursos. |
| `make audit` | Sin vulnerabilidades conocidas en backend ni frontend. |
| OpenSpec estricto y `git diff --check` | Correctos. |
| Preservación respecto al árbol recibido | 103 archivos protegidos comparados por SHA-256; ninguno cambió. Incluye backend, contratos, rutas y pruebas de comportamiento existentes. |
| Comparativas | Siete pares con dimensiones originales verificadas, diez referencias Figma y galería responsive. Imágenes locales decodificadas sin errores; superposición funcional. |

Las capturas y registros generados se conservan fuera del repositorio, en el directorio de revisión de Codex `figma-sys-taller/comparacion.html`. No se versionan imágenes, trazas, resultados ni fixtures generados. La galería registra explícitamente las adaptaciones de contenido requeridas para conservar funcionalidad.

**Estado final de esta ronda: implementación y verificación técnica realizadas; aprobación visual explícita del usuario pendiente. El cambio permanece abierto. No se realizó commit, merge ni archivado.**

## Aceptación visual del 2026-09-12

El usuario aprobó explícitamente la galería comparativa actual con «si, continua ya con las tareas». Quedan aceptadas las adaptaciones enumeradas en este registro y completadas las tareas 9.5 y 11.10. Las menciones anteriores a aceptación pendiente describen rondas previas y quedan sustituidas por esta decisión. La revisión y corrección de sesión se documentan en [verificación de dependencias](verificacion-dependencias-clientes.md).

## Auditoría del catálogo reutilizable del 2026-09-14

La aceptación anterior cubrió las páginas funcionales de `establecer-sistema-visual-frontend`; no certificó individualmente los 66 componentes creados después por `catalogo-visual-reutilizable`. El cambio activo `aplicar-catalogo-visual-frontend` vuelve a abrir únicamente esa auditoría de componentes y su integración visual.

### Fuentes estructuradas consultadas

Se ejecutó `get_design_context` sobre las 22 raíces indicadas por el usuario: `4:344`, `4:2`, `4:660`, `4:1140`, `4:1635`, `4:2246`, `4:2803`, `4:3258`, `4:4239`, `4:4567`, `4:4981`, `4:5455`, `4:5816`, `4:6241`, `4:6577`, `4:3637`, `4:3942`, `4:8584`, `4:7725`, `4:9302`, `4:9333` y `4:7438`. Para las correcciones confirmadas también se consultaron `4:233`, `4:234`, `4:329`, `4:330`, `4:508`, `4:1498`, `4:117` y `4:92`.

Cada componente conserva su fuente concreta en `frontend/src/dev/visual-catalog/registry.ts`: `frameRef`, nodos exactos o marca `A`, y suite de prueba. No se asignan node IDs a adaptaciones.

### Correcciones aplicadas

- El sidebar queda como drawer bajo 768 px, rail de 80 px entre 768 y 1279 px y variante desplegada de 218 px desde 1280 px. El breakpoint es adaptación de la aplicación; la geometría desplegada procede de `4:2`/`4:233`.
- Se migraron consumidores de aliases inexistentes a `canvas`, `surface`, `line`, `radius-group`, `radius-dialog`, `shadow-row` y `shadow-menu`; se retiraron bordes no declarados.
- `MetricCard` presenta valor antes de etiqueta, 22 px y superficie plana (`4:508`); `DropdownMenu` usa radio de 10 px y sombra de menú (`4:1498`).
- `category`, `chart` y `document` consumen los SVG locales exportados de Figma. Los demás iconos Phosphor permanecen como adaptaciones registradas.
- `CalendarToolbar` y el wrapper activable del checkbox cumplen 44×44 px; `DataTable` usa el ejemplo neutral accesible “Elementos sintéticos”.
- El dashboard desplegado usa a 1440 px paneles de 702 y 430 px según `4:117`/`4:118` y `4:92`/`4:93`. Los siete filtros reales de auditoría permanecen visibles en una sola fila amplia.

### Evidencia y estado

Las exportaciones Figma a escala 1, capturas, diferencias, baselines aprobados y manifiesto viven en un directorio externo con carpetas `figma/`, `actual/`, `diff/` y `approved/`; no se versionan. Chromium se fija a DPR 1. Las capturas cubren 360, 768, 1024 y 1440 px; el sidebar añade 1279, 1280 y 1366 px. El comparador propone umbral por canal `0.2` y máximo `0.5 %` de píxeles distintos, pero una propiedad estructurada exacta siempre bloquea.

La primera corrida integral del catálogo aprobó 111/112 casos y agotó 30 s al capturar C58 `YearCalendar`; su repetición aislada aprobó 1/1 en 28,5 s. Se registra como demora ocasional y no se oculta mediante reintentos. Después de los ajustes finales, la corrida completa aprobó 112/112 validaciones activas en 6,3 minutos; las 66 comparaciones contra baselines aprobados quedaron omitidas intencionalmente. La aceptación visual de esta nueva galería sigue pendiente: ninguna evidencia se promoverá a `approved/` ni a estado `verified` antes de la confirmación del usuario.

La regresión funcional se ejecutó primero contra el servidor E2E persistente encontrado en el puerto 8001 y después contra una base temporal independiente con fixtures frescos. En la segunda corrida aprobaron 33/43 recorridos. Los diez fallos restantes no proceden del cambio visual: el `POST /auth/logout/` responde 204, pero el estado de React Query no redirige a Login; además, un recorrido móvil de vehículos no cierra el drawer tras crear un cliente. Las líneas funcionales implicadas no fueron modificadas por este cambio y los fallos se conservan separados para una corrección OpenSpec propia. Los recorridos visuales, de permisos, geometría, tablas y accesibilidad restantes aprobaron.

No cambian OpenAPI, migraciones, ADR, diagramas C4, backend, permisos, sesión, CSRF ni reglas de negocio. La identidad visible conserva el nombre técnico confirmado **Sys-Inventario**; no copia “Base” ni los datos demostrativos de la plantilla.
