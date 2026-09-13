## 1. Línea base y reconciliación del intento rechazado

- [x] 1.1 Ejecutar `make frontend-check` y `cd frontend && npm run test:e2e`; registrar por separado fallos previos, fallos de entorno y regresiones sin marcar como válida la apariencia actual.
- [x] 1.2 Inventariar el diff no comprometido de `frontend/`, `DESIGN.md` y `docs/` y clasificar cada cambio como comportamiento reutilizable, prueba reutilizable o decisión visual que debe sustituirse; no descartar cambios ajenos ni usar el código actual como autoridad estética.
- [x] 1.3 Convertir los requisitos visuales del Figma en un checklist verificable para acceso, marco autenticado, usuarios, auditoría y estado técnico: lienzo, navegación, tipografía, violeta, radios, elevación, densidad, estados y adaptación.

**Evidencia:** resultados iniciales conservados, inventario del diff revisado y checklist trazable a `design.md` y las dos specs.

## 2. Tipografía, tokens y recursos locales

- [x] 2.1 Escribir primero una prueba o comprobación fallida que detecte la ausencia de Nunito local, los tokens extraídos de Figma y la permanencia de dependencias tipográficas rechazadas.
- [x] 2.2 Sustituir `@fontsource-variable/ibm-plex-sans` y `@fontsource/ibm-plex-mono` por `@fontsource/nunito@5.3.0`; actualizar juntos `frontend/package.json` y `frontend/package-lock.json` y conservar la licencia OFL-1.1.
- [x] 2.3 Actualizar `frontend/src/shared/styles/index.css` con Nunito 400, 600, 700 y 800, cifras tabulares y la pila de respaldo local; eliminar IBM Plex únicamente cuando no queden consumidores.
- [x] 2.4 Sustituir los tokens de “Hoja de taller de precisión” por lienzo `#FAFAFB`, superficies blancas, tinta `#030229`, violeta `#605BFF`, estados pastel, radios y elevaciones extraídos del archivo Figma.
- [x] 2.5 Definir estilos base de selección, foco, controles táctiles y movimiento reducido; comprobar que los recursos esenciales no generan solicitudes a fuentes, iconos o activos externos.

**Evidencia:** la comprobación de 2.1 pasa; `cd frontend && npm run typecheck && npm run build`; inspección del paquete generado, lockfile y licencias.

## 3. Controles, formularios y estados compartidos

- [x] 3.1 Actualizar primero `frontend/src/shared/ui/controls.test.tsx` con casos fallidos para variantes primaria, secundaria, discreta y destructiva, estados hover/foco/activo/deshabilitado/carga, nombres accesibles y errores asociados.
- [x] 3.2 Adaptar `Button`, `IconButton`, `ButtonGroup`, `Field`, `Input`, `Select`, `Checkbox` y `FieldError` en `frontend/src/shared/ui/controls.tsx` a la nueva tipografía, geometría y jerarquía, conservando HTML semántico y APIs cerradas.
- [x] 3.3 Actualizar primero `frontend/src/shared/ui/states.test.tsx` con casos fallidos para insignias pastel, texto redundante al color, carga, vacío, error recuperable, **RUC comercial** y **RUC artesanal**.
- [x] 3.4 Adaptar `StatusBadge`, `FiscalScopeBadge`, `InlineNotice`, `LoadingState` y `EmptyState` en `frontend/src/shared/ui/states.tsx`, usando Phosphor como única familia de iconos.
- [x] 3.5 Refactorizar exportaciones de `frontend/src/shared/ui/index.ts` y eliminar variantes, colores directos o APIs genéricas que permitan reconstruir la estética descartada.

**Evidencia:** `cd frontend && npm test -- src/shared/ui/controls.test.tsx src/shared/ui/states.test.tsx`; revisión mediante consultas por rol, etiqueta y descripción accesible.

## 4. Superficies, datos y superposiciones

- [x] 4.1 Escribir primero pruebas fallidas en `frontend/src/shared/ui/layout.test.tsx` para `PageHeader`, `Toolbar`, `FilterPanel`, `Surface`, `StatCard`, `ElevatedDataList`, `ResponsiveDataView`, `Pagination` y `RowActions`.
- [x] 4.2 Implementar o adaptar las primitivas de composición en `frontend/src/shared/ui/layout.tsx`: superficies blancas, elevación jerarquizada y filas separadas que mantengan encabezados y retícula comparable.
- [x] 4.3 Escribir primero pruebas fallidas para que `Drawer` gestione foco inicial, contención, Escape, retorno al disparador, advertencia de cambios sin guardar y transformación a ancho completo bajo 768 px.
- [x] 4.4 Implementar `Drawer` en `frontend/src/shared/ui/` sin biblioteca adicional, usando portal o capa superior para evitar recortes por `overflow`.
- [x] 4.5 Revisar y adaptar las pruebas de `Dialog` para foco, cierre seguro y acciones críticas; conservarlo separado de `Drawer` y reservarlo para decisiones bloqueantes.
- [x] 4.6 Añadir pruebas para datos largos y comprobar que las listas se convierten en composición priorizada a 360 px sin desbordamiento horizontal de la página.

**Evidencia:** `cd frontend && npm test -- src/shared/ui`; pruebas de teclado y aserciones de desbordamiento para drawer, diálogo y datos.

## 5. Marco autenticado y navegación por permisos

- [x] 5.1 Actualizar primero `frontend/src/app/AuthenticatedShell.test.tsx` con casos fallidos para sidebar completa ≥1200 px, rail entre 768–1199 px, drawer móvil <768 px, ruta activa, retorno del foco y cierre de sesión sin doble envío.
- [x] 5.2 Reestructurar `frontend/src/app/AuthenticatedShell.tsx` con navegación blanca, identidad reemplazable, selección violeta suave y perfil/cierre de sesión al pie, sin cambiar rutas ni cálculo de permisos.
- [x] 5.3 Garantizar que el rail conserva nombres accesibles y que el drawer móvil muestra etiquetas completas, se cierra después de navegar y no altera la ruta al redimensionar.
- [x] 5.4 Ampliar pruebas positivas y negativas de `PermissionGuard` y del menú para Administrador, Vendedor, Encargado del taller y combinaciones de roles.

**Evidencia:** `cd frontend && npm test -- src/app/AuthenticatedShell.test.tsx src/app/PermissionGuard.test.tsx`; recorrido a 360, 768, 1024 y 1440 px.

## 6. Acceso y credenciales

- [x] 6.1 Actualizar primero las pruebas de `LoginPage` y `AuthForms` para exigir la composición dividida en pantalla amplia, formulario prioritario en teléfono, etiquetas visibles, errores asociados y ausencia de registro público o acceso social.
- [x] 6.2 Crear un SVG local original relacionado con diagnóstico, vehículo y herramientas, usando la paleta aprobada, sin copiar personajes ni activos del kit; marcarlo como decorativo y documentar su procedencia.
- [x] 6.3 Migrar `frontend/src/pages/login/LoginPage.tsx` a la composición de dos regiones y su variante móvil sin alterar autenticación, mensajes genéricos ni prevención de doble envío.
- [x] 6.4 Adaptar `frontend/src/features/auth/AuthForms.tsx` y `frontend/src/pages/change-password/ChangePasswordPage.tsx` a los controles nuevos, conservando contratos, validaciones y credenciales.
- [x] 6.5 Verificar que acceso y cambio de contraseña funcionan sin Internet y sin cambios en sesiones Django, CSRF o API.

**Evidencia:** `cd frontend && npm test -- src/pages/login src/pages/change-password src/features/auth`; inspección de red local sin solicitudes visuales externas.

## 7. Usuarios y formularios contextuales

- [x] 7.1 Actualizar primero `frontend/src/pages/users/UsersPage.test.tsx` con casos fallidos para cabecera, búsqueda, filtros, filas elevadas, carga, vacío, error, datos largos, acciones por permiso y transformación móvil.
- [x] 7.2 Actualizar primero `frontend/src/features/users/UserForm.test.tsx` con casos fallidos para apertura en drawer, una columna en teléfono, orden lógico, selección táctil de roles, errores y cambios sin guardar.
- [x] 7.3 Migrar `frontend/src/pages/users/UsersPage.tsx` a `ElevatedDataList`, paginación, avisos, drawer y diálogos, conservando la misma autorización y resultados funcionales.
- [x] 7.4 Migrar `frontend/src/features/users/UserForm.tsx` a las primitivas nuevas sin alterar el contenido enviado ni las reglas de roles.
- [x] 7.5 Verificar que crear, editar, desactivar, restaurar y restablecer credencial identifican claramente al usuario y que las acciones no autorizadas permanecen ocultas y denegadas por backend.

**Evidencia:** `cd frontend && npm test -- src/pages/users/UsersPage.test.tsx src/features/users/UserForm.test.tsx`; pruebas E2E de usuarios por permiso.

## 8. Inicio, auditoría y estado técnico

- [x] 8.1 Escribir o actualizar primero pruebas fallidas de `HomePage` para jerarquía de página y accesos reales según permiso, sin añadir métricas ni módulos todavía inexistentes.
- [x] 8.2 Actualizar primero `frontend/src/pages/audit/AuditPage.test.tsx` con casos fallidos para filtros compactos, filas elevadas, detalle accesible, paginación, contenido largo y prioridad móvil.
- [x] 8.3 Migrar `frontend/src/pages/audit/AuditPage.tsx` a las superficies y datos aprobados sin introducir acciones que modifiquen auditoría.
- [x] 8.4 Actualizar primero las pruebas de `TechnicalStatusPage` para carga, resultado y error; después migrar `HomePage` y `TechnicalStatusPage` sin inventar datos ni exponer secretos.
- [x] 8.5 Confirmar que todas las páginas usan títulos, acciones y vocabulario coherentes y que ninguna conserva IBM Plex, azul técnico, divisores dominantes o sombras del diseño rechazado.

**Evidencia:** `cd frontend && npm test -- src/pages`; revisión de acceso, inicio, auditoría y estado técnico con datos representativos.

## 9. Adaptación, accesibilidad y fidelidad visual

- [x] 9.1 Actualizar primero `frontend/e2e/responsive.spec.ts` con recorridos fallidos en 360 × 800, 768 × 1024, 1024 × 768 y 1440 × 900 para navegación, formularios, listas, drawer y diálogo.
- [x] 9.2 Mantener `frontend/e2e/accessibility.ts` y axe configurados para fallar ante infracciones serias o críticas en las rutas representativas.
- [x] 9.3 Corregir las superficies hasta que no exista pérdida de contenido, solapamiento, acción dependiente de hover ni desplazamiento horizontal de la página en los cuatro tamaños.
- [x] 9.4 Actualizar `frontend/e2e/visual-evidence.spec.ts` para capturar acceso, inicio, usuarios, auditoría y estado técnico con datos y animaciones estables.
- [x] 9.5 Comparar en una ronda conjunta las capturas de escritorio, tableta y teléfono con el checklist del Figma; corregir por etapas los desvíos de lienzo, navegación, tipografía, violeta, radios, elevación, densidad y adaptación, y repetir hasta resolver las diferencias.
- [x] 9.6 Realizar revisión manual de teclado, foco, zoom al 200 %, orientación de tableta, contraste, movimiento reducido y lector de pantalla básico; resolver toda incidencia alta del alcance.

**Evidencia:** `cd frontend && npm run test:e2e`; capturas técnicas en los cuatro tamaños; aprobación visual del usuario pendiente y lista manual sin incidencias altas abiertas.

## 10. Documentación, limpieza y verificación final

- [x] 10.1 Sustituir el contenido rechazado de `DESIGN.md` por los tokens y patrones realmente construidos, incluida la atribución a SAAS Dashboard de Jiangyu bajo CC BY 4.0 y la procedencia del SVG propio.
- [x] 10.2 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md`, `docs/negocio/requisitos/matriz-trazabilidad.md`, `docs/tecnico/revision-visual-frontend.md` y referencias terminológicas afectadas para eliminar “Hoja de taller de precisión”.
- [x] 10.3 Buscar y retirar dependencias IBM Plex, tokens azul técnico, colores directos, estilos duplicados y componentes sin consumidores; confirmar que `package.json` y `package-lock.json` permanecen sincronizados.
- [x] 10.4 Verificar mediante diff que no existen cambios de backend, API, modelos, migraciones, autenticación, permisos ni reglas del dominio dentro de este cambio visual.
- [x] 10.5 Ejecutar `cd frontend && npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e` y corregir todo fallo introducido.
- [x] 10.6 Ejecutar `make frontend-check`, `make compose-check`, `make audit`, `git diff --check` y `openspec validate establecer-sistema-visual-frontend --strict`; conservar resultados reales y limitaciones del entorno para la verificación OpenSpec.

**Evidencia histórica:** los resultados de esta sección corresponden al intento anterior, rechazado visualmente. La evidencia vigente y los límites de aceptación se registran en la sección 11 y en el registro de revisión visual.


## 11. Corrección de fidelidad solicitada el 2026-09-10

Las marcas anteriores registran ejecución técnica histórica, no aceptación visual. La petición actual autoriza actualizar artefactos y aplicar correcciones sin checkpoints Git intermedios. La propuesta está en master; no se autoriza commit, merge ni archive.

- [x] 11.1 Fuente y tokens: Nunito local 400/600/700/800, paleta completa y efectos extraídos. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.2 Shell, sidebar de 80 px y fondo: geometría de 4:344 y permisos intactos. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.3 Botones, campos, badges, tarjetas y filas: tamaños, radios y sombras medidos. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.4 Dashboard: retícula 4:344 con cuatro tarjetas, paneles 719:447 y placeholders neutrales. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.5 Usuarios y drawer: filas de 4:660/4:2803 y panel de 409 px de 4:3258. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.6 Auditoría: lista compacta y detalle contextual, sin mutaciones. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.7 Login, recuperación administrativa y confirmación: 4:8584/4:9302/4:9333, sin rutas nuevas. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.8 Responsive y accesibilidad: cuatro tamaños, teclado, zoom, contraste y recursos locales. Evidencia obligatoria: prueba de regresión visual fallida antes de corregir, `npm test`, capturas Playwright al viewport del frame, comparación y corrección antes de la siguiente etapa.
- [x] 11.9 Sincronizar DESIGN.md, interfaz, trazabilidad y registro de evidencia; ejecutar make check, make test, make audit, validación OpenSpec estricta y revisión de hashes de comportamiento.
- [x] 11.10 Mostrar las comparativas finales y recibir aprobación visual explícita del usuario. No marcar esta tarea por resultado de pruebas.

Las etapas 11.1–11.8 registran implementación y comprobación técnica con capturas revisadas, no aprobación del usuario. La tabla de diferencias documenta las adaptaciones funcionales conservadas. La tarea 11.10 permanece pendiente hasta recibir aceptación visual explícita.

## Aceptación final

El 2026-09-12, tras presentar la galería comparativa actual y sus adaptaciones, el usuario respondió «si, continua ya con las tareas». Queda registrada la aceptación visual explícita de la ronda final, incluidas las adaptaciones de contenido documentadas. Esta aprobación completa 9.5 y 11.10; sustituye los estados de aceptación pendiente anteriores.
