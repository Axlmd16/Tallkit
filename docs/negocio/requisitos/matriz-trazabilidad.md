# Matriz de trazabilidad de requisitos

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.2 |
| Estado | Matriz inicial — borrador para revisión |
| Fecha | 2026-08-04 |

> Esta matriz conecta la definición del negocio con requisitos, casos de uso, interfaz y pruebas futuras. La arquitectura, API, especificaciones OpenSpec y pruebas todavía no existen; sus columnas se completarán sin cambiar los identificadores actuales.

## 1. Convenciones

| Prefijo | Artefacto |
|---|---|
| `RN-*` | Regla de negocio. |
| `DP-*` | Decisión pendiente. |
| `RF-*` | Requisito funcional. |
| `RNF-*` | Requisito no funcional. |
| `CU-*` | Caso de uso. |
| `UI-*` | Pantalla o elemento principal de interfaz. |
| `CP-*` | Caso de prueba futuro. |
| `SPEC-*` | Especificación OpenSpec futura. |
| `API-*` | Operación de API futura. |

Cuando una celda usa un rango inclusivo, por ejemplo `RF-CLI-001…005`, todos los identificadores del rango están vinculados. La matriz de pruebas final podrá expandir los rangos a filas individuales.

## 2. Reglas fiscales, seguridad y configuración

| Regla de negocio | Requisitos funcionales | Caso de uso | Interfaz | Prueba futura |
|---|---|---|---|---|
| RN-FIS-001 | RF-ACC-010 | CU-003 | UI-014 | CP-FIS-001 |
| RN-FIS-002 | RF-INV-001…014; RF-VEN-001…016 | CU-007…015, CU-018, CU-020 | UI-040…063, UI-074…075, UI-080…081 | CP-FIS-002 |
| RN-FIS-003 | RF-TAL-001…018 | CU-016…020 | UI-034…035, UI-060…063, UI-070…081 | CP-FIS-003 |
| RN-FIS-004 | RF-CLI-001…012; RF-ACC-005…007 | CU-002, CU-004, CU-005 | UI-010…011, UI-020…025 | CP-FIS-004 |
| RN-FIS-005…006 | RF-VEN-001; RF-PAG-004; RF-PAG-010; RF-TAL-007…012; RF-REP-008 | CU-012, CU-013, CU-017, CU-018, CU-020 | UI-053…063, UI-071…081 | CP-FIS-005 |
| RN-FIS-007…008 | RF-VEN-002; RF-VEN-009; RF-VEN-016; RF-PAG-010; RF-TAL-010…012 | CU-017, CU-018 | UI-055, UI-060…063, UI-074…075 | CP-FIS-006 |
| RN-FIS-009 | RF-ACC-010; RF-REP-008; RF-TAL-012 | CU-003, CU-013, CU-018, CU-020 | UI-014, UI-055, UI-060…063, UI-075, UI-081 | CP-FIS-007 |
| RN-FIS-010 | RF-ACC-011; RF-PRO-003; RF-VEN-003; RF-TAL-007 | CU-003, CU-010, CU-012, CU-017 | UI-015, UI-051, UI-054, UI-071 | CP-FIS-008 |
| RN-SEG-001 | RF-ACC-001…005; RF-ACC-008 | CU-001, CU-002 | UI-001, UI-010…011 | CP-SEG-001 |
| RN-SEG-002…003 | RF-ACC-006…008 | CU-002 | UI-010…011 | CP-SEG-002 |
| RN-SEG-004 | RF-VEN-005; RF-VEN-011…014; RF-INV-006; RF-INV-009; RF-TAL-006; RF-TAL-013…016 | CU-007, CU-009, CU-012, CU-014, CU-015, CU-017, CU-019 | UI-042, UI-045, UI-054, UI-056…057, UI-071, UI-076 | CP-SEG-003 |
| RN-SEG-005…006 | RF-ACC-005; RF-ACC-009; RF-AUD-001…005 | CU-002, CU-009, CU-014, CU-015 | UI-010, UI-018, UI-045, UI-056…057 | CP-SEG-004 |
| RN-SEG-007 | RF-ACC-008 | Todos los casos protegidos | Todas las acciones protegidas | CP-SEG-005 |

## 3. Clientes, vehículos y catálogos

| Regla de negocio | Requisitos funcionales | Caso de uso | Interfaz | Prueba futura |
|---|---|---|---|---|
| RN-CLI-001 | RF-CLI-001; RF-CLI-004 | CU-004 | UI-020…022 | CP-CLI-001 |
| RN-CLI-002…003 | RF-CLI-001; RF-CLI-003; RF-CLI-012 | CU-004 | UI-020, UI-022 | CP-CLI-002 |
| RN-CLI-004…005 | RF-CLI-006; RF-CLI-009 | CU-005 | UI-021, UI-023…025 | CP-CLI-003 |
| RN-CLI-006 | RF-CLI-007…008; RF-CLI-012 | CU-005 | UI-023…025 | CP-CLI-004 |
| RN-CLI-007 | RF-CLI-009; RF-CLI-011 | CU-005 | UI-024 | CP-CLI-005 |
| RN-CLI-008 | RF-CLI-004…005; RF-CLI-010 | CU-004, CU-005 | UI-021…025 | CP-CLI-006 |
| RN-CAT-001…002 | RF-CAT-001…004 | CU-006 | UI-030…032 | CP-CAT-001 |
| RN-CAT-003…004 | RF-CAT-006…007 | CU-006 | UI-031…033 | CP-CAT-002 |
| RN-CAT-005…006 | RF-CAT-008…009 | CU-006, CU-012 | UI-030…032, UI-054 | CP-CAT-003 |
| RN-CAT-007 | RF-CAT-001; RF-CAT-005; RF-INV-001…003; RF-VEN-003…004 | CU-006, CU-007, CU-012 | UI-031…032, UI-041…042, UI-054…055 | CP-CAT-004 |
| RN-CAT-008…009 | RF-CAT-010…011; RF-TAL-005…006 | CU-016, CU-017 | UI-034…035, UI-071…072 | CP-CAT-005 |
| RN-CAT-010 | RF-CAT-012; RF-INV-001…002 | CU-006, CU-007 | UI-036…037, UI-041 | CP-CAT-006 |

## 4. Inventario e ingresos

| Regla de negocio | Requisitos funcionales | Caso de uso | Interfaz | Prueba futura |
|---|---|---|---|---|
| RN-INV-001…002 | RF-INV-007…010; RF-REP-001…002 | CU-008, CU-009 | UI-031, UI-043…046, UI-081 | CP-INV-001 |
| RN-INV-003…004 | RF-INV-001…002 | CU-007 | UI-040…041 | CP-INV-002 |
| RN-INV-005…007 | RF-INV-003; RF-INV-007…008 | CU-007, CU-008 | UI-042…044 | CP-INV-003 |
| RN-INV-008 | RF-VEN-006…008 | CU-012 | UI-054…055 | CP-INV-004 |
| RN-INV-009 | RF-PRO-001…005 | CU-010 | UI-050…052 | CP-INV-005 |
| RN-INV-010 | RF-INV-009; RF-AUD-001…002 | CU-009 | UI-045 | CP-INV-006 |
| RN-INV-011…012 | RF-INV-006; RF-INV-010; RF-VEN-010…013; RF-AUD-003…004 | CU-014, CU-015 | UI-042, UI-044…045, UI-056…057 | CP-INV-007 |
| RN-INV-013 | RF-INV-012; RF-VEN-005; RF-VEN-008 | CU-009, CU-012, CU-014, CU-015 | UI-045, UI-054, UI-056…057 | CP-INV-008 |
| RN-INV-014 | RF-INV-005; RF-VEN-007; RF-AUD-006 | CU-007, CU-012, CU-014, CU-015 | UI-041, UI-054, UI-056…057 | CP-INV-009 |
| RN-INV-015 | RF-INV-014 | CU-007, CU-009, CU-012 | UI-041, UI-045, UI-054 | CP-INV-010 |
| RN-INV-016 | RF-INV-012; RF-VEN-005; RF-VEN-008 | CU-009, CU-012 | UI-045, UI-054 | CP-INV-011 |

## 5. Proformas, ventas y pagos

| Regla de negocio | Requisitos funcionales | Caso de uso | Interfaz | Prueba futura |
|---|---|---|---|---|
| RN-PRO-001…003 | RF-PRO-001…005 | CU-010 | UI-050…052 | CP-PRO-001 |
| RN-PRO-004…005 | RF-PRO-003; RF-PRO-007…008 | CU-011 | UI-051…054 | CP-PRO-002 |
| RN-PRO-006…007 | RF-PRO-005; RF-PRO-007; RF-PRO-009 | CU-011 | UI-050…054 | CP-PRO-003 |
| RN-PRO-008 | RF-PRO-002; RF-PRO-006…007 | CU-010, CU-011 | UI-051…053 | CP-PRO-004 |
| RN-VEN-001…003 | RF-VEN-001…003; RF-VEN-005…006 | CU-012 | UI-053…055 | CP-VEN-001 |
| RN-VEN-004…005 | RF-VEN-005…008; RF-VEN-014 | CU-012 | UI-054…055 | CP-VEN-002 |
| RN-VEN-006…007 | RF-VEN-004; RF-VEN-009…011 | CU-012, CU-015 | UI-055, UI-057 | CP-VEN-003 |
| RN-VEN-008 | RF-PAG-001 | CU-012, CU-013 | UI-054, UI-060 | CP-PAG-001 |
| RN-VEN-009…010 | RF-PAG-002…003 | CU-013 | UI-060…061 | CP-PAG-002 |
| RN-VEN-011…012 | RF-PAG-005…006 | CU-013, CU-020 | UI-055, UI-060…062, UI-081 | CP-PAG-003 |
| RN-VEN-013 | RF-PAG-004; RF-PAG-010 | CU-013 | UI-060…062 | CP-PAG-004 |
| RN-VEN-014 | RF-PAG-007 | CU-013 | UI-060 | CP-PAG-005 |
| RN-VEN-015 | RF-VEN-012…013; RF-PAG-007…008 | CU-014 | UI-056, UI-063 | CP-VEN-004 |
| RN-VEN-016 | RF-VEN-011; RF-PAG-008 | CU-015 | UI-057, UI-061…063 | CP-VEN-005 |
| RN-VEN-017 | RF-VEN-014 | CU-010, CU-012 | UI-051, UI-054 | CP-VEN-006 |
| RN-VEN-018 | RF-ACC-012; RF-INV-004; RF-VEN-006; RF-VEN-008 | CU-003, CU-007, CU-012 | UI-016, UI-041…042, UI-054…055 | CP-VEN-007 |

## 6. Taller, documentos y reportes

| Regla de negocio | Requisitos funcionales | Caso de uso | Interfaz | Prueba futura |
|---|---|---|---|---|
| RN-TAL-001…003 | RF-TAL-001…002; RF-TAL-015 | CU-017, CU-019 | UI-070…071, UI-075…076 | CP-TAL-001 |
| RN-TAL-004…005 | RF-TAL-013…015 | CU-019 | UI-075…076 | CP-TAL-002 |
| RN-TAL-006…007 | RF-TAL-002…004 | CU-017 | UI-071, UI-073 | CP-TAL-003 |
| RN-TAL-008…009 | RF-TAL-005…006 | CU-016, CU-017 | UI-034…035, UI-071…072 | CP-TAL-004 |
| RN-TAL-010 | RF-TAL-007…009; RF-PAG-010 | CU-013, CU-017 | UI-060…063, UI-071, UI-075, UI-077 | CP-TAL-005 |
| RN-TAL-011…012 | RF-TAL-010…012; RF-VEN-002; RF-VEN-016 | CU-018 | UI-055, UI-074…075 | CP-TAL-006 |
| RN-TAL-013…014 | RF-TAL-011; RF-TAL-013…015 | CU-018, CU-019 | UI-074…076 | CP-TAL-007 |
| RN-TAL-015…016 | RF-TAL-018 | CU-017, CU-019 | UI-071, UI-075…076 | CP-TAL-008 |
| RN-TAL-017 | RF-TAL-016 | CU-019 | UI-075…076 | CP-TAL-009 |
| RN-CON-001…002 | RF-ACC-011; RF-PRO-003; RF-VEN-004; RF-TAL-005…008 | CU-003, CU-010, CU-012, CU-017 | UI-015, UI-051, UI-054…055, UI-071…072 | CP-CON-001 |
| RN-CON-003 | RF-PRO-010; RF-VEN-015 | CU-010, CU-012 | UI-058, UI-077 | CP-CON-002 |
| RN-CON-004…005 | RF-REP-003…008 | CU-020 | UI-080…081 | CP-CON-003 |
| RN-CON-006 | RF-TAL-004; RNF-DIS-002…005 | CU-017, CU-021 | UI-073, UI-083 | CP-CON-004 |
| RN-CON-007 | RF-AUD-003…004; RF-INV-010; RF-VEN-010…013 | CU-009, CU-014, CU-015 | UI-018, UI-042, UI-044…045, UI-055…057 | CP-CON-005 |
| RN-CON-008 | RF-REP-010; RNF-INT-008; RNF-AUD-005 | Todos los casos con fecha | Todas las pantallas con fecha | CP-CON-006 |

## 7. Trazabilidad de requisitos no funcionales

| Grupo RNF | Componentes o procesos afectados | Método principal | Evidencia futura |
|---|---|---|---|
| RNF-SEG-001…012 | Autenticación, permisos, archivos, configuración y despliegue | SEG + REV + PRU | Informe de seguridad y pruebas de autorización |
| RNF-INT-001…010 | Ingresos, ventas, pagos, devoluciones, secuenciales y migraciones | PRU + CAR | Pruebas transaccionales y concurrentes |
| RNF-REN-001…007 | API, consultas, reportes y archivos | CAR | Informe de rendimiento con datos representativos |
| RNF-DIS-001…008 | Servidor local, base de datos, archivos y actualizaciones | RES + REV | Registro de respaldo, restauración y recuperación |
| RNF-USA-001…012 | UI-001…083 y documentos imprimibles | USA + PRU | Lista de verificación y pruebas con usuarios |
| RNF-COM-001…006 | Navegadores, servidor, API y configuración | PRU + REV | Matriz de compatibilidad |
| RNF-MAN-001…010 | Código, documentación, API, pruebas y ADR | REV + PRU | Revisiones, análisis estático y cobertura |
| RNF-AUD-001…006 | Auditoría funcional y registros técnicos | PRU + REV | Casos de auditoría y política de retención |
| RNF-DAT-001…005 | Clientes, vehículos, usuarios, exportaciones y pruebas | REV + SEG | Revisión de campos, permisos y anonimización |

## 8. Decisiones pendientes y bloqueo documental

| Decisión | Reglas | Requisitos | Casos/pantallas | Estado actual |
|---|---|---|---|---|
| DP-001 Bodegas | RN-INV-002 | RF-INV-007…009, RF-INV-013 | CU-007…009; UI-041, UI-043…045 | Soportar al menos una principal; multiplicidad sin cerrar. |
| DP-002 Stock negativo | RN-INV-013, RN-INV-016, RN-VEN-004 | RF-INV-012, RF-VEN-005, RF-VEN-008 | CU-009, CU-012; UI-045, UI-054 | No implementar confirmación definitiva sin decisión. |
| DP-003 Formas de pago | RN-VEN-009…010 | RF-ACC-014, RF-PAG-002…003 | CU-003, CU-013; UI-017, UI-060 | Catálogo configurable; lista inicial pendiente. |
| DP-004 Descuentos | RN-SEG-004, RN-VEN-017 | RF-PRO-003, RF-VEN-003, RF-VEN-014 | CU-010, CU-012; UI-051, UI-054, UI-072 | Vendedor dentro del límite; Administrador para excesos; límite pendiente. |
| DP-005 Devoluciones y saldos a favor | RN-VEN-014…016 | RF-VEN-011…013, RF-PAG-007…008 | CU-013…015; UI-056…057, UI-063 | Rechazar sobrepago; procedimiento de devolución pendiente. |
| DP-006 Secuenciales | RN-VEN-018 | RF-ACC-012, RF-INV-004, RF-VEN-006, RF-TAL-008 | CU-003, CU-007, CU-012, CU-017; UI-016 | Unicidad definida; formato y series pendientes. |
| DP-007 Reapertura | RN-TAL-017 | RF-TAL-016 | CU-019; UI-075…076 | Reapertura deshabilitada. |
| DP-008 Datos obligatorios | RN-CLI-001…006 | RF-CLI-001, RF-CLI-007 | CU-004, CU-005; UI-022, UI-025 | Campos finales pendientes. |

## 9. Capacidades OpenSpec futuras

| Código futuro | Capacidad | Requisitos principales |
|---|---|---|
| SPEC-IDENTIDAD | Identidad y acceso | RF-ACC-001…009; RNF-SEG-* |
| SPEC-CONFIG | Entidades y parámetros | RF-ACC-010…014 |
| SPEC-CLIENTES | Clientes y vehículos | RF-CLI-001…012 |
| SPEC-CATALOGOS | Productos, servicios y proveedores | RF-CAT-001…012 |
| SPEC-INVENTARIO | Ingresos, existencias y Kardex | RF-INV-001…014 |
| SPEC-PROFORMAS | Proformas | RF-PRO-001…010 |
| SPEC-VENTAS | Ventas y devoluciones | RF-VEN-001…016 |
| SPEC-PAGOS | Pagos y cuentas por cobrar | RF-PAG-001…010 |
| SPEC-TALLER | Servicios y mantenimientos | RF-TAL-001…018 |
| SPEC-REPORTES | Reportes y consultas | RF-REP-001…010 |
| SPEC-AUDITORIA | Auditoría y correcciones | RF-AUD-001…006; RNF-AUD-* |
| SPEC-OPERACION | Respaldo y operación | RNF-DIS-*; RNF-COM-* |

## 10. Controles de cobertura

La matriz se considerará completa para iniciar diseño cuando:

1. Cada regla `RN-*` tenga al menos un requisito y una prueba prevista.
2. Cada requisito `RF-*` tenga un caso de uso o una justificación de servicio interno.
3. Cada requisito funcional tenga criterio de aceptación detallado en `docs/pruebas/criterios-aceptacion.md`.
4. Cada RNF tenga método, entorno, umbral y evidencia definidos.
5. Los endpoints `API-*` y las especificaciones `SPEC-*` se incorporen después de aprobar dominio y arquitectura.
6. Ninguna decisión `DP-*` se marque resuelta sin actualizar reglas, requisitos, casos, interfaz y pruebas afectadas.

## 11. Historial de actualización previsto

| Etapa | Actualización requerida |
|---|---|
| Aprobación funcional | Cambiar reglas y requisitos de propuesta a aprobados; resolver o aceptar decisiones pendientes. |
| Diseño de dominio | Añadir entidades, invariantes y diagramas relacionados. |
| Diseño de API | Añadir operaciones `API-*` a cada requisito funcional. |
| Línea base OpenSpec | Sustituir códigos futuros por rutas reales de especificación. |
| Plan de pruebas | Añadir casos `CP-*`, automatización y evidencia. |
| Implementación | Añadir módulos, tareas y versión implementada. |
