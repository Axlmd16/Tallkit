## Context

La propuesta aprobada da a cada **entidad fiscal** un logotipo opcional que administra el Administrador. Las specs aprobadas fijan el comportamiento:

- `configuracion-operativa-y-fiscal`: validación, entrega privada, idempotencia, auditoría y consistencia;
- `organizacion-de-la-configuracion`: fila «Logo» y modal;
- `ventas-comerciales`, `operacion-artesanal-de-servicios` y PPF-09: encabezado del comprobante;
- `sistema-visual-frontend`: el logotipo de Tallkit es la marca del sistema, no del emisor.

Estado actual, verificado en el código:

- **Entidad fiscal.** `workshop_configuration.models.FiscalEntity` tiene los datos de identificación y un `version` para control optimista. El `PATCH` de `EntityDetailView` (`entidades_fiscales.editar`) lo exige como `expected_version`. `update_fiscal_entity` bloquea la fila con `select_for_update` y audita con `identity.application.audit.record_audit_event`.
- **Idempotencia de configuración.** `ConfigurationCommand` guarda un recibo por actor, acción y clave, con una huella canónica. `preparation_settings._command` muestra el uso vigente con `shared.command_values.canonical_fingerprint` y `validate_idempotency_key`.
- **Archivos privados.**
  - `workshop.application.photo_storage` implementa ADR-0007: Pillow, `FileSystemStorage` sobre `PRIVATE_MEDIA_ROOT`, nombres UUID y borrado ante fallos.
  - `purge_workshop_files` solo recorre el prefijo `maintenance/`.
  - Las vistas de fotos responden con `Cache-Control: private, no-store`, `nosniff` y `CSP default-src 'none'`.
  - Nginx admite 12 MiB en `/api/`.
- **Comprobantes.**
  - `frontend/src/shared/ui/business/DocumentSheet.tsx` pinta el isotipo `assets/brand/isotipo.svg` y «Tallkit» en el encabezado. Lo usan `features/sales/SalesDocument.tsx` (venta: editor y comprobante), `pages/maintenance/ServiceOperationDocumentPage.tsx` (servicios) y `features/purchases/PurchaseDocument.tsx` (vista previa del ingreso).
  - La venta y la operación artesanal ya reciben un `issuer` con `legal_name` y `ruc`.
  - El ingreso conserva `fiscal_snapshot.entity`, pero su vista previa no muestra emisor.
  - La impresión usa `window.print()` en `SaleDocumentPage` y `ServiceOperationDocumentPage`.
- **Ficha de entidad.** Está en `pages/workshop-configuration/sections/EntitiesSection.tsx`, con filas de consulta, `FormModal`, `ConfirmationPanel` y `Toast`.

Restricciones: monolito modular sin mutar datos de otros módulos (ADR-0001), sesiones y mismo origen (ADR-0003) y TDD. No se añaden dependencias: Pillow ya está incorporada.

## Goals / Non-Goals

**Goals:**

- Guardar como máximo un logotipo por entidad, validado por contenido, sin metadatos, en almacenamiento privado y con limpieza recuperable.
- Subir, reemplazar y quitar el logotipo mediante comandos idempotentes, auditados y serializados por entidad, sin interferir con la edición de los datos de la entidad.
- Entregar el logotipo a cualquier usuario autenticado y dar a los comprobantes una forma barata de saber si su emisor tiene logotipo.
- Encabezar la hoja del documento con la identidad del emisor, con reserva al nombre y una impresión que no salga con la imagen incompleta.

**Non-Goals:**

- Refactorizar `photo_storage` ni `purge_workshop_files`, que funcionan y quedan fuera del cambio.
- Versionar logotipos, recortar o editar imágenes, o usar logotipos en XML y documentos fiscales.
- Cambiar los permisos de consulta de ventas, operaciones o ingresos.
- Etiquetas de productos (`imprimir-etiquetas-de-productos`).

## Decisions

### D1 — Modelo propio `FiscalEntityLogo`, no columnas en `FiscalEntity`

Se crea `workshop_configuration.models.FiscalEntityLogo` con estos campos:

- `fiscal_entity`: `OneToOneField`, `PROTECT`;
- `storage_name`: único;
- `content_type`, `extension`, `size_bytes`, `width`, `height`;
- `sha256`: del archivo recibido;
- `revision`: entero creciente por entidad;
- `uploaded_by` y `uploaded_at`.

La fila existe solo mientras hay un logotipo vigente. Quitar el logotipo borra la fila y deja constancia en la auditoría.

- **Por qué:** si el logotipo viviera en `FiscalEntity`, cada carga incrementaría `version`, y un Administrador con el modal «Editar» abierto recibiría un conflicto de versión sin haber cambiado nada. La tabla aparte mantiene independientes las dos acciones. La unicidad de `fiscal_entity` impone «como máximo uno» en la base de datos.
- **Alternativa descartada:** columnas nulas en `FiscalEntity`. Es más simple, pero acopla el control optimista de dos formularios distintos.
- **`revision`** no versiona el logotipo, que no conserva historia. Solo invalida cachés del navegador (D5). Se calcula como la última revisión conocida de la entidad más uno. Para no reutilizar valores después de un retiro, se guarda en `FiscalEntity.logo_revision`, sin tocar `version`.

### D2 — Inspección y normalización propias del módulo de configuración

Se crea `workshop_configuration/application/logo_storage.py`, con constantes de dominio en `workshop_configuration/domain/logo_rules.py`: formatos `PNG`, `JPEG` y `WEBP`, `MAX_BYTES = 2 MiB` y `MAX_PIXELS = 25_000_000`. La inspección sigue el mismo orden que `photo_storage`:

1. rechazar por tamaño declarado y leer como máximo `MAX_BYTES + 1`;
2. abrir con `DecompressionBombWarning` convertido en error;
3. comprobar el formato real, los píxeles y que no sea animada, y aplicar `verify()`;
4. reabrir, `load()` y `exif_transpose`;
5. **volver a codificar** en el mismo formato, sin EXIF, XMP ni ICC salvo el perfil de color. PNG y WebP conservan el canal alfa, WebP sin pérdida. JPEG usa calidad 90.

- **Por qué:** volver a codificar cumple «sin metadatos incrustados» y además neutraliza contenido añadido al final del archivo o archivos políglotas, porque se sirve la imagen regenerada y nunca los bytes originales. SVG queda rechazado de forma natural: Pillow no lo identifica como ninguno de los formatos admitidos.
- **Alternativa descartada:** importar `workshop.application.photo_storage`. Haría depender la configuración del módulo de taller, que es el sentido inverso de las fronteras (ADR-0001), y sus límites, sus miniaturas y sus errores son otros.
- **Alternativa descartada:** extraer ahora un módulo común a `shared/`. Obligaría a tocar el código de fotografías, fuera del alcance. Queda anotado como consolidación futura en las consecuencias de ADR-0007.

Los archivos se guardan con prefijo `fiscal-logos/<entity_id>/<uuid>.<ext>` en la misma raíz `PRIVATE_MEDIA_ROOT`. El prefijo es distinto de `maintenance/`, así que ninguna limpieza toca archivos de la otra.

### D3 — Comandos serializados por entidad, con recibo e idempotencia

Se crea `workshop_configuration/application/entity_logos.py` con dos comandos: `upload_entity_logo(actor, entity_id, file, idempotency_key, request_id)` y `remove_entity_logo(actor, entity_id, idempotency_key, request_id)`.

**Carga:**

1. `require_permission("entidades_fiscales.editar")`. Una denegación se audita, como en `update_fiscal_entity`, y no escribe archivos.
2. Validar la clave. Si ya existe un recibo `(actor, "fiscal_entity.logo_upload", clave)`, comparar la huella `{entity_id, sha256}` y devolver el resultado guardado, o conflicto `idempotency_conflict`. No se escribe ningún archivo. Para calcular el `sha256` basta con leer el archivo, sin decodificarlo.
3. Inspeccionar y normalizar (D2). Un rechazo se audita con `fiscal_entity_logo_rejected` y el motivo, sin datos de la imagen.
4. Escribir el archivo nuevo fuera de la transacción.
5. Abrir la transacción:
   - `select_for_update` sobre `FiscalEntity`, que serializa cargas y retiros concurrentes de la misma entidad;
   - crear el recibo;
   - reemplazar o crear `FiscalEntityLogo` e incrementar `logo_revision`;
   - auditar `fiscal_entity_logo_uploaded` o `fiscal_entity_logo_replaced`;
   - registrar `transaction.on_commit` para borrar el archivo anterior.
6. Si la transacción falla, borrar el archivo nuevo y volver a lanzar el error.

**Retiro:** misma estructura, con huella `{entity_id}`. Sin logotipo, responde 200 con `logo: null`, guarda el recibo y no audita. Así se cumple «retiro repetido inocuo, sin eventos duplicados».

**Concurrencia:** dos cargas simultáneas escriben dos archivos. El bloqueo de fila las ordena, la segunda reemplaza a la primera y el archivo de la primera se borra en `on_commit`, o lo recoge la limpieza. El resultado es un solo registro vigente con su archivo completo.

**Alternativa descartada:** control optimista con `expected_revision`. Obligaría a recargar ante cualquier carga ajena, y la spec solo exige terminar con un único logotipo, no rechazar al segundo.

### D4 — Limpieza recuperable propia

Se crea el comando `purge_entity_logos --older-than-minutes 60`. Recorre `fiscal-logos/` y borra los archivos más antiguos que el margen que no figuren en `FiscalEntityLogo.storage_name`. Es idempotente y no toca `maintenance/`. Se documenta junto a `purge_workshop_files` en la operación.

### D5 — API

Las rutas cuelgan de `/api/v1/workshop-configuration/`:

| Método y ruta | Permiso | Uso |
|---|---|---|
| `POST entities/<id>/logo/` (multipart: `file`, `idempotency_key`) | `entidades_fiscales.editar` | Subir o reemplazar. Responde 200 con la entidad y su `logo`. |
| `POST entities/<id>/logo/remove/` (`idempotency_key`) | `entidades_fiscales.editar` | Quitar. Responde 200 con `logo: null`. |
| `GET entity-logos/` | Sesión vigente (`IsAuthenticated`) | Resumen para los comprobantes: `{COMERCIAL: {entity_id, legal_name, logo: {url, revision, width, height, …} \| null}, ARTESANAL: …}`. |
| `GET entity-logos/<entity_type>/<revision>/` | Sesión vigente | Entrega la imagen. |

- `_entity_data` añade `logo: {url, content_type, width, height, size_bytes, uploaded_at} | null` a la respuesta de entidades, para la ficha.
- Errores con `ProblemSerializer` y códigos `invalid_image`, `image_too_large`, `idempotency_conflict`, `entity_not_found` y `forbidden`. El detalle por campo va en `file`, como en fotografías.
- **Entrega del archivo:** solo la revisión vigente. Cualquier otra revisión o tipo responde 404 sin decir si hubo logotipo. Una solicitud sin sesión recibe 401 o 403 antes de consultar datos.
- **Cabeceras:** `Cache-Control: private, max-age=31536000, immutable` (la URL cambia con cada revisión), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'` y el `Content-Type` real guardado.

Por qué:

- **`private` y no `no-store`.** La spec prohíbe cachés compartidas, no la del navegador. Un logotipo aparece en cada comprobante, y `no-store` obligaría a descargarlo cada vez. La revisión en la URL evita mostrar uno reemplazado.
- **Resumen por tipo de entidad.** Así los tres módulos de documentos no tienen que leer datos de configuración. Solo el frontend combina el tipo del documento con el resumen, lo que evita tocar las proyecciones de `sales`, `workshop` y `purchasing`.
- **Alternativa descartada:** añadir `logo_url` al `issuer` de cada documento. Requiere cambios en tres módulos y lecturas entre fronteras para un dato que no es del documento (D3 de la propuesta: no se versiona).

El contrato se actualiza en `backend/schema.yml` con `drf-spectacular`.

### D6 — Hoja del documento: `DocumentSheet` recibe al emisor

`DocumentSheet` añade la propiedad obligatoria `issuer: { name: string; logoUrl: string | null | undefined }` y la opcional `onBrandReady`, y retira la importación del isotipo.

- **Encabezado:**
  - `<img alt="Logo de {name}">` con `object-fit: contain`, alto máximo de unos 56 px y ancho máximo del 45 % del encabezado, seguido del nombre;
  - sin logotipo, o si el evento `onError` de la imagen se dispara, solo el nombre;
  - la hoja no guarda ningún espacio reservado.
- **Pie:** «Generado con Tallkit» en texto secundario pequeño, después del aviso fiscal.
- **Datos del logotipo:** `DocumentSheet` es una pieza de presentación y recibe `issuer: { name, logoUrl }`. La consulta vive en `shared/api/entity-logos.ts` como `useIssuerBrand(scope)` (TanStack Query, `staleTime` largo) y la usan los comprobantes. Solo devuelve el logotipo del `scope` pedido, de modo que una hoja nunca muestra el de la otra entidad. Ajuste hecho durante la aplicación, para que la pieza compartida no haga peticiones.
- **Impresión:**
  - se crea `useSheetBrandReady()`, que devuelve `ready` cuando el resumen se resolvió y la imagen terminó de cargar o falló;
  - los botones «Imprimir comprobante» de `SaleDocumentPage` y `ServiceOperationDocumentPage` quedan deshabilitados, con estado ocupado accesible, hasta `ready`;
  - un tiempo máximo de 5 s degrada al nombre y habilita la impresión.
- **Nombre del emisor:**
  - venta: `issuer.legal_name`, que la API ya entrega según su regla de historia;
  - servicios: `issuer.legal_name` de la operación;
  - ingreso: `fiscal_snapshot.entity.legal_name` cuando el ingreso está confirmado; en borrador, la razón social vigente de la entidad comercial, que devuelve el resumen de D5 como `legal_name`.

  Si el detalle del ingreso confirmado no expone el nombre conservado, se añade su lectura en `purchasing`, dentro del propio módulo.

**Alternativa descartada:** convertir la imagen a `data:` URI antes de imprimir. Añade trabajo en el cliente y no mejora la privacidad. El control de disponibilidad basta.

### D7 — Ficha y modal del logotipo

En `EntitiesSection.tsx` se añade la fila «Logo» entre «Nombre comercial» y el estado de facturación electrónica:

- la vista previa usa la misma URL de revisión, con alto máximo de unos 40 px y `object-fit: contain`;
- las acciones son «Subir logo», o «Cambiar» y «Quitar».

Se crean dos piezas:

- **`features/workshop-configuration/EntityLogoModal.tsx`** (sobre `FormModal`, junto a sus mutaciones):
  - selector de archivo con `accept="image/png,image/jpeg,image/webp"`;
  - vista previa local con `URL.createObjectURL`, liberada al cerrar;
  - aviso desplegable `HintPopover` con los formatos y límites;
  - clave de idempotencia generada al abrir el modal y conservada en los reintentos del mismo archivo; se renueva al elegir otro archivo;
  - los errores del servidor se muestran junto al selector y el archivo se conserva.
- **Confirmación de «Quitar»:** `ConfirmationPanel` con el texto de que los comprobantes mostrarán solo el nombre.

El éxito cierra el modal o el diálogo, invalida `entities` y `entity-logos` y muestra el `Toast`. La interfaz puede advertir por tipo o tamaño antes de enviar, pero siempre envía lo que el servidor acepta validar.

### D8 — ADR

No se crea un ADR nuevo. Se actualiza la sección de consecuencias de ADR-0007:

- los logotipos de entidades reutilizan la raíz privada con su prefijo y su limpieza;
- se entregan a cualquier usuario autenticado con caché privada inmutable por revisión;
- consolidar la inspección de imágenes en `shared/` queda como mejora futura.

La decisión de fondo (sistema de archivos privado y entrega por la API) no cambia.

### D9 — Estrategia de pruebas (TDD)

**Backend** (`backend/tests/workshop_configuration/test_entity_logos.py`, más pruebas de dominio):

- aceptación de PNG con transparencia, JPEG y WebP estáticos;
- rechazo de SVG, SVG renombrado, GIF, WebP animado, PDF, archivo dañado, más de 2 MiB y más de 25 MP, sin archivos ni registros;
- metadatos EXIF eliminados;
- permisos: Administrador sí; Vendedor, Encargado y ambos combinados no, con denegación auditada;
- reemplazo con el archivo anterior borrado al confirmar la transacción;
- retiro, y retiro repetido sin evento;
- idempotencia con la misma clave y el mismo archivo, y conflicto con otro archivo;
- fallo simulado del almacenamiento y fallo dentro de la transacción: logotipo anterior intacto y sin archivo huérfano;
- concurrencia entre dos cargas: una vigente y el otro archivo borrado o limpiable (`transaction=True`);
- entrega: con sesión 200 y cabeceras; sin sesión denegada; revisión antigua 404;
- resumen de `entity-logos/` para los tres roles;
- `purge_entity_logos` ejecutado dos veces, sin tocar fotografías;
- migración sin datos iniciales.

**Frontend (Vitest):**

- `DocumentSheet`: con logotipo, sin logotipo, error de imagen, ámbito que nunca cruza de entidad y pie «Generado con Tallkit»;
- `EntitiesSection` y `EntityLogoModal`: subir, rechazo que mantiene el modal, quitar con confirmación, cancelar devolviendo el foco y proporciones extremas;
- páginas de comprobante: impresión deshabilitada hasta `ready`.

**E2E:** ampliar `e2e/workshop-configuration.spec.ts` (subir y quitar) y `e2e/sales-payments.spec.ts` o `e2e/maintenance-billing.spec.ts` (encabezado con el logotipo). Se ejecutan solo esos archivos.

## Risks / Trade-offs

- **Caché del navegador tras quitar un logotipo** → la URL con revisión deja de resolverse (404) y el resumen devuelve `null`. La imagen antigua solo puede persistir en la caché privada de quien ya la vio, sin mostrarse porque la hoja ya no la referencia.
- **Imprimir antes de cargar la imagen** → `useSheetBrandReady` con tiempo máximo y reserva al nombre (D6).
- **Logotipos con proporciones extremas** → alto y ancho máximos con `object-fit: contain` y prueba de 2000 × 200 px.
- **Duplicación de lógica de inspección con fotografías** → se acepta en este cambio para no refactorizar fuera del alcance. Queda anotada en ADR-0007 (D8).
- **Archivos huérfanos si el proceso muere entre escribir el archivo y confirmar la transacción** → `purge_entity_logos` con margen de 60 minutos.
- **Consumo de memoria al decodificar** → el límite de 2 MiB y 25 MP se comprueba antes de `load()`, y `DecompressionBombWarning` se convierte en error.
- **Logotipo del emisor en comprobantes antiguos** → es intencional (D3 de la propuesta). La razón social y el RUC históricos siguen en texto.
- **Resumen accesible a todo usuario autenticado** → solo revela si hay logotipo y la razón social vigente, datos que ya aparecen en los comprobantes. No incluye datos personales.

## Migration Plan

1. Migración `workshop_configuration/0013_fiscal_entity_logo`: crear `FiscalEntityLogo` y `FiscalEntity.logo_revision` (entero, 0 por omisión). No hay datos existentes que transformar, y todas las entidades quedan sin logotipo.
2. No cambia Nginx, porque 12 MiB ya cubre 2 MiB. El volumen `private_media`, montado en `PRIVATE_MEDIA_ROOT`, ya existe en `compose.yaml` y en `infra/compose.production.example.yaml`, así que no hace falta un montaje nuevo.
3. Operación: documentar `purge_entity_logos` junto a `purge_workshop_files` e incluir `fiscal-logos/` en el alcance del respaldo del volumen (DA-003 sigue abierta).
4. **Reversión:** revertir el código y la migración elimina la tabla y la columna. Los archivos de `fiscal-logos/` quedan huérfanos y se borran a mano o con el comando antes de revertir. Los comprobantes vuelven al encabezado anterior sin pérdida de datos económicos.

## Open Questions

Ninguna que bloquee. Se verificará durante la implementación, sin cambiar el comportamiento especificado, si el detalle del ingreso confirmado ya expone el nombre conservado del emisor (D6).
