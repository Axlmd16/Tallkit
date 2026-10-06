## Context

La propuesta está aprobada y registrada en `master` en `d166ec7`; las specs fueron aprobadas por «gestionar-proformas-comerciales, haz commit y continua» y registradas en `d23996e`. Este diseño desarrolla las capacidades `proformas-comerciales` y `ventas-comerciales`; no implementa código ni altera las specs aprobadas.

Se consultaron las decisiones confirmadas y el modelo conceptual completos durante este cambio, la propuesta, ambas specs y sus referencias terminológicas; las specs principales de ventas, modelo de dominio y numeración; producto, RN-PRO-001…008, RF-PRO-001…011, CU-010/011, UI-050…052 y RNF-INT/SEG/USA aplicables. Se revisaron arquitectura inicial y ADR-0004/0006/0008/0009. Las brechas de precios editables y edición de ofertas vigentes se resuelven con la propuesta; los textos antiguos de ingresos y saldos quedan fuera del cambio.

Evidencia del código inspeccionado:

- `backend/src/sales/models.py`: origen limitado a DIRECT/MAINTENANCE, restricciones de coherencia, instantáneas versionadas y protección de relaciones.
- `sales/application/commands.py`: autorización anterior al replay, recibo por actor/acción/clave, huella de entrada, auditoría transaccional y de rechazos.
- `sales/application/workshop_links.py`: interfaz que escribe solo persistencia de ventas dentro de la transacción exterior del consumidor; no reclama otro recibo.
- `sales/application/sales.py`, `reviews.py`, `queries.py` y `domain/draft_input.py`: borradores, bloqueo de venta antes de referencias, revisión firmada de 15 minutos y rechazo de precios manuales.
- `shared/money.py`, `shared/command_values.py` y `shared/transactions.py`: cálculo puro compartido, huellas y traducción de conflictos después de rollback.
- `workshop_configuration/application/operation_context.py`, `configuration_resolver.py` y `numbering.py`: contexto comercial, tarifas, usos históricos y numeración dentro de una transacción exterior.
- `inventory/application/queries.py` y `reservations.py`: disponibilidad como existencia menos reserva; solo se necesitan lecturas para cotizar.
- `frontend/src/features/sales/SalesDocument.tsx` reutiliza `DocumentSheet`, pero consulta el logo actual con `useIssuerBrand`. `workshop_configuration/application/logo_storage.py` guarda logos privados reemplazables, con limpieza de huérfanos. Ninguna referencia a ese archivo actual basta para congelar la imagen.
- `backend/tests/sales/test_boundaries.py`: controles explícitos de importaciones y propiedad de persistencia. `frontend/src/app/App.tsx`, `navigation.ts`, `sales/api/urls.py`, `Makefile` y `frontend/package.json`: composición y verificaciones actuales.

## Goals / Non-Goals

**Goals:** implementar ofertas comerciales sin efectos de inventario o cobranza, historia emitida reproducible, vigencia calculada, emisión numerada segura y conversión única con venta editable. Mantener el monolito modular y demostrar permisos, atomicidad y concurrencia mediante TDD.

**Non-Goals:** proformas artesanales, presupuestos de mantenimiento, reservas, precios negociados, varias ventas por oferta, PDF en servidor, mensajería, facturación electrónica, cambios de medios de pago, nuevas dependencias o refactorización general de ventas. No se crea ni modifica `modelo-datos.md` antes de aprobar el diseño.

## Decisions

### D1. Módulo propietario y dependencia unidireccional

Crear `backend/src/proformas/` con `domain`, `application`, `api`, modelos y migraciones propios. La **proforma** es una raíz distinta de la venta: nunca participa en saldos, pagos o Kardex. Reutilizar `shared.money` para importes, sin importar el dominio interno de ventas ni duplicar fórmulas.

La dependencia será `proformas → sales.application.proforma_links → interfaces existentes`. La nueva interfaz de ventas acepta un DTO inmutable con identidad, número, cliente, líneas y valores cotizados; crea exclusivamente su propia venta y devuelve un DTO de resultado. Requiere transacción exterior y permisos comerciales comprobados; no confirma, numera, reserva ni cobra. No llama al comando HTTP ordinario de crear venta ni abre una unidad de idempotencia independiente.

Ventas guarda una referencia de integridad a proforma por nombre diferido, sin importar sus modelos ni consultar su relación ORM. Conserva además una copia versionada de la oferta necesaria para comparar valores, de modo que sus consultas y confirmaciones no llaman al módulo de proformas. Proformas consulta la venta mediante la interfaz pública, nunca modificando `Sale` directamente. Extender las pruebas de frontera para permitir solo ese contrato y prohibir la dependencia inversa de código.

Alternativas descartadas: usar `Sale` como cotización mezcla ciclos y consumidores económicos; llamadas HTTP internas rompen la unidad transaccional; imports bidireccionales complican bloqueos y propiedad. Se propone ADR-0012 para esta frontera y la conservación de la identidad visual histórica.

### D2. Persistencia propuesta y estado efectivo

Los siguientes nombres son nuevos y propuestos, no archivos o tablas ya existentes:

| Elemento | Responsabilidad y restricciones |
|---|---|
| `Proforma` | Identidad, cliente protegido, entidad comercial, versión, fechas, estado persistido DRAFT/ISSUED/CONVERTED/VOIDED, número nullable único, autor y momentos, origen opcional a otra proforma con PROTECT, huella aplicada y cabecera histórica versionada. |
| `ProformaLine` | Orden, producto protegido, cantidad decimal de valor entero positivo; instantáneas de producto, precio final, tarifa, base, impuesto, total y disponibilidad al emitir. Restricción única por documento/posición. |
| `ProformaCommand` | Actor, acción, clave, huella, resultado y estado de respuesta; unicidad por actor/acción/clave, siguiendo el patrón existente. |
| `ProformaBrandAsset` | Bytes del logo ya normalizado, MIME, tamaño y hash; contenido inmutable y deduplicado por hash, perteneciente a proformas. Referencia protegida desde la oferta emitida. |
| Extensión de `Sale` | Origen PROFORMA, referencia única nullable `origin_proforma`, número de origen y copia inmutable `proforma_snapshot` sin costos ni bytes del logo. |

No duplicar `sale_id` en la proforma: la referencia única de ventas es la fuente del vínculo; `proforma_links` ofrece su consulta por oferta. Su estado CONVERTED se escribe en la misma transacción. Un conciliador de solo lectura verifica ambos hechos sin repararlos automáticamente.

Las restricciones de venta mantienen: DIRECT sin orden ni proforma; MAINTENANCE con orden y sin proforma; PROFORMA con proforma y sin orden, referencia e instantánea obligatorias. No se modifica la unicidad del borrador abierto de mantenimiento. La identidad de origen, su número y copia quedan protegidos incluso durante edición de un borrador de venta.

VIGENTE/VENCIDA son proyecciones de ISSUED y `valid_until` respecto del día local; no hay tarea periódica ni escritura al consultar. CONVERTED y VOIDED tienen precedencia. El filtro de lista usa la misma fecha local que la proyección. Instantes se guardan con zona uniforme y se presentan en America/Guayaquil; la vigencia es fecha de calendario inclusiva.

El borrador conserva fecha explícita o modo de vigencia predeterminada; en este último caso la revisión propone fecha de emisión + 7 días. Un cambio de día invalida la revisión y vuelve a mostrar las fechas, sin alterar silenciosamente una fecha explícita. El dominio puro recibe el reloj como dato para probar límites sin depender de esperas reales.

Alternativa descartada: persistir VENCIDA con cron introduciría estados obsoletos. No almacenar pagos, saldo ni condiciones de venta en proformas.

### D3. Revisión, cálculo e historia

`proformas/domain/` valida cantidades, fechas, transiciones e invariantes y usa `shared.money` con Decimal y HALF_UP. No depende de Django, DRF, HTTP o modelos. Aplicación reúne referencias mediante los contratos públicos existentes de clientes, productos, inventario y configuración; una selección sin tarifa es impedimento, no cero.

`draft-preview` y `issue-preview` son lecturas sin recibos, números ni usos históricos. La segunda entrega token firmado propio, con sal y acción de proformas, actor, documento, versión y huella; adoptar los 15 minutos del patrón de ventas. La huella incluye fecha efectiva, vigencia, líneas, precios, impuestos y datos históricos del emisor/cliente/productos. Disponibilidad se reconsulta al emitir, siempre informativa: sus cambios actualizan el aviso y la instantánea, sin convertirse en condición de stock mínimo.

Emisión revalida bajo bloqueo y guarda instantáneas `schema_version=1`; un cambio de contenido relevante requiere revisión nueva. El identificador y huella de la revisión aplicada permiten reconocer reemisión compatible aun con otra clave y sin depender de la vigencia actual del token. La autorización se revalida siempre. Cambios de datos maestros posteriores no recalculan la oferta emitida.

La copia produce otro borrador con nuevo intento lógico y referencia de origen. Conserva los productos copiados aunque alguno esté inactivo para mostrar la corrección necesaria; antes de emitir se exige sustituirlo o retirarlo. La oferta original nunca se reactiva.

### D4. Logo y documento histórico

Añadir a configuración una interfaz pública estrecha de lectura de marca para consumidores internos autorizados. Devuelve DTO con identidad, versión/hash y bytes normalizados del logo vigente, o ausencia explícita; no expone su ruta de almacenamiento ni exige permiso administrativo de configuración al Vendedor.

Preparar los bytes antes de la sección crítica. Durante emisión, bajo bloqueo del emisor, verificar que la identidad/hash de marca sigue siendo la revisada; si cambió, pedir nueva revisión. La interfaz de configuración debe comprobar esta versión sin ejecutar renderizado ni decodificación bajo bloqueo. Los bytes normalizados se insertan en `ProformaBrandAsset` en la misma transacción que la oferta; si falla se revierte todo. Respetar el límite existente de 2 MiB y formatos admitidos, sin nueva carga de imágenes desde proformas. Distinguir ausencia voluntaria de logo de archivo configurado pero ilegible: el segundo es un error corregible, no una omisión silenciosa.

El endpoint protegido del documento sirve la marca histórica y nunca `useIssuerBrand` para una oferta emitida. No hay logo remoto, URL pública o archivo temporal por cada impresión; cambios y purga de logos de configuración no afectan esa copia. Se acepta crecimiento acotado de PostgreSQL, reducido por deduplicación. Una oferta emitida sin logo conserva esa ausencia aunque se configure uno después.

### D5. Transacciones, idempotencia y orden de bloqueos

Toda escritura usa recibo de proformas y una **transacción atómica** exterior; autorización y protección CSRF preceden al replay. Huella canónica distingue mismo intento de contenido incompatible. Los conflictos transitorios se traducen tras rollback completo con `shared.transactions`; se reintenta la unidad completa con su identidad, nunca un fragmento.

Orden para emisión: recibo → proforma → cliente → productos ordenados por ID → lectura informativa de disponibilidad → contexto comercial/configuración → numeración → instantáneas y auditoría. Configuración conserva su orden real entidad → bodega → impuestos/períodos → ámbito → serie. La lectura de disponibilidad no adquiere bloqueos de posiciones después de configuración; no se invocan operaciones de reserva o publicación. Registrar el instante de esa observación, no prometer stock al commit.

Orden para conversión: recibo → proforma → raíz de venta nueva o consulta de vínculo → cliente → productos ordenados → disponibilidad informativa → configuración → inserciones y auditoría. El contrato de ventas crea la raíz en esta transacción y expone la validación/cálculo necesario sin reclamar recibos adicionales. Proformas no bloquea cliente antes de entrar en una función que bloquee una venta existente. La unicidad de `origin_proforma` es defensa final, además del bloqueo de oferta.

Capturar la fecha de conversión después de las esperas de bloqueo relevantes y comprobar de nuevo la vigencia inmediatamente antes de publicar el resultado. Anular toma la misma raíz: si ganó anulación se rechaza conversión; si ganó conversión se rechaza anulación. Un replay compatible recupera una conversión ya terminada aunque la fecha haya pasado. Una clave nueva sobre oferta convertida informa el conflicto y referencia existente, sin crear otra venta.

Emisión usa `resolve_configuration` para registrar usos históricos y `allocate_number` con tipo documental de proforma, identidad estable y clave interna `proforma:<id>:issue`; el ámbito resuelto aporta la serie, sin fijarla permanentemente a COM-PRO. Reemisión no asigna otro número. Fallos revierten contador, uso, instantánea, vínculo y auditoría exitosa. Los rechazos auditables se registran después del rollback sin datos personales innecesarios.

No introducir el orden inverso venta → proforma en confirmación, cobro o correcciones: ventas usa su copia inmutable. Se preservan los órdenes de ADR-0004/0006/0009 para consumidores existentes. Pruebas de concurrencia con PostgreSQL demostrarán la ausencia de duplicados y efectos parciales.

### D6. Integración con ventas y comparación

`proforma_links.create_draft_from_proforma` recibe oferta validada y cliente/líneas, crea origen PROFORMA y condición inicial CONTADO como valor operativo editable ya usado por ventas; no es una condición de la oferta. La persona revisa contado/crédito en el flujo ordinario antes de confirmar. No hay reserva ni número de venta al convertir.

Adaptar `sales/application/queries.py`, `reads.py`, `reviews.py`, serializers y tipos frontend para `origin.proforma_id`, `origin.proforma_number` y comparación calculada en servidor entre copia cotizada y borrador actual. Mantener las claves de orden para compatibilidad y dejarlas nulas en origen proforma. Agrupar comparación por producto, sumando cantidades y valores históricos de líneas repetidas; separar líneas retiradas/agregadas, cambios de cantidad, precio y tarifa y totales de ambos documentos. La huella de revisión de ventas cubre origen y cambios relevantes, sin aceptar precios o impuestos enviados por el cliente.

Se conservan permisos comerciales, cálculo, confirmación atómica, cobros, retenciones y correcciones existentes. Quitar todas las líneas no borra el vínculo ni habilita otra conversión. Vencer la oferta después de convertir no bloquea confirmar la venta. El API ordinario rechaza cualquier intento de fijar o modificar el origen; este solo nace por el contrato de conversión.

### D7. API y seguridad

Rutas propuestas bajo `/api/v1/proformas/`, compuestas en la configuración API existente. Usar autenticación de sesión, CSRF, errores `application/problem+json` y `X-Request-ID` actuales, sin CORS adicional ni JWT.

| Operación | Contrato propuesto |
|---|---|
| `GET /`, `GET /{id}/` | Paginación estable, búsqueda por número/cliente, filtro por estado efectivo; valores y acciones permitidas sin costos. |
| `POST /`, `PATCH /{id}/` | Cliente, productos/cantidades, vigencia; `idempotency_key` y versión para edición. Campos económicos y desconocidos rechazados. |
| `POST /draft-preview/`, `GET /{id}/issue-preview/` | Lecturas sin efectos; cálculo y revisión previa. |
| `POST /{id}/issue/` | Clave, versión y token; devuelve documento emitido o resultado compatible. |
| `POST /{id}/void/`, `POST /{id}/copy/` | Anulación explícita o nuevo borrador vinculado; clave y versión donde corresponda. |
| `GET /{id}/conversion-preview/`, `POST /{id}/convert/` | Diferencias actuales y conversión atómica; revisión firmada y versión. |
| `GET /{id}/document/`, `GET /{id}/document/logo/` | Datos y bytes históricos autorizados; no genera PDF. |
| `GET /customer-options/`, `GET /product-options/` | Opciones autorizadas a proformas mediante DTO públicos existentes, sin reutilizar permisos HTTP de otra capacidad. |

Decimales viajan como cadenas; fechas ISO y estados separados de etiquetas. Documento devuelve disponibilidad emitida con su fecha y, fuera del cuerpo histórico, disponibilidad actual. Los errores distinguen referencia inactiva, revisión vencida/cambiada, versión obsoleta, oferta vencida/anulada/convertida y configuración ausente. Insuficiencia de disponibilidad es aviso al cotizar/convertir y error únicamente al confirmar venta.

Publicar OpenAPI con ejemplos y respuestas de conflicto. Consultar por ID o descargar logo exige permiso incluso tras invalidar sesión. Los recibos conservan identidad del resultado, no respuestas con datos sensibles que evadan una autorización posterior. La interfaz recupera un resultado incierto repitiendo el mismo intento, sin fabricar otra clave.

### D8. Frontend y experiencia

Crear `frontend/src/features/proformas/` para API, tipos, hooks, revisión y documento, y `frontend/src/pages/proformas/` para lista, editor, detalle e impresión. Registrar rutas y navegación en `app/App.tsx` y `app/navigation.ts`, con guards existentes. Reutilizar componentes de formularios, selectores accesibles y `shared/ui/business/DocumentSheet`; no arrastrar la condición de venta o acciones fiscales de `SalesDocument` a la cotización.

El editor presenta cliente, vigencia, cantidades, precio no editable y disponibilidad; los totales siempre vienen del backend. Mantener captura tras error, advertir salida con cambios y señalar revisiones obsoletas. El detalle de emitida ofrece copiar, imprimir, convertir o anular según estado; muestra oferta anterior/nuevas y venta generada. La comparación aparece al convertir y en la revisión de venta.

La impresión usa emisor y logo históricos, espera carga de fuentes/imagen antes de habilitar imprimir y mantiene encabezados, filas y totales legibles en varias páginas A4. Guardar PDF es la función del navegador, sin nueva biblioteca. Validar teclado, ancho 360 px, contraste y estados mediante texto. Invalidar cachés de ofertas y ventas tras conversión y limpiar datos al cerrar sesión usando el patrón existente. No decidir permisos, estados definitivos o cálculo monetario en React.

## Risks / Trade-offs

- Dependencia circular por lectura de oferta desde ventas → copia histórica de valores en la venta y contrato público unidireccional; pruebas AST de frontera y no escrituras ajenas.
- Duplicidad entre vínculo único y estado convertida → misma transacción y consulta de conciliación; restricción única, sin reparación silenciosa.
- Cambio de día o datos mientras se espera bloqueo → reloj y revisión revalidados antes de publicar; escenarios con reloj controlado y conexiones independientes.
- Crecimiento por logos → bytes normalizados limitados y deduplicados; incluidos en respaldo PostgreSQL. No copiar bytes a cada venta.
- Contención sobre configuración y secuenciales → transacciones cortas sin red ni renderizado; seguir ADR-0004, sin bloqueo global adicional.
- Nuevas ofertas confundidas con revisión de la misma → números diferentes y enlaces explícitos; la oferta original sigue intacta.
- Endpoint de marca actual usado por accidente → pruebas de cambio/eliminación del logo después de emitir y comprobación del documento histórico.

## Migration Plan

1. Tras aprobación de diseño y tasks, crear migraciones aditivas de `proformas` y registrar la app. No poblar ofertas a partir de ventas anteriores.
2. Añadir a ventas campos nullable de origen proforma y copia histórica, ampliar choices/checks e índices; conservar sin cambios DIRECT/MAINTENANCE y sus números. La migración inicial de proformas no referencia ventas; la de ventas depende de esa inicial, evitando ciclos de migraciones.
3. Aplicar restricciones de historia y no borrado siguiendo las protecciones de ventas: contenido emitido y marca inmutables, transición controlada, referencias PROTECT. Cubrir escrituras directas y operaciones bulk en pruebas, además de servicios.
4. Verificar permisos existentes de proformas en identidad; completar el mapa fijo si falta alguna acción, sin crear roles o permisos personalizados. Habilitar rutas después de migrar y desplegar backend/frontend compatibles.
5. Documentar datos y fronteras aprobados en `modelo-datos.md`, arquitectura, trazabilidad, glosarios y fuentes afectadas durante apply; sincronizar specs principales al cierre conforme al flujo del proyecto. Aceptar ADR-0012 solo con aprobación explícita.
6. Antes de datos nuevos puede revertirse la migración probada. Después de emitir o convertir, no volver a un binario que desconozca PROFORMA ni borrar tablas: deshabilitar creación/conversión y corregir hacia adelante, conservando lectura e historia. Restauración de respaldo requiere ventana controlada y verificación de ventas posteriores; no se ejecuta automáticamente.

## Verification Strategy

TDD por escenario antes de implementación. Mantener una matriz de los 76 escenarios de specs hacia evidencia; no declarar cubierto un escenario por existir una prueba de nombre parecido.

| Grupo | Evidencia prevista |
|---|---|
| Dominio | Pruebas puras de importes, fechas inclusivas, transiciones, cantidades, comparación y ausencia de edición de precios. |
| Persistencia/API | Pruebas de instantáneas, logo histórico, restricciones, referencias inactivas, campos no admitidos, roles y sesión/CSRF; respuestas sin costos y contrato OpenAPI. |
| Transacciones | Inyección de fallo tras numerar, crear venta y auditar; verificar rollback del conjunto, reintento compatible y conflicto de huella. |
| Concurrencia PostgreSQL | Dos emisiones, reemisión, dos conversiones, conversión/anulación, edición/emisión, producto/tarifa cambiando y paso de día durante espera. Barreras explícitas, sin sleeps para ordenar resultados. |
| Ventas existentes | Orígenes directo y mantenimiento, reservas, cobros, correcciones, retenciones y conciliación; origen nuevo nunca adquiere reservas. |
| Frontend | Editor/revisión, errores recuperables, respuesta incierta, comparación, filtros, guards y limpieza de sesión. E2E crear → emitir → imprimir → convertir → ajustar → confirmar. |
| Visual/operación | A4 multipágina, emisor con/sin logo y logo reemplazado, 360 px, teclado; migración sobre datos previos y respaldo con activos históricos. |

Comandos oficiales en apply: `make check`, `make test`, `make audit`; las pruebas enfocadas de backend usan `uv run --frozen pytest` desde `backend` y las de frontend npm. E2E usa `npm run test:e2e` desde `frontend`. `make check` incluye formato, lint, tipos, comprobación de migraciones, pruebas, cobertura frontend, build y Compose. Verificar además cobertura backend conforme a su configuración vigente. Para esta fase documental: validación estricta OpenSpec, enlaces locales, encabezados, trazabilidad y whitespace; no se afirma implementación ni pruebas funcionales ejecutadas.

## Open Questions

No quedan decisiones de negocio bloqueantes: el usuario aprobó propuesta y specs. El diseño y ADR-0012 fueron aprobados el 2026-10-06 mediante «gestionar-proformas-comerciales, haz commit y continua», autorizando su registro en master y la creación de tasks. Esta aprobación no autoriza implementación. Los nombres nuevos y contratos aquí descritos se implementarán solo tras aprobación; los contratos existentes no se consideran automáticamente compatibles hasta cubrir sus pruebas de frontera. Tarifas reales y obligaciones externas siguen fuera del alcance.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
