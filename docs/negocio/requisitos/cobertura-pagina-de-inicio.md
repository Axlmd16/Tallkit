# Cobertura de la página de inicio

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `openspec/changes/redisenar-pagina-de-inicio`; specs `pagina-de-inicio` (nueva) y `sistema-visual-frontend` (delta) |
| Estado | En aplicación |
| Fecha | 2026-10-06 |
| Alcance | Resumen de trabajo del inicio: acciones rápidas, pendientes, saldos por cobrar separados por **entidad fiscal** y cobros de los últimos siete días, limitado por **permisos efectivos**. Excluye stock bajo, estado del respaldo, cierre de caja, márgenes y reportes |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | Cumplidos | Parciales | Pendientes |
|---|---|---|---|---|---|
| Página de inicio | 9 | 41 | 0 | 0 | 41 |
| Sistema visual (delta) | 1 | 6 | 0 | 0 | 6 |
| **Total** | **10** | **47** | **0** | **0** | **47** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el escenario. La columna «Prueba» nombra el archivo y la prueba; «Pendiente» indica que todavía no existe evidencia.

## 2. Escenarios

### Página de inicio

| ID | Requisito | Escenario | Tarea | Prueba | Resultado |
|---|---|---|---|---|---|
| I-01 | Resumen de inicio limitado por permisos efectivos | Resumen de un Vendedor | — | Pendiente | Pendiente |
| I-02 | Resumen de inicio limitado por permisos efectivos | Resumen de un Encargado del taller | — | Pendiente | Pendiente |
| I-03 | Resumen de inicio limitado por permisos efectivos | Roles acumulados | — | Pendiente | Pendiente |
| I-04 | Resumen de inicio limitado por permisos efectivos | Consulta directa sin permiso | — | Pendiente | Pendiente |
| I-05 | Resumen de inicio limitado por permisos efectivos | Sesión invalidada | — | Pendiente | Pendiente |
| I-06 | Acciones rápidas hacia las operaciones frecuentes | Accesos de un Vendedor | — | Pendiente | Pendiente |
| I-07 | Acciones rápidas hacia las operaciones frecuentes | Cobrar con las dos entidades | — | Pendiente | Pendiente |
| I-08 | Acciones rápidas hacia las operaciones frecuentes | Acceso sin efectos | — | Pendiente | Pendiente |
| I-09 | Pendientes con acceso a su lista | Mantenimientos abiertos | — | Pendiente | Pendiente |
| I-10 | Pendientes con acceso a su lista | Venta de contado con cobro interrumpido | — | Pendiente | Pendiente |
| I-11 | Pendientes con acceso a su lista | Contado cubierto con retención | — | Pendiente | Pendiente |
| I-12 | Pendientes con acceso a su lista | Proformas que vencen hoy o mañana | — | Pendiente | Pendiente |
| I-13 | Pendientes con acceso a su lista | Retenciones separadas por entidad | — | Pendiente | Pendiente |
| I-14 | Pendientes con acceso a su lista | Entidad que no registra retenciones | — | Pendiente | Pendiente |
| I-15 | Pendientes con acceso a su lista | Calificación artesanal dentro del plazo de aviso | — | Pendiente | Pendiente |
| I-16 | Pendientes con acceso a su lista | Calificación artesanal fuera del plazo de aviso | — | Pendiente | Pendiente |
| I-17 | Pendientes con acceso a su lista | Sin pendientes | — | Pendiente | Pendiente |
| I-18 | Saldos por cobrar separados por entidad fiscal | Administrador con deuda en las dos entidades | — | Pendiente | Pendiente |
| I-19 | Saldos por cobrar separados por entidad fiscal | Retención que reduce el saldo | — | Pendiente | Pendiente |
| I-20 | Saldos por cobrar separados por entidad fiscal | Reembolso pendiente | — | Pendiente | Pendiente |
| I-21 | Saldos por cobrar separados por entidad fiscal | Coincidencia con las cuentas por cobrar | — | Pendiente | Pendiente |
| I-22 | Saldos por cobrar separados por entidad fiscal | Sin deuda | — | Pendiente | Pendiente |
| I-23 | Cobros de los últimos siete días por entidad fiscal | Siete días con un día sin cobros | — | Pendiente | Pendiente |
| I-24 | Cobros de los últimos siete días por entidad fiscal | Cobro cerca de la medianoche | — | Pendiente | Pendiente |
| I-25 | Cobros de los últimos siete días por entidad fiscal | Pago con retención | — | Pendiente | Pendiente |
| I-26 | Cobros de los últimos siete días por entidad fiscal | Pago anulado | — | Pendiente | Pendiente |
| I-27 | Cobros de los últimos siete días por entidad fiscal | Efectivo y transferencia combinados | — | Pendiente | Pendiente |
| I-28 | Cobros de los últimos siete días por entidad fiscal | Dos entidades sin total conjunto | — | Pendiente | Pendiente |
| I-29 | Cobros de los últimos siete días por entidad fiscal | Lectura sin el gráfico | — | Pendiente | Pendiente |
| I-30 | Resumen calculado y de solo lectura | Valor actualizado tras una operación | — | Pendiente | Pendiente |
| I-31 | Resumen calculado y de solo lectura | Consulta sin efectos | — | Pendiente | Pendiente |
| I-32 | Resumen calculado y de solo lectura | Tiempo de respuesta | — | Pendiente | Pendiente |
| I-33 | Estados independientes por bloque | Falla un solo bloque | — | Pendiente | Pendiente |
| I-34 | Estados independientes por bloque | Dato no disponible | — | Pendiente | Pendiente |
| I-35 | Estados independientes por bloque | Carga | — | Pendiente | Pendiente |
| I-36 | Estados independientes por bloque | Usuario sin funciones | — | Pendiente | Pendiente |
| I-37 | Inicio sin repetir la navegación | Inicio de un Administrador | — | Pendiente | Pendiente |
| I-38 | Presentación conforme al sistema Tallkit | Teléfono de 360 px | — | Pendiente | Pendiente |
| I-39 | Presentación conforme al sistema Tallkit | Uso con teclado | — | Pendiente | Pendiente |
| I-40 | Presentación conforme al sistema Tallkit | Persona que no distingue el color | — | Pendiente | Pendiente |
| I-41 | Presentación conforme al sistema Tallkit | Coherencia con el resto de las pantallas | — | Pendiente | Pendiente |

### Sistema visual (delta)

| ID | Requisito | Escenario | Tarea | Prueba | Resultado |
|---|---|---|---|---|---|
| V-01 | Indicadores con conteo y gráfico breve | Varios indicadores en un panel | — | Pendiente | Pendiente |
| V-02 | Indicadores con conteo y gráfico breve | Indicador que conduce a una lista | — | Pendiente | Pendiente |
| V-03 | Indicadores con conteo y gráfico breve | Gráfico de un ámbito fiscal | — | Pendiente | Pendiente |
| V-04 | Indicadores con conteo y gráfico breve | Valor de una barra | — | Pendiente | Pendiente |
| V-05 | Indicadores con conteo y gráfico breve | Movimiento reducido | — | Pendiente | Pendiente |
| V-06 | Indicadores con conteo y gráfico breve | Cambio de un token | — | Pendiente | Pendiente |

## 3. Verificación ejecutada

Pendiente: se completa al cierre con los comandos y resultados reales.

Referencia terminológica: [cobertura-pagina-de-inicio-glossary-reference.md](cobertura-pagina-de-inicio-glossary-reference.md).
