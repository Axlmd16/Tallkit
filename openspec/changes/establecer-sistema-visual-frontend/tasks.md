## 1. Línea base y recursos locales

- [ ] 1.1 Ejecutar `make frontend-check` y `cd frontend && npm run test:e2e` antes de modificar la interfaz; registrar cualquier fallo previo sin acomodar el cambio a un comportamiento incorrecto.
- [ ] 1.2 Instalar con versiones exactas `@fontsource-variable/ibm-plex-sans@5.3.0`, `@fontsource/ibm-plex-mono@5.3.0`, `@phosphor-icons/react@2.1.10` y `@axe-core/playwright@4.13.0`; actualizar juntos `frontend/package.json` y su **lockfile** y conservar evidencia de sus licencias compatibles.
- [ ] 1.3 Incorporar desde `frontend/src/shared/styles/index.css` únicamente los pesos y subconjuntos tipográficos utilizados, definir las pilas de respaldo y demostrar mediante el build que no existen solicitudes obligatorias a fuentes o iconos externos.
- [ ] 1.4 Sustituir la paleta oscura provisional por tokens semánticos de color, tipografía, espacio, forma, elevación, foco y movimiento; añadir estilos base para lienzo claro, selección, controles táctiles y `prefers-reduced-motion`.

**Evidencia:** `cd frontend && npm run typecheck && npm run build`; inspección del paquete generado y de las licencias declaradas.

## 2. Primitivas de interacción y estados

- [ ] 2.1 Escribir pruebas inicialmente fallidas para `Button`, `IconButton`, `ButtonGroup`, `Field`, `Input`, `Select`, `Checkbox` y `FieldError`, cubriendo variantes, nombres accesibles, asociación de ayuda/error y estado pendiente o deshabilitado.
- [ ] 2.2 Implementar en `frontend/src/shared/ui/` las primitivas mínimas de controles y campos hasta hacer pasar las pruebas, usando variantes cerradas y tokens semánticos en lugar de colores directos.
- [ ] 2.3 Escribir pruebas inicialmente fallidas para `StatusBadge`, `FiscalScopeBadge`, `InlineNotice`, `LoadingState` y `EmptyState`, verificando que estado, **RUC comercial** y **RUC artesanal** sean comprensibles sin depender del color.
- [ ] 2.4 Implementar las primitivas de estado y ámbito, usando Phosphor Icons con tamaño y peso coherentes, texto visible donde sea necesario y regiones vivas con prioridad apropiada.
- [ ] 2.5 Refactorizar las primitivas, centralizar sus exportaciones y eliminar APIs genéricas que permitan combinaciones visuales no aprobadas.

**Evidencia:** `cd frontend && npm test -- src/shared/ui` y revisión de consultas por rol, etiqueta y descripción accesible.

## 3. Diálogos, datos y composición de página

- [ ] 3.1 Escribir pruebas inicialmente fallidas para `Dialog`: foco inicial, contención mientras está abierto, cierre seguro con teclado, retorno del foco y descripción de acciones críticas.
- [ ] 3.2 Implementar `Dialog` y reemplazar las dependencias directas de `window.confirm` necesarias para que las confirmaciones del cambio compartan semántica y gestión de foco.
- [ ] 3.3 Escribir pruebas inicialmente fallidas para `PageHeader`, `Toolbar`, `FilterPanel`, `ResponsiveDataView`, `Pagination` y `RowActions`, incluyendo prioridad de datos y expansión accesible en pantalla estrecha.
- [ ] 3.4 Implementar las primitivas de composición y datos: tabla comparable en escritorio, detalle progresivo en teléfono y desplazamiento confinado a la región de datos cuando resulte indispensable.

**Evidencia:** `cd frontend && npm test -- src/shared/ui`; pruebas de teclado y aserción de que la página no adquiere desbordamiento horizontal.

## 4. Marco autenticado y navegación adaptable

- [ ] 4.1 Ampliar primero `frontend/src/app/AuthenticatedShell.test.tsx` con pruebas fallidas para ruta activa, navegación derivada exclusivamente del **permiso efectivo**, apertura/cierre del panel móvil, retorno del foco y conservación del cierre de sesión sin envíos duplicados.
- [ ] 4.2 Reestructurar `AuthenticatedShell` con navegación lateral persistente desde escritorio, modo contraído para tableta y panel modal etiquetado bajo 768 px, sin cambiar rutas ni reglas de visibilidad.
- [ ] 4.3 Aplicar el encabezado de página, identidad textual reemplazable, información del usuario y roles; asegurar que ninguna opción no autorizada aparezca en cualquier ancho.
- [ ] 4.4 Añadir pruebas de orientación y redimensionamiento que comprueben conservación de la ruta activa, orden de teclado y cierre del panel móvil después de navegar.

**Evidencia:** `cd frontend && npm test -- src/app/AuthenticatedShell.test.tsx` y recorrido manual a 360, 768, 1024 y 1440 px con los tres roles.

## 5. Acceso, contraseña y formularios

- [ ] 5.1 Ampliar primero las pruebas de autenticación con casos fallidos para resumen de errores, asociación con campos, conservación de valores válidos, foco visible y verbo de progreso durante un envío bloqueado.
- [ ] 5.2 Migrar `LoginPage`, `ChangePasswordPage` y `AuthForms` a la composición y primitivas aprobadas, manteniendo contratos, validaciones, credenciales y prevención de doble envío.
- [ ] 5.3 Ampliar primero `UserForm.test.tsx` con casos fallidos para una columna en teléfono, orden lógico al crecer a dos columnas, roles táctiles, errores asociados y advertencia de cambios sin guardar.
- [ ] 5.4 Migrar `UserForm` a las nuevas primitivas sin alterar el contenido enviado ni las reglas funcionales existentes.

**Evidencia:** `cd frontend && npm test -- src/features/auth src/pages/login src/pages/change-password src/features/users/UserForm.test.tsx`.

## 6. Pantallas administrativas existentes

- [ ] 6.1 Ampliar primero `UsersPage.test.tsx` con escenarios fallidos para carga, vacío, error recuperable, éxito, acciones según permiso, diálogo de confirmación, credencial temporal y datos largos en escritorio y teléfono.
- [ ] 6.2 Migrar `UsersPage` a encabezado, filtros, vista de datos, paginación, avisos y diálogos compartidos, conservando la misma autorización y resultados funcionales.
- [ ] 6.3 Ampliar primero `AuditPage.test.tsx` con escenarios fallidos para filtros, estados, detalle accesible, contenido largo, paginación y prioridad móvil; después migrar `AuditPage` a las primitivas aprobadas.
- [ ] 6.4 Migrar `HomePage` y `TechnicalStatusPage` a la hoja operativa, usando estados de carga, resultado y error coherentes sin añadir capacidades ni métricas inexistentes.
- [ ] 6.5 Confirmar mediante las pruebas de cada pantalla que las acciones visibles continúan dependiendo de permisos y que el frontend no asume autoridad del backend.

**Evidencia:** `cd frontend && npm test -- src/pages` con cobertura de todas las superficies modificadas.

## 7. Adaptación, accesibilidad y evidencia visual

- [ ] 7.1 Integrar axe en los recorridos Playwright y crear una ayuda de verificación que falle ante infracciones de accesibilidad de impacto serio o crítico en las rutas representativas.
- [ ] 7.2 Añadir primero recorridos E2E fallidos para navegación autorizada, panel móvil, formularios, filtros, datos, diálogos y cierre de sesión en 360 × 800, 768 × 1024, 1024 × 768 y 1440 × 900.
- [ ] 7.3 Corregir las superficies hasta que los recorridos E2E no presenten pérdida de contenido, superposición, acciones dependientes de hover ni desplazamiento horizontal de la página.
- [ ] 7.4 Crear capturas Playwright estables para acceso, inicio, usuarios, auditoría y estado técnico con contenido representativo; revisar estados de carga, vacío, error y texto largo donde correspondan.
- [ ] 7.5 Realizar revisión manual con teclado, zoom al 200 %, orientación de tableta, contraste, movimiento reducido y lector de pantalla básico; registrar los resultados y corregir las incidencias del alcance.

**Evidencia:** `cd frontend && npm run test:e2e`; capturas aprobadas en los cuatro tamaños y lista de revisión manual sin incidencias abiertas de severidad alta.

## 8. Documentación, limpieza y cierre

- [ ] 8.1 Buscar y retirar estilos provisionales `slate/cyan`, colores directos, iconos aislados y patrones duplicados que hayan quedado en las superficies migradas; conservar excepciones solo si están documentadas.
- [ ] 8.2 Crear `DESIGN.md` con los tokens y patrones realmente construidos, actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md`, su trazabilidad y las referencias terminológicas afectadas sin convertir decisiones visuales en reglas del dominio.
- [ ] 8.3 Comprobar que `frontend/package.json` y `frontend/package-lock.json` permanecen sincronizados, que los activos funcionan sin Internet y que no se incorporaron cambios de backend, API, datos o migraciones.
- [ ] 8.4 Ejecutar `make frontend-check`, `cd frontend && npm run test:e2e`, `make compose-check` y `make audit`; corregir todo fallo introducido por el cambio y conservar los resultados reales para la verificación OpenSpec.

**Evidencia:** todos los comandos del grupo terminan con código cero, `git diff --check` no informa errores y la documentación coincide con la implementación final.
