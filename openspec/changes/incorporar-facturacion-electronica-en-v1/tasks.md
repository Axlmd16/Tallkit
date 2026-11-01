## 1. Preparación y línea base

Base: propuesta, specs y diseño aprobados y registrados en `master` (`82aff92`, `69f6e8e`, `bfc8de6`).

Este cambio no tiene código, así que no hay pruebas automatizadas ni contrato OpenAPI que actualizar. El equivalente de TDD es la búsqueda base de 1.2: registra lo que hoy está mal y el grupo 8 comprueba que quedó corregido o justificado.

- [ ] 1.1 Comprobar con `git status --short` y `git log` que los artefactos aprobados están en `master`. Preservar cambios ajenos.
- [ ] 1.2 Buscar en documentos vigentes `fase posterior`, `referencia fiscal futura`, `futura referencia`, `facturación futura`, `no forma parte de V1`, `fuera de V1`, `factuplan` y `ruxi`, y guardar el resultado en el directorio temporal de la sesión.

Criterio de grupo: registro comprobado y línea base guardada.

## 2. Decisión confirmada

Cubre diseño D1 y el requisito «Sincronización de la decisión de facturación».

- [ ] 2.1 Agregar `DP-034` en `docs/negocio/decisiones/decisiones-confirmadas.yaml`, después de `DP-033`, con las nueve reglas de la propuesta y su fecha de aprobación.
- [ ] 2.2 Marcar `DP-018` como sustituida en parte, conservando su texto e indicando qué parte sigue vigente.
- [ ] 2.3 Reemplazar el límite de V1 sobre facturación y SRI, y retirar «y facturación electrónica» de las decisiones no cerradas, conservando consumidor final.
- [ ] 2.4 Confirmar que `docs/negocio/decisiones/decisiones-confirmadas-glossary-reference.md` cubre los términos nuevos.

Criterio de grupo: el YAML sigue siendo válido (desde `backend/`, `uv run python -c` con `yaml.safe_load`), y `DP-018` y `DP-034` se referencian entre sí.

## 3. Producto

Cubre diseño D9 y D10, y los requisitos «Facturación electrónica incluida en V1» y «Operación sin Internet».

- [ ] 3.1 Actualizar `docs/negocio/producto/vision.md` §12, §13 y §14.
- [ ] 3.2 Actualizar `docs/negocio/producto/alcance-v1.md` §1, §2, §6, §7, §9, §10 y la extensión final: incluir comprobantes en V1, excluir los demás comprobantes, cerrar `FUT-001` y dejar consumidor final en el cambio 6.
- [ ] 3.3 Agregar a `alcance-v1.md` §9 el criterio de aceptación de D9.
- [ ] 3.4 Actualizar `docs/negocio/producto/reglas-negocio.md`: agregar `RN-FIS-015…018`, ajustar `RN-FIS-012` y `RN-FIS-014`, quitar «futura» de `RN-CON-010` y actualizar §12. Conservar `RN-CON-003` y `RN-CON-009`.
- [ ] 3.5 Actualizar `docs/negocio/producto/glosario.md`: agregar proveedor de emisión, activación por RUC, prueba real supervisada, RIDE, firma electrónica, matriz de normas y referencia fiscal; actualizar facturación electrónica, estado de facturación, evidencia fiscal externa y los pares de confusión; agregar el par «Proveedor / Proveedor de emisión».
- [ ] 3.6 Actualizar las referencias de glosario de los documentos de producto modificados.

Criterio de grupo: «Factuplan» no aparece en estos documentos, salvo en las decisiones. La búsqueda de 1.2 sobre `docs/negocio/producto/` queda corregida o justificada.

## 4. Matriz de normas

Cubre diseño D2 y D3, y todos los requisitos de `normativa-de-facturacion-electronica`.

- [ ] 4.1 Crear `docs/negocio/requisitos/matriz-normas-facturacion-electronica.md` con las columnas de D2, los estados y el aviso de que no certifica cumplimiento.
- [ ] 4.2 Intentar leer el texto oficial de `NAC-DGERCGC25-00000014`, `NAC-DGERCGC25-00000017`, `NAC-DGERCGC26-00000027` y la ficha técnica, desde las fuentes oficiales del SRI. Registrar qué se pudo leer y qué no.
- [ ] 4.3 Crear una fila `NOR-*` por cada tema mínimo. Resumir solo lo leído; lo demás queda Pendiente, con la fuente marcada como secundaria y lo que falta obtener.
- [ ] 4.4 Registrar como Requiere validación externa lo que dependa de un contador o un abogado, indicando a quién preguntar, qué preguntar y qué cambia según la respuesta.
- [ ] 4.5 Asignar cada fila a su cambio responsable, o marcarla sin cambio asignado.
- [ ] 4.6 Crear `matriz-normas-facturacion-electronica-glossary-reference.md`.

Criterio de grupo: cada tema mínimo y cada resolución citada tienen fila, y ninguna fila está Verificada sin texto oficial leído.

## 5. Requisitos

Cubre diseño D4 y D5, y los requisitos «Activación por entidad fiscal» y «Transición hasta habilitar la emisión real».

- [ ] 5.1 Actualizar `docs/negocio/requisitos/requisitos-funcionales.md`: agregar `RF-FIS-008…013`, ajustar `RF-FIS-003` y `RF-FIS-006`, reemplazar `RF-REP-014`, ajustar `RF-VEN-009` y corregir la exclusión final. Conservar `RF-VEN-015` y `RF-PRO-010`.
- [ ] 5.2 Actualizar `docs/negocio/requisitos/requisitos-no-funcionales.md`: ajustar `RNF-DIS-001` y agregar `RNF-DIS-009` y `RNF-COM-007`. Conservar `RNF-USA-012`.
- [ ] 5.3 Actualizar `docs/negocio/requisitos/casos-de-uso.md`: agregar `CU-031` a alto nivel y ajustar `CU-003` 5d con la condición de D5.
- [ ] 5.4 Actualizar `docs/negocio/requisitos/actores-y-roles.md` §7: permisos pendientes de los cambios 3 y 7.
- [ ] 5.5 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md` §9 y §11, conservando el aviso mientras no exista emisión.
- [ ] 5.6 Actualizar las referencias de glosario de los documentos de requisitos modificados.

Criterio de grupo: cada identificador nuevo de D4 existe, y no se renumeró ninguno. Los documentos citan «cambios 3 y 4 de `docs/cambios-pendientes.md`», sin nombrar al proveedor.

## 6. Arquitectura y documentos técnicos

Cubre diseño D6, D7 y D8, y los requisitos «Documentos internos y facturación electrónica» y «Emisión por proveedor reemplazable».

- [ ] 6.1 Actualizar `docs/arquitectura/modelo-dominio.md`: §1, §3, §5.3, §7, §11.5, §13 y §14; renombrar `ReferenciaFiscalFutura` a `ReferenciaFiscal` en el diagrama; agregar §11.8. No agregar clases ni cambiar la lista de estados.
- [ ] 6.2 Actualizar `docs/architecture/c4-context.md` con el proveedor de emisión y el SRI como sistemas externos, solo de salida. No modificar `c4-containers.md`.
- [ ] 6.3 Agregar la sección «Actualización» a `docs/adr/0010-modulo-fiscal-independiente-y-archivo-transaccional.md`, sin cambiar su texto ni su estado.
- [ ] 6.4 Agregar adaptador de emisión a `docs/tecnico/glosario-tecnico.md`.
- [ ] 6.5 Agregar a `docs/tecnico/operacion-archivo-fiscal.md` la nota de la prueba real, indicando que aún no opera porque `xml_archive.py:174` la bloquea.
- [ ] 6.6 Precisar en `docs/tecnico/matriz-instantanea-fiscal.md` que «fuera de alcance» se refiere a esa matriz.
- [ ] 6.7 Actualizar las referencias de glosario de los documentos modificados en este grupo.

Criterio de grupo: el diagrama Mermaid de `modelo-dominio.md` no conserva `ReferenciaFiscalFutura`, y `c4-context.md` ya no niega integraciones externas.

## 7. Trazabilidad y plan

Cubre diseño D10 y los escenarios «Requisito nuevo sin implementar», «Asunto aplazado» y «Plan actualizado».

- [ ] 7.1 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md`: agregar el prefijo `NOR-*`, renombrar la fila «Documentos internos y futura referencia SRI», y registrar `DP-034` y los identificadores nuevos como pendientes, con su cambio responsable.
- [ ] 7.2 Actualizar `docs/cambios-pendientes.md`: asignar el redondeo del IVA y `DP-025` al cambio 2, y registrar en el cambio 4 la prueba real, la excepción de `xml_archive.py:174` y las condiciones de activación.
- [ ] 7.3 Registrar en el cambio 5 la convivencia con el RIDE, en los cambios 3 y 7 los permisos, y en el cambio 3 la lista de estados y el C4 de contenedores.
- [ ] 7.4 Marcar en el plan la casilla «Registrar en Git…», los choques resueltos del cambio 1 y sus pasos completados.

Criterio de grupo: cada identificador nuevo aparece en la trazabilidad como pendiente, y ningún asunto aplazado queda sin cambio responsable.

## 8. Verificación final

Cubre diseño, sección «Verificación», y el escenario «Límite del cambio».

- [ ] 8.1 Ejecutar `openspec validate incorporar-facturacion-electronica-en-v1 --strict`.
- [ ] 8.2 Repetir la búsqueda de 1.2 y clasificar cada resultado como corregido o justificado. Las specs de otras capacidades y `ADR-0008` pueden seguir citando la referencia futura.
- [ ] 8.3 Comprobar que `factuplan` y `ruxi` solo aparecen en la decisión, el plan y los artefactos de este cambio.
- [ ] 8.4 Comprobar con `git diff --stat` que solo cambiaron `.md`, el YAML de decisiones y los artefactos del cambio; en particular, nada en `backend/`, `frontend/` ni `docs/arquitectura/modelo-datos.md`.
- [ ] 8.5 Comprobar que los enlaces nuevos y las referencias de glosario resuelven a archivos existentes.
- [ ] 8.6 Recorrer los 42 escenarios de las dos specs y registrar aquí su evidencia por grupo.

Criterio de grupo: comandos ejecutados y resultados registrados. Formato, lint, tipos, pruebas, cobertura, build y migraciones no aplican porque no hay código. Estas tareas no autorizan commits, ramas, merges ni el archivado del cambio.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
