## Context

Este cambio registra `DP-036` y sincroniza la documentación. No toca código, así que este diseño decide cómo ordenar y redactar los documentos, no cómo programar U2 a U6.

Estado comprobado en el código el 2026-11-03:

- `frontend/src/app/navigation.ts` agrupa 18 entradas en 6 grupos: «Clientes y vehículos», «Catálogos», «Operación del taller», «Ventas y cobros», «Compras e inventario» y «Administración y control».
- Ningún archivo de `frontend/src/` ni `backend/src/` implementa una búsqueda global.
- Ningún archivo de `backend/src/fiscal/` escribe en clientes: el correo completado al facturar no llega a la ficha.
- `frontend/src/shared/ui/states.tsx:86` muestra «RUC comercial» y «RUC artesanal», y `states.test.tsx:21` fija ese texto.

Por tanto, la regla 8 de `DP-036` es cierta hoy: todo sigue como dicen las specs vigentes hasta que U3 a U6 lo cambien.

## Goals / Non-Goals

**Goals:**

- Registrar `DP-036` y sus ajustes sin borrar la historia de las decisiones anteriores.
- Escribir los requisitos nuevos de rapidez y ajustar los existentes, indicando qué cambio los implementa.
- Corregir la documentación desactualizada para que nadie, persona o agente, lea lo que ya no se hará.
- Dejar el plan listo para U2 a U6.

**Non-Goals:**

- Código, pruebas, modelos, migraciones, endpoints, pantallas o `modelo-datos.md`.
- Escribir la dirección visual nueva, los términos visibles definitivos o el diseño de «Cobrar y facturar».
- Crear un ADR: no se decide ninguna estructura técnica.

## Decisions

### D1. `DP-036` sigue el formato de las decisiones anteriores

`DP-036` se agrega después de `DP-035` en `decisiones-confirmadas.yaml`, como una entrada con sus reglas 1 a 8 y la tabla de choques resumida, igual que `DP-034`. `DP-035` recibe la marca «(ajustada en su regla 1 por DP-036, regla 4, desde U6)» y conserva su texto, igual que `DP-003` y `DP-027` frente a `DP-035`.

En el mismo archivo, «Estado actual relevante» deja de decir que el dominio no está implementado y describe el estado real: los módulos de la línea base están implementados y el sistema opera solo en pruebas para la facturación.

*Alternativa descartada:* reescribir `DP-035`, que borraría la historia de la decisión.

### D2. Identificadores nuevos

Se usan los siguientes números disponibles, sin renumerar nada. Ninguno existe hoy en `docs/` ni en `openspec/specs/`.

| ID | Contenido | Cambio responsable |
|---|---|---|
| `DP-036` | Decisión de uso diario, reglas 1 a 8 | U1 |
| `RNF-USA-013` | Servicio simple en 8 a 10 acciones | U6 |
| `RNF-USA-014` | Venta de mostrador en 5 a 6 acciones | U6 |
| `RNF-USA-015` | Mantenimiento con repuesto en 12 a 14 acciones | U6 |
| `RNF-USA-016` | Método de conteo y comprobación con la usuaria diaria | U2 y U6 |

No se crean `RF` ni `CU` para «Cobrar y facturar» ni para la búsqueda global: los crean U6 y U5 cuando definan su comportamiento. Crearlos ahora obligaría a escribir comportamiento que las specs de este cambio no definen.

*Alternativa descartada:* crear `CU-032` como en el precedente de `CU-031`. Aquí no hay un caso de uso nuevo, sino otro camino para `CU-012`, `CU-013` y `CU-019`.

### D3. Ajustes con condición, no con borrado

Lo que se ajusta conserva su sentido y agrega desde qué cambio rige, con la fórmula del precedente: «Aprobado y todavía no implementado: U#».

| Documento | Ajuste | Rige desde |
|---|---|---|
| `RNF-USA-009` | Lenguaje simple según los términos visibles del glosario. Sigue distinguiendo crédito de forma de pago y no muestra conceptos internos si no ayudan a la tarea | U4 |
| `RNF-USA-010` | Cada operación identifica su negocio por el nombre comercial o la razón social; el RUC queda en facturas, comprobantes y «Ajustes» | U4 |
| `RN-CLI-003` y modelo de dominio §11.6 | Excepción de la casilla para guardar el correo | U6 |
| `interfaz-y-navegacion.md` §2.1 | La búsqueda global deja de estar excluida | U5 |
| `interfaz-y-navegacion.md` §6.6 | Un botón vale si muestra los dos importes; repartir en silencio sigue prohibido | U6 |
| `interfaz-y-navegacion.md` §8.1 | «Cobrar y facturar» hace de confirmación de lo que contiene | U6 |
| `CU-012`, `CU-013` y `CU-019` | Nota: también se alcanzan desde «Cobrar y facturar»; el caso no cambia | U6 |

Los documentos citan los cambios como «U4 de `docs/cambios-pendientes.md`», igual que el precedente cita «cambios 3 y 4».

### D4. El glosario separa términos del dominio y términos visibles

`glosario.md` recibe una sección «Términos visibles en pantalla» después de «Términos». Su encabezado deja de decir que todos sus términos se usan en pantalla. La sección fija la regla de `DP-036`, regla 3, y una sola equivalencia ya decidida: la entidad fiscal se muestra con el nombre comercial del negocio o, en su defecto, con su razón social. Las demás equivalencias, como recibo, total a pagar o movimientos, las define U4.

«Entidad fiscal», «RUC comercial» y «RUC artesanal» siguen como términos del dominio. El glosario técnico no cambia.

*Alternativa descartada:* llenar ahora la tabla completa con las propuestas del análisis. Adelantaría decisiones de U4 que no se han aprobado.

### D5. «En reemplazo» como aviso, no como borrado

- `DESIGN.md`: un aviso al inicio dice que la dirección está en reemplazo por `DP-036`, que sigue vigente hasta U3 y que la nueva se escribe al aprobar U2. Se corrige además la línea 12, que cita como activo un cambio ya archivado.
- `PRODUCT.md`: «Users» describe a la usuaria diaria. «Brand Commitments» deja de decir que no hay nombre ni logotipo y marca en reemplazo la preferencia por interfaces sobrias. El principio 4, «Densidad útil», queda marcado igual.
- Specs visuales: reciben al archivar los requisitos «en reemplazo» de este cambio. Su texto anterior no se toca.
- `interfaz-y-navegacion.md` §2.2: el diagrama por áreas queda en reemplazo hasta U4. No se dibuja el menú nuevo, que decide U4.

*Alternativa descartada:* mover `DESIGN.md` a un histórico. Dejaría sin guía las pantallas que se toquen antes de U3.

### D6. Sincronización por documento

| Documento | Cambio | Salida |
|---|---|---|
| `decisiones-confirmadas.yaml` | D1 | Reemplaza y ajusta |
| `vision.md` §7 y principio 9 | Usuaria diaria; la simplicidad se mide con `RNF-USA-013…016` | Ajusta |
| `reglas-negocio.md` | `RN-CLI-003` (D3) | Ajusta |
| `requisitos-no-funcionales.md` | D2 y D3 | Reemplaza y ajusta |
| `casos-de-uso.md` | Notas de D3 | Ajusta |
| `actores-y-roles.md` | Usuaria diaria con roles acumulados; la tabla y §5 no cambian | Ajusta |
| `interfaz-y-navegacion.md` | Encabezado, §2.1, §2.2, §6.6, §7.3, §8.1 y el estado «Borrador» de ingreso en §9 | Reemplaza y ajusta |
| `glosario.md` | D4 | Ajusta |
| `modelo-dominio.md` | §11.6 (D3); leyenda de Negocio Popular ya confirmada; `DM-001` cerrada por `DP-029` en §11.4; enlace roto de §14 | Ajusta y corrige |
| `matriz-trazabilidad.md` | Fila de `RNF-USA-013…016` pendiente; fila del sistema visual en reemplazo; §4 completa las decisiones confirmadas, a la que hoy le faltan `DP-022` a `DP-033` y `DP-035` | Reemplaza y corrige |
| `PRODUCT.md` y `DESIGN.md` | D5 | Ajusta |
| `README.md:11` y `AGENTS.md:32` | Estado real de la implementación | Corrige |
| `docs/cambios-pendientes.md` | Casillas de U1, choques nuevos, medición real en U2, captura acortada en U6 y cambios activos | Reemplaza |

Sin cambios: el glosario técnico, los ADR, los C4, `openspec/config.yaml` (su contexto no repite el estado desactualizado), `docs/analisis-del-sistema.md`, que es la fuente del cambio, y las evidencias de cobertura de cambios anteriores.

El orden de edición sigue la precedencia: decisión, producto, requisitos, modelo, documentos de diseño y plan. Una inconsistencia a mitad del trabajo queda siempre en la fuente inferior.

### Impacto por área

| Área | Impacto |
|---|---|
| Backend, frontend, datos y API | Ninguno. |
| Seguridad y permisos | Ninguno. La tabla de permisos no cambia; asignar los tres roles a la usuaria es un acto de operación, no de este cambio. |
| Operación | Ninguno. La facturación sigue solo en pruebas. |
| Transacciones, concurrencia e idempotencia | No aplican: no hay escrituras. U6 las define. |

### Verificación

Es documentación: no aplican formato, lint, tipos, pruebas, cobertura, build ni migraciones.

- `openspec validate reenfocar-tallkit-en-el-uso-diario --strict`.
- `git diff --stat` solo muestra archivos `.md`, el YAML de decisiones y los artefactos del cambio.
- Búsquedas de frases desactualizadas: «aún no está implementado», «no implementan el dominio», «no incluye búsqueda global», «redisenar-sistema-visual-tallkit» y «consolidar-modelo-dominio-taller». Cada resultado se corrige o se justifica como histórico.
- Búsqueda de `RNF-USA-01[3-6]` y `DP-036`: deben figurar en requisitos, decisiones y trazabilidad, siempre como pendientes de su cambio.
- Comprobación de los enlaces nuevos y modificados.

## Risks / Trade-offs

- [Requisitos escritos antes de implementarse] → Constan como pendientes en la trazabilidad, con su cambio responsable.
- [Un agente toma «en reemplazo» por derogado] → Cada aviso dice que la regla sigue vigente hasta U3 o U4.
- [Documentos que prometen y código que todavía no cumple] → Es la transición prevista por la regla 8. Cada texto indica desde cuándo rige.
- [U4 encuentra una prueba que fija «RUC comercial»] → `states.test.tsx:21` fija ese texto, contra la regla de `AGENTS.md` de no fijar textos de la interfaz. U4 debe corregir esa prueba al cambiar el texto. Se anota en el plan.
- [Muchos documentos en un cambio] → El orden de D6 y las búsquedas finales reducen olvidos.

## Migration Plan

No hay datos ni despliegue. Si la decisión se revierte antes de U2, basta con revertir sus commits. Después de archivar, una reversión exige una decisión nueva que sustituya a `DP-036`.

## Open Questions

- **ADR para «Cobrar y facturar»:** coordinar ventas, taller, cobros y fiscal desde una sola acción puede necesitar un ADR. Lo decide el diseño de U6; no se reserva número.
- **Qué muestra «Facturas» antes del cambio 3:** U4 y U5.
- **Si «Cobrar y facturar» finaliza la orden:** U6.
- **Uso de tableta en el taller:** U2.
