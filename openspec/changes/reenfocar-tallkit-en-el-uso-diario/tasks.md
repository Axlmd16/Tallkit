Riesgo de todos los grupos: **sin prueba nueva** (`AGENTS.md`): solo documentación, sin backend, frontend, datos, migraciones, OpenAPI ni ADR. Cada grupo cierra con su comprobación y, al final, con la verificación del grupo 7. Se recomiendan sesiones de uno o dos grupos, con commit al cerrar cada una.

## 1. Decisión `DP-036` (D1)

- [x] 1.1 En `docs/negocio/decisiones/decisiones-confirmadas.yaml`, agregar `DP-036` después de `DP-035`, con fecha de aprobación, propuesta de origen, reglas 1 a 8 y choques resumidos (se ajustan, se mantienen y se reemplazan), con el formato de `DP-034`.
- [x] 1.2 Marcar `DP-035` como «(ajustada en su regla 1 por DP-036, regla 4, desde U6)», conservando su texto.
- [x] 1.3 Reemplazar «Estado actual relevante» (línea 407) por el estado real: módulos de la línea base implementados y facturación solo en pruebas.
- [x] 1.4 Comprobar: el YAML se carga sin errores (`uv run --no-project --with pyyaml python -c "import yaml; yaml.safe_load(open('docs/negocio/decisiones/decisiones-confirmadas.yaml'))"`) y `rg -n "DP-036" docs/negocio/decisiones/` muestra la entrada y la marca de `DP-035`.

## 2. Producto (D3, D4 y D6)

- [x] 2.1 En `docs/negocio/producto/vision.md`, describir en §7 a la usuaria diaria con los tres roles y, en el principio 9, enlazar la simplicidad con `RNF-USA-013…016`.
- [x] 2.2 En `docs/negocio/producto/reglas-negocio.md`, ajustar `RN-CLI-003` con la excepción de la casilla del correo, «Aprobado y todavía no implementado: U6 de `docs/cambios-pendientes.md`».
- [x] 2.3 En `docs/negocio/producto/glosario.md`, cambiar el encabezado para que no exija usar todos sus términos en pantalla y agregar después de «Términos» la sección «Términos visibles en pantalla», con la regla 3 de `DP-036` y solo la equivalencia ya decidida: entidad fiscal → nombre comercial, o razón social si no lo hay. Indicar que U4 define las demás.
- [x] 2.4 Comprobar: `rg -n "DP-036|Términos visibles" docs/negocio/producto/` muestra los tres documentos, y `entidad fiscal`, `RUC comercial` y `RUC artesanal` siguen definidos en «Términos».

## 3. Requisitos (D2, D3 y D6)

- [x] 3.1 En `docs/negocio/requisitos/requisitos-no-funcionales.md`, ajustar `RNF-USA-009` y `RNF-USA-010` (pendientes de U4) y agregar `RNF-USA-013` a `RNF-USA-016` como objetivos provisionales (pendientes de U2 y U6), con el método de conteo de la spec `objetivos-de-uso-diario`.
- [x] 3.2 En `docs/negocio/requisitos/casos-de-uso.md`, agregar a `CU-012`, `CU-013` y `CU-019` la nota de que también se alcanzan desde «Cobrar y facturar» desde U6, sin cambiar el caso.
- [x] 3.3 En `docs/negocio/requisitos/actores-y-roles.md`, describir a la usuaria diaria con roles acumulados (`CT-001`), sin cambiar la tabla de §4 ni la separación de §5.
- [x] 3.4 En `docs/negocio/requisitos/interfaz-y-navegacion.md`, actualizar el encabezado (estado y referencia al cambio archivado). Hacer los ajustes de D3 en §2.1 (U5), §6.6 y §8.1 (U6). Marcar en reemplazo el diagrama de §2.2 hasta U4. Sustituir el flujo con borrador de §7.3 y el estado «Borrador» de ingreso en §9 por la entrada de stock de `DP-030`.
- [x] 3.5 Comprobar: `rg -n "RNF-USA-01[3-6]" docs/negocio/requisitos/` muestra los cuatro requisitos, y `rg -n "no incluye búsqueda global|Guardar borrador → Confirmar → Detalle" docs/negocio/requisitos/interfaz-y-navegacion.md` no devuelve resultados.

## 4. Modelo de dominio y trazabilidad (D3 y D6)

- [x] 4.1 En `docs/arquitectura/modelo-dominio.md`, ajustar §11.6 con la excepción del correo desde U6. Corregir la leyenda de Negocio Popular, que figura por confirmar aunque `DP-035` la confirmó. Quitar de §11.4 `DM-001`, que cerró `DP-029`, y corregir el enlace roto de §14.
- [x] 4.2 En `docs/negocio/requisitos/matriz-trazabilidad.md`, agregar `RNF-USA-013…016` como pendientes de U2 y U6, marcar en reemplazo la fila del sistema visual y completar en §4 las decisiones confirmadas `DP-022` a `DP-036`.
- [x] 4.3 Comprobar: `rg -n "consolidar-modelo-dominio-taller/specs" docs/arquitectura/` no devuelve resultados, cada enlace modificado apunta a un archivo existente y `rg -n "DP-036" docs/negocio/requisitos/matriz-trazabilidad.md` muestra la decisión.

## 5. Documentos de diseño y estado del repositorio (D5 y D6)

- [x] 5.1 En `DESIGN.md`, agregar al inicio el aviso «en reemplazo por `DP-036`, vigente hasta U3; la dirección nueva se escribe al aprobar U2», y corregir la línea 12, que cita como activo un cambio archivado.
- [x] 5.2 En `PRODUCT.md`, describir en «Users» a la usuaria diaria. En «Brand Commitments», recoger el nombre Tallkit y el logotipo existentes y marcar en reemplazo la preferencia por interfaces sobrias. Marcar igual el principio 4 de «Product Principles».
- [x] 5.3 Corregir `README.md:11` y `AGENTS.md:32` con el estado real de la implementación.
- [x] 5.4 Comprobar: `rg -n "aún no está implementado|Ventas, pagos, mantenimientos|No existe todavía nombre comercial" README.md AGENTS.md PRODUCT.md` no devuelve resultados, y lo que el README siga declarando pendiente (por ejemplo, alertas de stock mínimo) es cierto, y `rg -n "DP-036" DESIGN.md PRODUCT.md` muestra los avisos.

## 6. Plan de trabajo

- [x] 6.1 En `docs/cambios-pendientes.md`, poner U1 como cambio activo en la tabla inicial, con la fecha del día, y marcar en U1 las casillas de los choques decididos y de propuesta, specs, diseño y tareas aprobados.
- [x] 6.2 Agregar a U1 los choques nuevos con su salida, y a U2 la medición con la usuaria diaria y la comparación con el Facturador del SRI.
- [x] 6.3 Agregar a U4 que debe corregir `frontend/src/shared/ui/states.test.tsx:21`, que fija el texto «RUC comercial». Agregar a U6 el registro acortado de la orden, sus servicios y sus repuestos, la decisión de si finaliza la orden y la posible necesidad de un ADR.
- [x] 6.4 Comprobar: `rg -n "U1|U2|U4|U6" docs/cambios-pendientes.md` muestra lo agregado y no queda ninguna casilla marcada de un paso no aprobado.

## 7. Verificación del cambio

- [x] 7.1 Ejecutar `openspec validate reenfocar-tallkit-en-el-uso-diario --strict`: debe resultar válido.
- [x] 7.2 Ejecutar `git diff --stat master...develop`: solo archivos `.md`, el YAML de decisiones y los artefactos del cambio, sin código, pruebas ni `modelo-datos.md`.
- [x] 7.3 Buscar en `docs/`, `README.md`, `AGENTS.md`, `PRODUCT.md` y `DESIGN.md` (sin `docs/negocio/historico/` ni `docs/analisis-del-sistema.md`) estas frases: «aún no está implementado», «no implementan el dominio», «no incluye búsqueda global», «redisenar-sistema-visual-tallkit» y «consolidar-modelo-dominio-taller». Corregir cada resultado o justificarlo como histórico.
- [x] 7.4 Buscar `RNF-USA-01[3-6]`, `DP-036` y «en reemplazo»: cada aparición debe indicar su cambio responsable y ninguna debe presentarse como cumplida.
- [x] 7.5 Marcar «Aplicado» en U1 de `docs/cambios-pendientes.md` y registrar los comandos y resultados en el resumen de la aplicación.
