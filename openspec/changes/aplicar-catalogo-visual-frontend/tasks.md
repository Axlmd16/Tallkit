## 1. Línea base y trazabilidad de evidencia

- [ ] 1.1 Confirmar que proposal, specs y design aprobados están disponibles en `master`; registrar `git status`, commit de partida y los fallos preexistentes mediante `make frontend-check` y `cd frontend && CATALOG_EVIDENCE_DIR=<ruta-externa> npm run test:e2e:catalog`, separando explícitamente los fallos ajenos de clientes, vehículos y marcas.
- [ ] 1.2 Volver a consultar con `get_design_context` las raíces Figma `4:344`, `4:2`, `4:660`, `4:1140`, `4:1635`, `4:2246`, `4:2803`, `4:3258`, `4:4239`, `4:4567`, `4:4981`, `4:5455`, `4:5816`, `4:6241`, `4:6577`, `4:3637`, `4:3942`, `4:8584`, `4:7725`, `4:9302`, `4:9333` y `4:7438`; exportar las referencias necesarias a escala 1 en `$CATALOG_EVIDENCE_DIR/figma/` y registrar node ID, viewport, DPR y checksum en el manifiesto externo.
- [ ] 1.3 Escribir una prueba enfocada que falle porque `registry.ts` fuerza `verified` y porque una evidencia `E` puede carecer de referencia; implementar los estados `pending`, `in-progress`, `divergent` y `verified`, eliminar la sobrescritura global y mostrar el estado real en `CatalogApp.tsx`; verificar con la prueba enfocada y `npm run typecheck`.
- [ ] 1.4 Inicializar fuera del repositorio las carpetas `figma/`, `actual/`, `diff/` y `approved/`, y un manifiesto validado por prueba con componente, variante, frame/nodos o marca `A`, navegador Chromium, viewport, DPR 1, fuente, máscaras, tolerancia y checksums; confirmar mediante `git status --ignored` que ninguna evidencia queda versionada.

## 2. Tokens, superficies y jerarquía visual

- [ ] 2.1 Añadir una prueba Playwright que falle al comprobar los estilos computados de consumidores representativos de `border-border`, `border-border-subtle`, `bg-surface-ground`, `rounded-card`, `rounded-panel` y `var(--color-border)`; migrar esos consumidores a `line`, `canvas`, `surface`, `surface-subtle`, radios y sombras canónicos o al valor exacto del nodo, y verificar que ningún borde degrade a `currentColor` con la prueba y `npm run build`.
- [ ] 2.2 Revisar mediante TDD los componentes C01–C18 de acciones, formularios e indicadores contra sus `frameRef` y `nodes`; corregir geometría, tipografía, color, foco, disabled y tactilidad sin inventar node IDs, y guardar capturas/diffs externos de cada variante `E` antes de actualizar su estado.
- [ ] 2.3 Revisar mediante TDD los componentes C19–C42 de navegación, datos, superficies, overlays y layout; retirar contornos no declarados, corregir radios/elevaciones/espaciado y registrar cada adaptación `A`, verificando el lote con sus pruebas enfocadas y evidencia externa.
- [ ] 2.4 Revisar mediante TDD los componentes C43–C66 de gráficos, calendario, timeline, board, conversación y auth; corregir únicamente divergencias demostradas por datos estructurados y verificar el lote con pruebas enfocadas, capturas y diffs externos.

## 3. Navegación adaptable desplegada

- [ ] 3.1 Añadir pruebas unitarias y Playwright que fallen para las tres composiciones de `AuthenticatedShell`: drawer bajo 768 px, rail de 80 px entre 768 y 1279 px y sidebar de 218 px desde 1280 px; incluir filtrado por `session.permissions`, nombre accesible, estado activo y ausencia de contenido promocional o personal de la plantilla.
- [ ] 3.2 Implementar en `AuthenticatedShell.tsx` y `index.css` la variante desplegada basada en `4:2`, `4:233`, `4:234`, `4:329` y `4:330`, con contenido desde x equivalente a 248, gradiente activo `#ACA9FF` al 20 %, acento `#605BFF`, identidad del producto y perfil/salida al pie; conservar el rail basado en `4:344` y ejecutar las pruebas rojas hasta verde.
- [ ] 3.3 Ajustar mediante TDD `Sidebar.tsx` y `NavigationItem.tsx` para variantes controladas desplegada, plegada y móvil, sin que sus defaults decidan permisos ni rutas; verificar teclado, foco visible, `aria-current`, textos largos y logout con bloqueo de doble envío.
- [ ] 3.4 Ejecutar comparaciones Playwright a 360, 768, 1024, 1279, 1280, 1366 y 1440 px; comprobar posición, ancho, overflow y selección activa, guardar `actual`/`diff` externos y documentar que 1280 px es una adaptación aprobada y no una medida atribuida a Figma.

## 4. Correcciones confirmadas por componente

- [ ] 4.1 Escribir una prueba que falle por el orden y estilos computados actuales de `MetricCard`; implementar valor antes de etiqueta, valor estándar de 22 px, superficie plana y ausencia de borde dominante según `4:508`, `4:510`, `4:511`, `4:164` y `4:166`, y verificar prueba más captura/diff.
- [ ] 4.2 Escribir una prueba que falle por radio, sombra y borde de `DropdownMenu`; implementar fondo blanco, radio 10 px, `shadow-menu` y separación según `4:1497`, `4:1498`, `4:1502` y `4:1507`, y verificar estados de teclado, foco, cierre y captura/diff.
- [ ] 4.3 Escribir una prueba DOM que falle porque `category`, `chart` y `document` se renderizan como paths JSX; consumir los SVG locales de `frontend/src/assets/figma/` con dimensiones y semántica accesible explícitas, conservar Phosphor solo como adaptación registrada y verificar build, accesibilidad y captura/diff.
- [ ] 4.4 Convertir la comprobación informativa de `phase15-final.spec.ts` en aserción roja de área activable mínima 44 × 44 px; corregir `CalendarToolbar` según `4:5455`, `4:5456`, `4:5474` y `4:5475`, medir el wrapper completo de checkbox y verificar en pointer fino y coarse.
- [ ] 4.5 Añadir o ajustar primero la prueba accesible de `DataTable` para el ejemplo neutral “Elementos sintéticos”, confirmar el fallo por la expectativa obsoleta “Órdenes de Trabajo”, corregir solo la expectativa/semántica pertinente y ejecutar íntegra la fase 8.

## 5. Comparación visual reproducible

- [ ] 5.1 Añadir una prueba que falle cuando Playwright no pueda resolver snapshots externos; configurar la ruta derivada de `CATALOG_EVIDENCE_DIR`, fijar Chromium, DPR 1, viewport nativo y carga de Nunito, y comprobar que el build productivo sigue excluyendo el catálogo.
- [ ] 5.2 Implementar comparación de regiones equivalentes con el comparador de Playwright, umbral por canal de 0.2 y máximo propuesto de 0.5 % de píxeles distintos; hacer que una propiedad estructurada exacta falle siempre y registrar recortes/máscaras puntuales sin enmascarar componentes completos.
- [ ] 5.3 Ejecutar la matriz F01–F22 y C01–C66, generar `actual` y `diff`, y clasificar cada entrada como `verified` o `divergent` con enlace a prueba, referencia y checksum; ninguna entrada `E` podrá quedar verificada sin imagen Figma comparable y ninguna `A` recibirá un node ID inventado.
- [ ] 5.4 Presentar al usuario la galería comparativa y el manifiesto; promover archivos a `approved/` y cambiar estados finales a `verified` únicamente tras aceptación visual explícita, conservando divergencias rechazadas como bloqueantes.

## 6. Regresión funcional y adaptabilidad

- [ ] 6.1 Ejecutar pruebas E2E de login, home, usuarios y auditoría a 360, 768, 1024, 1280, 1366 y 1440 px; verificar navegación por teclado, permisos, sesión/CSRF, foco, ausencia de scroll horizontal y logout sin alterar contratos de backend.
- [ ] 6.2 Ejecutar las pruebas protegidas de clientes, vehículos y marcas con las superficies compartidas corregidas; comparar con la línea base de 1.1, arreglar solo regresiones introducidas por este cambio y registrar aparte cualquier fallo preexistente.
- [ ] 6.3 Ejecutar axe y las aserciones de contraste, target táctil, reduced motion y zoom/texto largo del catálogo; corregir mediante ciclo rojo-verde cualquier regresión visual o accesible antes de la verificación integral.

## 7. Documentación y cierre verificable

- [ ] 7.1 Actualizar `frontend/DESIGN.md`, `docs/tecnico/revision-visual-frontend.md`, la matriz de trazabilidad visual y sus referencias terminológicas con tokens efectivos, breakpoints, política de evidencia, IDs Figma y adaptaciones; registrar explícitamente que no cambian OpenAPI, migraciones, ADR ni diagramas C4.
- [ ] 7.2 Ejecutar desde un estado limpio las pruebas enfocadas, `cd frontend && CATALOG_EVIDENCE_DIR=<ruta-externa> npm run test:e2e:catalog`, `make frontend-check`, `make check`, `make test`, `make audit` y `openspec validate aplicar-catalogo-visual-frontend --strict`; guardar comandos, resultados y cualquier excepción preexistente sin afirmar éxito si una comprobación falla.
- [ ] 7.3 Revisar el diff final para excluir secretos, evidencia generada, datos personales, cambios de negocio, API o backend; confirmar que `package.json` y `package-lock.json` permanecen sincronizados si surgió alguna dependencia justificada y que no se sobrescribieron cambios ajenos.
- [ ] 7.4 Tras aceptación visual y verificaciones exitosas, actualizar todas las casillas/evidencias de trazabilidad, integrar los commits autorizados en `master` y dejar el cambio listo para `/opsx:verify`; no sincronizar specs principales ni archivar antes de completar verificación e integración.

[Referencia terminológica](tasks-glossary-reference.md).
