## 1. Preparación y trazabilidad

Base: propuesta, specs y diseño aprobados y registrados en `master` (`4712ce6`, `6649bb6`, `c8f32a9`).

Cada tarea de comportamiento sigue **TDD**: prueba que falla por la razón esperada, implementación mínima, refactorización y repetir la prueba. Las pruebas se ejecutan focalizadas en lo que toca cada grupo, no la suite completa.

- [x] 1.1 Comprobar Git y que los tres artefactos aprobados están en `master`; preservar cambios ajenos. Evidencia: `git status --short` y revisión del historial; no empezar si falta el registro.
- [x] 1.2 Crear `docs/negocio/requisitos/cobertura-datos-del-comprobante.md` y su referencia de glosario con los 99 escenarios de las deltas (57 de `preparacion-y-seguimiento-fiscal`, 26 de `configuracion-operativa-y-fiscal`, 10 de `servicios-aplicados-al-mantenimiento` y 6 de `operacion-artesanal-de-servicios`), con columnas para prueba y resultado, y marcar los que se copiaron sin cambios como regresión. Cierre: los cuatro conteos coinciden con `grep -c "^#### Scenario"`.
- [x] 1.3 Identificar las fixtures reutilizables de `backend/tests/fiscal`, `tests/workshop_configuration` y `tests/workshop`, y anotar qué pruebas existentes afirman lo contrario de las specs nuevas (por ejemplo, rechazo del plazo, correo opcional, leyenda de Negocio Popular ausente). Cierre: lista anotada en la cobertura, para actualizar esas pruebas en su grupo sin borrarlas a ciegas.

Criterio de grupo: registro comprobado y cobertura pendiente trazable; `openspec validate alinear-datos-del-comprobante-con-sri --strict` pasa.

## 2. Perfil del emisor

Cubre diseño 1, 2 y 3; requisito «Perfil fiscal adicional sin alterar la configuración operativa».

- [x] 2.1 Probar y actualizar en `backend/src/workshop_configuration/domain/electronic_profile.py` los formatos de `withholding_agent` (`[1-9][0-9]{0,7}`) y `special_taxpayer` (3 a 13). Pruebas con «Resolución de agente de retención con formato inválido» y «Contribuyente especial demasiado corto». Cierre: mensajes actualizados y sin correcciones silenciosas.
- [x] 2.2 Probar y añadir la condición `large_taxpayer` a `CONDITION_KEYS`, `_closed_value`, `build_tax_profile` (`large_taxpayer_resolution`) y `CONDITION_LABELS`, sin cambiar `CURRENT_CONDITIONS_FORMAT`. Pruebas con «Gran contribuyente declarado» y «Gran contribuyente sin número». Cierre: el número se omite del perfil cuando no aplica.
- [x] 2.3 Probar y convertir `regime_legend` en un mapa por régimen, corrigiendo el comentario de `RIMPE_LEGEND`. Pruebas con «Leyenda derivada de Negocio Popular», «Leyenda derivada del régimen» y «Perfil real del taller». Cierre: *General* sigue sin leyenda.
- [x] 2.4 Crear `read_stored_conditions`, que nunca lanza excepción y devuelve condiciones y claves inválidas. Usarla en `evaluate_electronic_status` y en `workshop_configuration/application/home_summary.py`, con la causa `conditions.<clave>.invalid_format`. Prueba de regresión: un valor guardado `00012` o `A1` no rompe el estado ni la lectura de inicio. Cierre: «Valor guardado que ya no cumple el formato» en verde.
- [x] 2.5 Probar «Revisión anterior sin gran contribuyente» y «Ventas durante el perfil por completar»: el perfil pide solo esa condición, conserva las demás y las operaciones internas siguen. Cierre: ninguna revisión existente se reescribe.
- [x] 2.6 Hacer que `_configuration_message` en `fiscal/application/impediment_messages.py` nombre la condición afectada con `CONDITION_LABELS`. Cierre: el impedimento de preparación identifica gran contribuyente o el valor inválido, dirigido al Administrador.
- [x] 2.7 Cubrir permisos y API del perfil: el Administrador guarda `large_taxpayer`, y Vendedor y Encargado siguen denegados. Cierre: `backend/tests/workshop_configuration` en verde.

Dependencias: grupo 1. Evidencia: `uv run --frozen pytest tests/workshop_configuration/ tests/fiscal/test_configuration_api.py`, con rojo y verde anotados en la cobertura.

## 3. Taller: detalle de servicio

Cubre diseño 8; requisitos «Detalle de servicio en la línea» y «Detalle de servicio conservado en la operación».

- [x] 3.1 Probar en `backend/tests/workshop/test_models.py` y crear `detail` (300 caracteres, vacío por defecto) en `ServiceLine` y `ServiceOperationLine`, con la migración `backend/src/workshop/migrations/0007_*`. Cierre: `python manage.py makemigrations --check --dry-run` sin cambios y prueba de migración con líneas existentes, que quedan vacías.
- [x] 3.2 Probar y ampliar `parse_line_create` y `parse_line_update` en `workshop/domain/input.py`: ausente sin cambio, vacío para quitar, límite de 300 y sin saltos de línea. Cierre: «Detalle excedido o con saltos de línea» en verde, sin recortar.
- [x] 3.3 Probar y ampliar `add_line` y `update_line` en `workshop/application/service_lines.py` y sus serializadores. Pruebas con «Agregar una línea con detalle», «Línea sin detalle», «Escribir el detalle después», «Línea documentada», «Orden finalizada», «Servicio repetido», «Catálogo sin cambios», «Edición simultánea» y «Vendedor intenta escribir el detalle». Cierre: el total no cambia y la auditoría registra el campo, no el texto.
- [x] 3.4 Añadir `detail` a `DocumentableLine` y a `review_digest` en `workshop/domain/service_operation.py`, copiarlo al crear `ServiceOperationLine` y mostrarlo en `_line_view` y en la lectura de la operación. Pruebas con «Confirmar conserva el detalle», «Detalle cambiado después de revisar», «Intento de cambiar una línea documentada», «Volver a documentar después de anular» y «Operación anterior». Cierre: el documento anulado conserva su texto.

Dependencias: grupo 1. Evidencia: `uv run --frozen pytest tests/workshop/ -k "line or operation or migration or boundaries"`.

## 4. Fuentes fiscales

Cubre diseño 6 y la parte de fuente del diseño 8.

- [x] 4.1 Probar y añadir `pending_balance` a `CommercialFiscalSource` en `sales/application/fiscal_source.py`, desde `ledger_for`. Pruebas: sin cobros, con abono, con retención y con devolución. Cierre: coincide con el saldo de la venta.
- [x] 4.2 Probar y añadir `pending_balance` y `detail` de línea a `workshop/application/fiscal_source.py`, desde `balance_of`. Cierre: `backend/tests/workshop/test_fiscal_source.py` en verde.
- [x] 4.3 Comprobar que `fiscal` sigue sin importar modelos de ventas ni de taller. Cierre: `backend/tests/fiscal/test_boundaries.py` en verde.

Dependencias: grupos 1 y 3. Evidencia: `uv run --frozen pytest tests/sales/ tests/workshop/test_fiscal_source.py tests/fiscal/test_boundaries.py -k "fiscal or boundaries"`.

## 5. Dominio fiscal: reglas puras

Cubre diseño 5, 7 y 10.

- [x] 5.1 Probar y añadir `requires_email` a `FiscalReceiver` en `fiscal/domain/receiver.py`. Cierre: `parse_receiver` sigue aceptando un borrador sin correo, y `07` no lo exige.
- [x] 5.2 Crear `fiscal/domain/payment_term.py` con `term_required`, `parse_term_days` y `forms_with_term`, y sus pruebas en `backend/tests/fiscal/test_payment_term.py`. Casos: entero de 1 a 9999; rechazo de 0, −1, 1,5, 10000, booleanos y texto; y formas ya cobradas sin plazo. Cierre: una prueba comprueba que con saldo pendiente siempre queda al menos una forma con plazo.
- [x] 5.3 Crear `fiscal/domain/additional_info.py` y `backend/tests/fiscal/test_additional_info.py`: forma `{name, value}`, longitud, una sola línea, máximo 12, nombres únicos y reservados con `casefold`. Cierre: «Nombre reservado», «Más pares de los admitidos», «Nombre repetido» y «Valor excedido» en verde.

Dependencias: grupo 1. Evidencia: `uv run --frozen pytest tests/fiscal/test_receiver.py tests/fiscal/test_payment_term.py tests/fiscal/test_additional_info.py`.

## 6. Borrador, instantánea y API fiscal

Cubre diseño 4, 5, 7, 9, 10 y 11; los cuatro requisitos modificados y los tres añadidos de `preparacion-y-seguimiento-fiscal`.

- [ ] 6.1 Probar y subir `SNAPSHOT_FORMAT` a 4 con `trade_name` y `establishment_address`: `FiscalConfiguration`, `_issuer_dict` y `REQUIRED_ISSUER_FIELDS`. Pruebas con «Nombre comercial y dirección del establecimiento», «Entidad sin nombre comercial», «Emisor RIMPE Negocio Popular» y «Emisor gran contribuyente». Cierre: `identity.py` funciona sin cambios y los formatos 1 a 3 se leen intactos.
- [ ] 6.2 Probar y exigir el correo en `assemble_snapshot` y `_missing_receiver_fields`, con impedimento `receiver.email` de audiencia `OPERATOR`. Pruebas con «Receptor identificado sin correo», «Correo completado en la preparación», «Guardar un borrador sin correo», «Consumidor final sin correo», «Operación de un cliente sin correo», «Preparación completada antes de exigir el correo» y «Receptor sin correo». Cierre: la ficha del cliente no cambia.
- [ ] 6.3 Probar y aceptar `payments.term_days` en `update_draft` y `_check_draft_fields`, con `DraftValidationError` traducida a `validation_error` en `fiscal/api/views.py`. Cierre: «Plazo inválido», «Unidad enviada por el usuario», «Crédito ya saldado», «Contado pendiente de cobro» e «Intento de enviar plazo» rechazan sin modificar el borrador.
- [ ] 6.4 Probar y aplicar el plazo en `assemble_snapshot`, con `term_required` y `term_days` en la respuesta de trabajo. Pruebas con «Crédito sin cobros», «Crédito sin plazo declarado», «Abono parcial», «Crédito saldado con una retención recibida», «Cobro que salda antes de completar», «Cobro posterior a completar» y «Borrador anterior con plazo antiguo». Cierre: el diccionario de cada forma omite las claves nulas.
- [ ] 6.5 Probar «Sin efecto en la cobranza»: con un plazo vencido no cambian saldo, estado de pago, cuentas por cobrar ni el resumen de inicio. Cierre: comparación antes y después en comercial y artesanal.
- [ ] 6.6 Probar y validar el detalle adicional en `update_draft` y en `assemble_snapshot`, retirando el límite de 15 del serializador. Pruebas con «Agregar detalle adicional», «Preparación sin detalle adicional», «Preparación completada» y «Borrador anterior fuera de las reglas». Cierre: los pares inválidos no se recortan ni se eliminan.
- [ ] 6.7 Probar y añadir `service_details`: precarga en `initial_draft` y `normalized_draft`, edición en `update_draft`, y `service_detail` en la instantánea. Subir `DRAFT_FORMAT` a 3 y usar la constante en `update_draft`. Pruebas con «Detalle precargado», «Ajuste sin efecto en la operación», «Línea sin detalle», «Detalle excedido», «Línea de venta comercial» y «Reemplazo de una preparación cancelada». Cierre: nada escribe en `workshop`.
- [ ] 6.8 Actualizar los serializadores de `fiscal/api/serializers.py` y `workshop/api/serializers.py`, documentar con `extend_schema` y regenerar `backend/schema.yml`. Cierre: `backend/tests/fiscal/test_openapi.py` y `backend/tests/workshop/test_openapi.py` en verde.

Dependencias: grupos 2, 4 y 5. Evidencia: `uv run --frozen pytest tests/fiscal/ tests/workshop/test_fiscal_preparation.py`, más `uv run --frozen ruff check`, `uv run --frozen ruff format --check` y `uv run --frozen mypy src tests` sobre lo tocado.

## 7. Frontend: perfil del emisor

Cubre diseño 12; UI-019.

- [ ] 7.1 Actualizar los tipos de `frontend/src/features/fiscal/types.ts` desde el contrato nuevo. Cierre: `npm run typecheck` en verde.
- [ ] 7.2 Probar y añadir gran contribuyente a `frontend/src/features/fiscal/configuration/ProfileConditionsSection.tsx`, con ayuda contextual, y mostrar la leyenda de Negocio Popular como dato de solo lectura. Cierre: `ProfileConditionsSection.test.tsx` cubre *Aplica*, *No aplica* y el estado *Falta completar*.

Dependencias: grupo 6. Evidencia: `npm run test -- src/features/fiscal`.

## 8. Frontend: taller

Cubre diseño 12; UI-072 y UI-077.

- [ ] 8.1 Probar y añadir el detalle al modal y a la lista de `frontend/src/features/maintenance/ServiceLines.tsx`, con el error del servidor mostrado en el campo. Cierre: una línea documentada no ofrece editarlo.
- [ ] 8.2 Mostrar el detalle en `BillingDialogs.tsx`, `ServiceOperationDetailPage.tsx` y `ServiceOperationDocumentPage.tsx`, sin espacio vacío si no hay. Cierre: «Comprobante interno con detalle» en verde.

Dependencias: grupo 6. Evidencia: `npm run test -- src/features/maintenance src/pages/maintenance`.

## 9. Frontend: preparación fiscal

Cubre diseño 12; UI-059.

- [ ] 9.1 Probar en `frontend/src/pages/fiscal/FiscalPreparationPage.tsx` que el correo deja de ser opcional para un receptor identificado y sigue sin exigirse a consumidor final. Cierre: el impedimento se muestra en su campo.
- [ ] 9.2 Probar y añadir el campo de plazo, visible solo con `term_required`, junto a las formas de pago y con el error del servidor en el campo. Cierre: contado y crédito saldado no lo muestran.
- [ ] 9.3 Probar y añadir la sección de detalle adicional con filas y modal, y un recordatorio breve de incluir solo lo necesario para el comprobante. Cierre: agregar, editar y quitar pares, y un nombre reservado muestra el rechazo del servidor.
- [ ] 9.4 Probar y añadir el ajuste del detalle por línea en preparaciones artesanales. Cierre: la preparación comercial no lo ofrece.
- [ ] 9.5 Mostrar en una preparación completada el plazo, los pares, los detalles, el nombre comercial, la dirección del establecimiento y el gran contribuyente, solo cuando existan. Cierre: una instantánea de formato 3 se muestra sin campos vacíos, y `terminology.test-utils.ts` sigue en verde.

Dependencias: grupo 6. Evidencia: `npm run test -- src/pages/fiscal src/features/fiscal`, más `npm run typecheck`, `npm run lint` y `npm run format:check`.

## 10. Recorrido completo

- [ ] 10.1 Ampliar `frontend/e2e/fiscal.spec.ts`: el Encargado escribe un detalle en el mantenimiento, confirma a crédito, prepara con plazo y correo, y comprueba la instantánea. Cierre: Playwright en verde.
- [ ] 10.2 Revisar la preparación a 390 px y a pantalla completa con el sistema visual Tallkit. Cierre: capturas referenciadas en la cobertura; la revisión humana queda anotada como pendiente.

Dependencias: grupos 7, 8 y 9. Evidencia: `npx playwright test e2e/fiscal.spec.ts e2e/maintenance-billing.spec.ts`.

## 11. Documentación, trazabilidad y cierre

- [ ] 11.1 Registrar `DP-035` en `docs/negocio/decisiones/decisiones-confirmadas.yaml`, con sus cinco reglas y las notas de ajuste en `DP-003`, `DP-027` y `DP-031`.
- [ ] 11.2 Actualizar `reglas-negocio.md` (`RN-VEN-008`, `RN-CLI-003` y reglas nuevas), `requisitos-funcionales.md` (`RF-FIS-007`, `RF-PAG-012` y requisitos nuevos), `casos-de-uso.md`, `interfaz-y-navegacion.md` (UI-019, UI-059, UI-072, UI-077) y `docs/arquitectura/modelo-dominio.md`.
- [ ] 11.3 Actualizar `docs/tecnico/matriz-instantanea-fiscal.md`: formato 4, `nombreComercial`, `dirEstablecimiento`, `plazo`, `unidadTiempo`, `detAdicional`, leyenda de Negocio Popular y `placa` como no aplicable, con el Anexo 25 como respaldo.
- [ ] 11.4 Agregar a `matriz-normas-facturacion-electronica.md` las filas `NOR-019` (plazo, Requiere validación externa), `NOR-020` (contradicción de la ficha con el XSD, Pendiente) y `NOR-021` (límites de campos, Verificada), la validación `V-6` y el cambio responsable de `NOR-018`.
- [ ] 11.5 Actualizar `docs/cambios-pendientes.md`: salida de cada choque, ambiente al cambio 3, `RUC Proveedor` al cambio 4, redondeo a validaciones externas, preparaciones anteriores en el cambio 3, nota corregida del cambio 1 y casillas de este cambio.
- [ ] 11.6 Incorporar a `docs/negocio/producto/glosario.md` plazo del comprobante, gran contribuyente, detalle adicional y detalle de servicio, y actualizar las referencias de glosario de cada documento tocado.
- [ ] 11.7 Actualizar `matriz-trazabilidad.md` y `cobertura-modulo-fiscal.md`, y completar `cobertura-datos-del-comprobante.md` con la prueba y el resultado real de los 99 escenarios.
- [ ] 11.8 Ejecutar la verificación de cierre: pruebas focalizadas de los grupos 2 a 10, `uv run --frozen ruff format --check .`, `uv run --frozen ruff check .`, `uv run --frozen mypy src tests`, `uv run --frozen python manage.py makemigrations --check --dry-run`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` y `openspec validate alinear-datos-del-comprobante-con-sri --strict`. Cierre: comandos y resultados reales registrados, indicando lo que no se ejecutó.

Dependencias: grupos 2 a 10. Criterio de grupo: documentación sincronizada, cobertura completa y verificación registrada. Estas tareas no autorizan commits, ramas, merges ni el archivado del cambio fuera de los que el usuario solicite.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
