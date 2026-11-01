## 1. Preparación y línea base

Base: propuesta, specs y diseño aprobados y registrados en `master` (`82aff92`, `69f6e8e`, `bfc8de6`).

Este cambio no tiene código, así que no hay pruebas automatizadas ni contrato OpenAPI que actualizar. El equivalente de TDD es la búsqueda base de 1.2: registra lo que hoy está mal y el grupo 8 comprueba que quedó corregido o justificado.

- [x] 1.1 Comprobar con `git status --short` y `git log` que los artefactos aprobados están en `master`. Preservar cambios ajenos.
- [x] 1.2 Buscar en documentos vigentes `fase posterior`, `referencia fiscal futura`, `futura referencia`, `facturación futura`, `no forma parte de V1`, `fuera de V1`, `factuplan` y `ruxi`, y guardar el resultado en el directorio temporal de la sesión.

Criterio de grupo: registro comprobado y línea base guardada.

## 2. Decisión confirmada

Cubre diseño D1 y el requisito «Sincronización de la decisión de facturación».

- [x] 2.1 Agregar `DP-034` en `docs/negocio/decisiones/decisiones-confirmadas.yaml`, después de `DP-033`, con las nueve reglas de la propuesta y su fecha de aprobación.
- [x] 2.2 Marcar `DP-018` como sustituida en parte, conservando su texto e indicando qué parte sigue vigente.
- [x] 2.3 Reemplazar el límite de V1 sobre facturación y SRI, y retirar «y facturación electrónica» de las decisiones no cerradas, conservando consumidor final.
- [x] 2.4 Confirmar que `docs/negocio/decisiones/decisiones-confirmadas-glossary-reference.md` cubre los términos nuevos.

Criterio de grupo: el YAML sigue siendo válido (desde `backend/`, `uv run python -c` con `yaml.safe_load`), y `DP-018` y `DP-034` se referencian entre sí.

## 3. Producto

Cubre diseño D9 y D10, y los requisitos «Facturación electrónica incluida en V1» y «Operación sin Internet».

- [x] 3.1 Actualizar `docs/negocio/producto/vision.md` §12, §13 y §14.
- [x] 3.2 Actualizar `docs/negocio/producto/alcance-v1.md` §1, §2, §6, §7, §9, §10 y la extensión final: incluir comprobantes en V1, excluir los demás comprobantes, cerrar `FUT-001` y dejar consumidor final en el cambio 6.
- [x] 3.3 Agregar a `alcance-v1.md` §9 el criterio de aceptación de D9.
- [x] 3.4 Actualizar `docs/negocio/producto/reglas-negocio.md`: agregar `RN-FIS-015…018`, ajustar `RN-FIS-012` y `RN-FIS-014`, quitar «futura» de `RN-CON-010` y actualizar §12. Conservar `RN-CON-003` y `RN-CON-009`.
- [x] 3.5 Actualizar `docs/negocio/producto/glosario.md`: agregar proveedor de emisión, activación por RUC, prueba real supervisada, RIDE, firma electrónica, matriz de normas y referencia fiscal; actualizar facturación electrónica, estado de facturación, evidencia fiscal externa y los pares de confusión; agregar el par «Proveedor / Proveedor de emisión».
- [x] 3.6 Actualizar las referencias de glosario de los documentos de producto modificados.

Criterio de grupo: «Factuplan» no aparece en estos documentos, salvo en las decisiones. La búsqueda de 1.2 sobre `docs/negocio/producto/` queda corregida o justificada.

## 4. Matriz de normas

Cubre diseño D2 y D3, y todos los requisitos de `normativa-de-facturacion-electronica`.

- [x] 4.1 Crear `docs/negocio/requisitos/matriz-normas-facturacion-electronica.md` con las columnas de D2, los estados y el aviso de que no certifica cumplimiento.
- [x] 4.2 Intentar leer el texto oficial de `NAC-DGERCGC25-00000014`, `NAC-DGERCGC25-00000017`, `NAC-DGERCGC26-00000027` y la ficha técnica, desde las fuentes oficiales del SRI. Registrar qué se pudo leer y qué no.
- [x] 4.3 Crear una fila `NOR-*` por cada tema mínimo. Resumir solo lo leído; lo demás queda Pendiente, con la fuente marcada como secundaria y lo que falta obtener.
- [x] 4.4 Registrar como Requiere validación externa lo que dependa de un contador o un abogado, indicando a quién preguntar, qué preguntar y qué cambia según la respuesta.
- [x] 4.5 Asignar cada fila a su cambio responsable, o marcarla sin cambio asignado.
- [x] 4.6 Crear `matriz-normas-facturacion-electronica-glossary-reference.md`.

Criterio de grupo: cada tema mínimo y cada resolución citada tienen fila, y ninguna fila está Verificada sin texto oficial leído.

## 5. Requisitos

Cubre diseño D4 y D5, y los requisitos «Activación por entidad fiscal» y «Transición hasta habilitar la emisión real».

- [x] 5.1 Actualizar `docs/negocio/requisitos/requisitos-funcionales.md`: agregar `RF-FIS-008…013`, ajustar `RF-FIS-003` y `RF-FIS-006`, reemplazar `RF-REP-014`, ajustar `RF-VEN-009` y corregir la exclusión final. Conservar `RF-VEN-015` y `RF-PRO-010`.
- [x] 5.2 Actualizar `docs/negocio/requisitos/requisitos-no-funcionales.md`: ajustar `RNF-DIS-001` y agregar `RNF-DIS-009` y `RNF-COM-007`. Conservar `RNF-USA-012`.
- [x] 5.3 Actualizar `docs/negocio/requisitos/casos-de-uso.md`: agregar `CU-031` a alto nivel y ajustar `CU-003` 5d con la condición de D5.
- [x] 5.4 Actualizar `docs/negocio/requisitos/actores-y-roles.md` §7: permisos pendientes de los cambios 3 y 7.
- [x] 5.5 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md` §9 y §11, conservando el aviso mientras no exista emisión.
- [x] 5.6 Actualizar las referencias de glosario de los documentos de requisitos modificados.

Criterio de grupo: cada identificador nuevo de D4 existe, y no se renumeró ninguno. Los documentos citan «cambios 3 y 4 de `docs/cambios-pendientes.md`», sin nombrar al proveedor.

## 6. Arquitectura y documentos técnicos

Cubre diseño D6, D7 y D8, y los requisitos «Documentos internos y facturación electrónica» y «Emisión por proveedor reemplazable».

- [x] 6.1 Actualizar `docs/arquitectura/modelo-dominio.md`: §1, §3, §5.3, §7, §11.5, §13 y §14; renombrar `ReferenciaFiscalFutura` a `ReferenciaFiscal` en el diagrama; agregar §11.8. No agregar clases ni cambiar la lista de estados.
- [x] 6.2 Actualizar `docs/architecture/c4-context.md` con el proveedor de emisión y el SRI como sistemas externos, solo de salida. No modificar `c4-containers.md`.
- [x] 6.3 Agregar la sección «Actualización» a `docs/adr/0010-modulo-fiscal-independiente-y-archivo-transaccional.md`, sin cambiar su texto ni su estado.
- [x] 6.4 Agregar adaptador de emisión a `docs/tecnico/glosario-tecnico.md`.
- [x] 6.5 Agregar a `docs/tecnico/operacion-archivo-fiscal.md` la nota de la prueba real, indicando que aún no opera porque `xml_archive.py:174` la bloquea.
- [x] 6.6 Precisar en `docs/tecnico/matriz-instantanea-fiscal.md` que «fuera de alcance» se refiere a esa matriz.
- [x] 6.7 Actualizar las referencias de glosario de los documentos modificados en este grupo.

Criterio de grupo: el diagrama Mermaid de `modelo-dominio.md` no conserva `ReferenciaFiscalFutura`, y `c4-context.md` ya no niega integraciones externas.

## 7. Trazabilidad y plan

Cubre diseño D10 y los escenarios «Requisito nuevo sin implementar», «Asunto aplazado» y «Plan actualizado».

- [x] 7.1 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md`: agregar el prefijo `NOR-*`, renombrar la fila «Documentos internos y futura referencia SRI», y registrar `DP-034` y los identificadores nuevos como pendientes, con su cambio responsable.
- [x] 7.2 Actualizar `docs/cambios-pendientes.md`: asignar el redondeo del IVA y `DP-025` al cambio 2, y registrar en el cambio 4 la prueba real, la excepción de `xml_archive.py:174` y las condiciones de activación.
- [x] 7.3 Registrar en el cambio 5 la convivencia con el RIDE, en los cambios 3 y 7 los permisos, y en el cambio 3 la lista de estados y el C4 de contenedores.
- [x] 7.4 Marcar en el plan la casilla «Registrar en Git…», los choques resueltos del cambio 1 y sus pasos completados.

Criterio de grupo: cada identificador nuevo aparece en la trazabilidad como pendiente, y ningún asunto aplazado queda sin cambio responsable.

## 8. Verificación final

Cubre diseño, sección «Verificación», y el escenario «Límite del cambio».

- [x] 8.1 Ejecutar `openspec validate incorporar-facturacion-electronica-en-v1 --strict`.
- [x] 8.2 Repetir la búsqueda de 1.2 y clasificar cada resultado como corregido o justificado. Las specs de otras capacidades y `ADR-0008` pueden seguir citando la referencia futura.
- [x] 8.3 Comprobar que `factuplan` y `ruxi` solo aparecen en la decisión, el plan y los artefactos de este cambio.
- [x] 8.4 Comprobar con `git diff --stat` que solo cambiaron `.md`, el YAML de decisiones y los artefactos del cambio; en particular, nada en `backend/`, `frontend/` ni `docs/arquitectura/modelo-datos.md`.
- [x] 8.5 Comprobar que los enlaces nuevos y las referencias de glosario resuelven a archivos existentes.
- [x] 8.6 Recorrer los 42 escenarios de las dos specs y registrar aquí su evidencia por grupo.

Criterio de grupo: comandos ejecutados y resultados registrados. Formato, lint, tipos, pruebas, cobertura, build y migraciones no aplican porque no hay código. Estas tareas no autorizan commits, ramas, merges ni el archivado del cambio.

### Evidencia de verificación (2026-11-01)

**Comandos y resultados**

- 8.1: `openspec validate incorporar-facturacion-electronica-en-v1 --strict` → válido, código de salida 0.
- 2.4: lectura del YAML con `uv run python` desde `backend/` → correcta; aparecen `DP-018` marcada, `DP-034`, el límite nuevo y la decisión abierta nueva; el límite viejo ya no está.
- 8.2: la búsqueda base de 1.2 dio 23 coincidencias y la final 12. Corregidas: `vision.md`, `alcance-v1.md` (`FUT-001`), `reglas-negocio.md` (`RN-CON-010`), `requisitos-funcionales.md` (`RF-VEN-009`, `RF-REP-014`), glosario, `matriz-trazabilidad.md` y `modelo-dominio.md` (salvo la mención al término sustituido). Justificadas: `ADR-0008` (histórico, se mantiene); las specs `ventas-comerciales`, `operacion-artesanal-de-servicios` y `modelo-dominio-taller` (la última la reemplaza el delta al archivar; las otras las modificará su propio cambio); `decisiones-confirmadas.yaml:114` (texto original de `DP-018`, conservado) y `:277` (el acceso público sigue fuera de V1); `vision.md:142` (misma razón); `alcance-v1.md:102` (multibodega, ajeno); `glosario.md:148` (nombra el término sustituido); `reglas-negocio.md:69` (`RN-CLI-003`, `DP-008`: lo resuelve el cambio 2).
- 8.3: `factuplan` y `ruxi` aparecen solo en `docs/cambios-pendientes.md`, `decisiones-confirmadas.yaml`, los artefactos de este cambio y dos propuestas ya archivadas.
- 8.4: `git status` y `git diff --stat` → 32 archivos modificados y 2 nuevos (la matriz de normas y su referencia de glosario), todos `.md` o el YAML de decisiones. Nada en `backend/`, `frontend/` ni `modelo-datos.md`.
- 8.5: script de enlaces sobre los 33 archivos `.md` cambiados o nuevos → 60 enlaces relativos con sus anclas, uno roto: `ADR-0010` apunta a `openspec/changes/establecer-modulo-fiscal-independiente/design.md`, ruta de un cambio ya archivado. Es anterior a este cambio y lo corrige el cambio 15 del plan.
- Lectura de normas (4.2): se leyeron en su texto oficial `NAC-DGERCGC25-00000014`, `NAC-DGERCGC25-00000017` y la ficha 2.34 (apartados 4, 5, 7, 9 y los anexos 21, 22, 24 y 26). `NAC-DGERCGC18-00000233` se leyó por OCR (original de 2018). No se obtuvo el texto de `NAC-DGERCGC26-00000027`, solo el Boletín 042 del SRI y el Anexo 26. La matriz quedó con 18 filas: 7 Verificadas, 6 Pendientes y 5 Requieren validación externa.

**Escenarios por grupo**

- Grupo 2 y 3 (`Sincronización…` 7 escenarios): decisión anterior sustituida → `DP-018` marcada y `DP-034` agregada; documento que excluye la facturación → corregidos visión, alcance, reglas, glosario y C4; regla que se mantiene → `RN-CON-003` y `RN-CON-009` intactas; asunto aplazado → reglas §12, plan y actores; plan actualizado → grupo 7; requisito nuevo sin implementar → trazabilidad; límite del cambio → 8.4.
- Grupo 4 (`normativa-de-facturacion-electronica`, 13 escenarios): norma leída → `NOR-010` y `NOR-011` con enlace, fecha y cambio; exigencia sin cambio responsable → no se dio el caso, todas las filas tienen cambio; texto sin consultar → `NOR-005`; fuente secundaria → `NOR-005` identifica la fecha de publicación como dato de una fuente secundaria; norma que necesita interpretación → `NOR-006`, `NOR-008`, `NOR-016`, `NOR-017`, `NOR-018` con validaciones V-1 a V-5; validación externa recibida → regla al final de la sección 5; revisión de cobertura y resoluciones citadas → las tres resoluciones y los diez temas mínimos tienen fila; versión nueva de la ficha → sección 1; norma verificada, norma pendiente y fecha del comprobante en espera → sección 1, `RF-FIS-011`/`RF-FIS-012` citan filas y el plan exige resolver `NOR-008` antes del diseño del cambio 3; todas las filas verificadas → aviso inicial.
- Grupo 5 y 6 (`Documentos internos…`, `Facturación incluida…`, `Emisión por proveedor…`, `Activación…`, `Operación sin Internet`, `Transición…`, `Prueba real…`, 22 escenarios): `RN-FIS-015…018`, `RF-FIS-008…013`, `RNF-DIS-009`, `RNF-COM-007`, `CU-031`, `modelo-dominio.md` §11.8, `ADR-0010` y `operacion-archivo-fiscal.md`. La prueba sin casos definidos queda cubierta por `RN-FIS-018`.

**Desviaciones respecto a las tareas**

- Se agregó el objetivo 10 a `vision.md` §6 y la sección 3.12 a `alcance-v1.md`, que las tareas 3.1 y 3.2 no listaban.
- `NOR-007` y `NOR-009` pasaron de Verificada a Pendiente al comprobar que el PDF leído es el texto original de 2018, sin reformas.

**Hallazgo que requiere decisión del titular**

- `NOR-008`: el art. 7 de la `NAC-DGERCGC18-00000233` exige transmitir el comprobante «en el momento mismo de realizarse la transacción» y solo prevé otras formas de emisión por fuerza mayor. La regla 6 de `DP-034` («el comprobante espera en Tallkit») podría no ser admisible. Queda registrado como validación V-1 y como dependencia del cambio 3; no se modificó `DP-034`.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
