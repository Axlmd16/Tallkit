## 1. Línea base y reconciliación del intento rechazado

- [ ] 1.1 Ejecutar `make frontend-check` y `cd frontend && npm run test:e2e`; registrar por separado fallos previos, fallos de entorno y regresiones sin marcar como válida la apariencia actual.
- [ ] 1.2 Inventariar el diff no comprometido de `frontend/`, `DESIGN.md` y `docs/` y clasificar cada cambio como comportamiento reutilizable, prueba reutilizable o decisión visual que debe sustituirse; no descartar cambios ajenos ni usar el código actual como autoridad estética.
- [ ] 1.3 Convertir los requisitos visuales del Figma en un checklist verificable para acceso, marco autenticado, usuarios, auditoría y estado técnico: lienzo, navegación, tipografía, violeta, radios, elevación, densidad, estados y adaptación.

**Evidencia:** resultados iniciales conservados, inventario del diff revisado y checklist trazable a `design.md` y las dos specs.

## 2. Tipografía, tokens y recursos locales

- [ ] 2.1 Escribir primero una prueba o comprobación fallida que detecte la ausencia de Poppins local, los tokens nuevos y la permanencia de dependencias tipográficas rechazadas.
- [ ] 2.2 Sustituir `@fontsource-variable/ibm-plex-sans` y `@fontsource/ibm-plex-mono` por `@fontsource/poppins@5.3.0`; actualizar juntos `frontend/package.json` y `frontend/package-lock.json` y conservar la licencia OFL-1.1.
- [ ] 2.3 Actualizar `frontend/src/shared/styles/index.css` con Poppins 400, 500 y 600, cifras tabulares y la pila de respaldo local; eliminar IBM Plex únicamente cuando no queden consumidores.
- [ ] 2.4 Sustituir los tokens de “Hoja de taller de precisión” por el lienzo gris lavanda, superficies blancas, tinta azul marino, violeta `#635BFF`, estados pastel, radios y tres niveles de elevación definidos en `design.md`.
- [ ] 2.5 Definir estilos base de selección, foco, controles táctiles y movimiento reducido; comprobar que los recursos esenciales no generan solicitudes a fuentes, iconos o activos externos.

**Evidencia:** la comprobación de 2.1 pasa; `cd frontend && npm run typecheck && npm run build`; inspección del paquete generado, lockfile y licencias.

## 3. Controles, formularios y estados compartidos

- [ ] 3.1 Actualizar primero `frontend/src/shared/ui/controls.test.tsx` con casos fallidos para variantes primaria, secundaria, discreta y destructiva, estados hover/foco/activo/deshabilitado/carga, nombres accesibles y errores asociados.
- [ ] 3.2 Adaptar `Button`, `IconButton`, `ButtonGroup`, `Field`, `Input`, `Select`, `Checkbox` y `FieldError` en `frontend/src/shared/ui/controls.tsx` a la nueva tipografía, geometría y jerarquía, conservando HTML semántico y APIs cerradas.
- [ ] 3.3 Actualizar primero `frontend/src/shared/ui/states.test.tsx` con casos fallidos para insignias pastel, texto redundante al color, carga, vacío, error recuperable, **RUC comercial** y **RUC artesanal**.
- [ ] 3.4 Adaptar `StatusBadge`, `FiscalScopeBadge`, `InlineNotice`, `LoadingState` y `EmptyState` en `frontend/src/shared/ui/states.tsx`, usando Phosphor como única familia de iconos.
- [ ] 3.5 Refactorizar exportaciones de `frontend/src/shared/ui/index.ts` y eliminar variantes, colores directos o APIs genéricas que permitan reconstruir la estética descartada.

**Evidencia:** `cd frontend && npm test -- src/shared/ui/controls.test.tsx src/shared/ui/states.test.tsx`; revisión mediante consultas por rol, etiqueta y descripción accesible.

## 4. Superficies, datos y superposiciones

- [ ] 4.1 Escribir primero pruebas fallidas en `frontend/src/shared/ui/layout.test.tsx` para `PageHeader`, `Toolbar`, `FilterPanel`, `Surface`, `StatCard`, `ElevatedDataList`, `ResponsiveDataView`, `Pagination` y `RowActions`.
- [ ] 4.2 Implementar o adaptar las primitivas de composición en `frontend/src/shared/ui/layout.tsx`: superficies blancas, elevación jerarquizada y filas separadas que mantengan encabezados y retícula comparable.
- [ ] 4.3 Escribir primero pruebas fallidas para que `Drawer` gestione foco inicial, contención, Escape, retorno al disparador, advertencia de cambios sin guardar y transformación a ancho completo bajo 768 px.
- [ ] 4.4 Implementar `Drawer` en `frontend/src/shared/ui/` sin biblioteca adicional, usando portal o capa superior para evitar recortes por `overflow`.
- [ ] 4.5 Revisar y adaptar las pruebas de `Dialog` para foco, cierre seguro y acciones críticas; conservarlo separado de `Drawer` y reservarlo para decisiones bloqueantes.
- [ ] 4.6 Añadir pruebas para datos largos y comprobar que las listas se convierten en composición priorizada a 360 px sin desbordamiento horizontal de la página.

**Evidencia:** `cd frontend && npm test -- src/shared/ui`; pruebas de teclado y aserciones de desbordamiento para drawer, diálogo y datos.

## 5. Marco autenticado y navegación por permisos

- [ ] 5.1 Actualizar primero `frontend/src/app/AuthenticatedShell.test.tsx` con casos fallidos para sidebar completa ≥1200 px, rail entre 768–1199 px, drawer móvil <768 px, ruta activa, retorno del foco y cierre de sesión sin doble envío.
- [ ] 5.2 Reestructurar `frontend/src/app/AuthenticatedShell.tsx` con navegación blanca, identidad reemplazable, selección violeta suave y perfil/cierre de sesión al pie, sin cambiar rutas ni cálculo de permisos.
- [ ] 5.3 Garantizar que el rail conserva nombres accesibles y que el drawer móvil muestra etiquetas completas, se cierra después de navegar y no altera la ruta al redimensionar.
- [ ] 5.4 Ampliar pruebas positivas y negativas de `PermissionGuard` y del menú para Administrador, Vendedor, Encargado del taller y combinaciones de roles.

**Evidencia:** `cd frontend && npm test -- src/app/AuthenticatedShell.test.tsx src/app/PermissionGuard.test.tsx`; recorrido a 360, 768, 1024 y 1440 px.

## 6. Acceso y credenciales

- [ ] 6.1 Actualizar primero las pruebas de `LoginPage` y `AuthForms` para exigir la composición dividida en pantalla amplia, formulario prioritario en teléfono, etiquetas visibles, errores asociados y ausencia de registro público o acceso social.
- [ ] 6.2 Crear un SVG local original relacionado con diagnóstico, vehículo y herramientas, usando la paleta aprobada, sin copiar personajes ni activos del kit; marcarlo como decorativo y documentar su procedencia.
- [ ] 6.3 Migrar `frontend/src/pages/login/LoginPage.tsx` a la composición de dos regiones y su variante móvil sin alterar autenticación, mensajes genéricos ni prevención de doble envío.
- [ ] 6.4 Adaptar `frontend/src/features/auth/AuthForms.tsx` y `frontend/src/pages/change-password/ChangePasswordPage.tsx` a los controles nuevos, conservando contratos, validaciones y credenciales.
- [ ] 6.5 Verificar que acceso y cambio de contraseña funcionan sin Internet y sin cambios en sesiones Django, CSRF o API.

**Evidencia:** `cd frontend && npm test -- src/pages/login src/pages/change-password src/features/auth`; inspección de red local sin solicitudes visuales externas.

## 7. Usuarios y formularios contextuales

- [ ] 7.1 Actualizar primero `frontend/src/pages/users/UsersPage.test.tsx` con casos fallidos para cabecera, búsqueda, filtros, filas elevadas, carga, vacío, error, datos largos, acciones por permiso y transformación móvil.
- [ ] 7.2 Actualizar primero `frontend/src/features/users/UserForm.test.tsx` con casos fallidos para apertura en drawer, una columna en teléfono, orden lógico, selección táctil de roles, errores y cambios sin guardar.
- [ ] 7.3 Migrar `frontend/src/pages/users/UsersPage.tsx` a `ElevatedDataList`, paginación, avisos, drawer y diálogos, conservando la misma autorización y resultados funcionales.
- [ ] 7.4 Migrar `frontend/src/features/users/UserForm.tsx` a las primitivas nuevas sin alterar el contenido enviado ni las reglas de roles.
- [ ] 7.5 Verificar que crear, editar, desactivar, restaurar y restablecer credencial identifican claramente al usuario y que las acciones no autorizadas permanecen ocultas y denegadas por backend.

**Evidencia:** `cd frontend && npm test -- src/pages/users/UsersPage.test.tsx src/features/users/UserForm.test.tsx`; pruebas E2E de usuarios por permiso.

## 8. Inicio, auditoría y estado técnico

- [ ] 8.1 Escribir o actualizar primero pruebas fallidas de `HomePage` para jerarquía de página y accesos reales según permiso, sin añadir métricas ni módulos todavía inexistentes.
- [ ] 8.2 Actualizar primero `frontend/src/pages/audit/AuditPage.test.tsx` con casos fallidos para filtros compactos, filas elevadas, detalle accesible, paginación, contenido largo y prioridad móvil.
- [ ] 8.3 Migrar `frontend/src/pages/audit/AuditPage.tsx` a las superficies y datos aprobados sin introducir acciones que modifiquen auditoría.
- [ ] 8.4 Actualizar primero las pruebas de `TechnicalStatusPage` para carga, resultado y error; después migrar `HomePage` y `TechnicalStatusPage` sin inventar datos ni exponer secretos.
- [ ] 8.5 Confirmar que todas las páginas usan títulos, acciones y vocabulario coherentes y que ninguna conserva IBM Plex, azul técnico, divisores dominantes o sombras del diseño rechazado.

**Evidencia:** `cd frontend && npm test -- src/pages`; revisión de acceso, inicio, auditoría y estado técnico con datos representativos.

## 9. Adaptación, accesibilidad y fidelidad visual

- [ ] 9.1 Actualizar primero `frontend/e2e/responsive.spec.ts` con recorridos fallidos en 360 × 800, 768 × 1024, 1024 × 768 y 1440 × 900 para navegación, formularios, listas, drawer y diálogo.
- [ ] 9.2 Mantener `frontend/e2e/accessibility.ts` y axe configurados para fallar ante infracciones serias o críticas en las rutas representativas.
- [ ] 9.3 Corregir las superficies hasta que no exista pérdida de contenido, solapamiento, acción dependiente de hover ni desplazamiento horizontal de la página en los cuatro tamaños.
- [ ] 9.4 Actualizar `frontend/e2e/visual-evidence.spec.ts` para capturar acceso, inicio, usuarios, auditoría y estado técnico con datos y animaciones estables.
- [ ] 9.5 Comparar en una ronda conjunta las capturas de escritorio, tableta y teléfono con el checklist del Figma; corregir en un solo lote los desvíos de lienzo, navegación, tipografía, violeta, radios, elevación, densidad y adaptación, y confirmar con una segunda ronda como máximo.
- [ ] 9.6 Realizar revisión manual de teclado, foco, zoom al 200 %, orientación de tableta, contraste, movimiento reducido y lector de pantalla básico; resolver toda incidencia alta del alcance.

**Evidencia:** `cd frontend && npm run test:e2e`; capturas aprobadas en los cuatro tamaños y lista manual sin incidencias altas abiertas.

## 10. Documentación, limpieza y verificación final

- [ ] 10.1 Sustituir el contenido rechazado de `DESIGN.md` por los tokens y patrones realmente construidos, incluida la atribución a SAAS Dashboard de Jiangyu bajo CC BY 4.0 y la procedencia del SVG propio.
- [ ] 10.2 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md`, `docs/negocio/requisitos/matriz-trazabilidad.md`, `docs/tecnico/revision-visual-frontend.md` y referencias terminológicas afectadas para eliminar “Hoja de taller de precisión”.
- [ ] 10.3 Buscar y retirar dependencias IBM Plex, tokens azul técnico, colores directos, estilos duplicados y componentes sin consumidores; confirmar que `package.json` y `package-lock.json` permanecen sincronizados.
- [ ] 10.4 Verificar mediante diff que no existen cambios de backend, API, modelos, migraciones, autenticación, permisos ni reglas del dominio dentro de este cambio visual.
- [ ] 10.5 Ejecutar `cd frontend && npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e` y corregir todo fallo introducido.
- [ ] 10.6 Ejecutar `make frontend-check`, `make compose-check`, `make audit`, `git diff --check` y `openspec validate establecer-sistema-visual-frontend --strict`; conservar resultados reales y limitaciones del entorno para la verificación OpenSpec.

**Evidencia:** todos los comandos aplicables terminan con código cero, la documentación coincide con la implementación y el checklist visual no conserva desvíos materiales abiertos.
