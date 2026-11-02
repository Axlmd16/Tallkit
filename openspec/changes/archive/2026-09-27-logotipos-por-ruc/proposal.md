## Why

Los comprobantes internos muestran en su encabezado el isotipo y el nombre de **Tallkit**, que es la marca del sistema y no la del negocio que emite. El cliente recibe una venta de repuestos o un comprobante de servicios sin la identidad visual del local de repuestos (RUC comercial) ni del taller (RUC artesanal). Hoy la única identificación del emisor son sus datos en texto, y RN-FIS-009 exige identificar claramente la entidad fiscal en cada documento.

Este cambio permite que cada **entidad fiscal** tenga su propio **logotipo**, administrado por el Administrador, y que cada comprobante interno lo muestre según su emisor. Se hace ahora porque la configuración acaba de rediseñarse con fichas por entidad (`redisenar-pagina-de-configuracion`), y porque el cambio siguiente, `imprimir-etiquetas-de-productos`, necesita el logo comercial.

Estado: **propuesta aprobada** por el usuario el 2026-09-26 (America/Guayaquil), junto con las recomendaciones R1 a R3. Durante el descubrimiento el usuario confirmó que el logo se muestra en todos los comprobantes internos y que el archivo admite hasta 2 MiB. La aprobación no autoriza tasks ni implementación.

## What Changes

### Logotipo por entidad fiscal

1. **Un logotipo opcional por entidad.** La entidad comercial y la artesanal tienen cada una como máximo un logotipo vigente. Son independientes: cambiar o quitar uno no afecta al otro. El logotipo de Tallkit sigue siendo la marca del sistema y no se configura aquí.
2. **Solo el Administrador lo administra.** Subir, reemplazar y quitar el logotipo exige los permisos vigentes de edición de entidades fiscales, y el backend los valida. Ocultar la acción en la interfaz no basta.
3. **Archivo seguro y validado en el servidor.**
   - Formatos admitidos: imágenes estáticas PNG, JPEG o WebP.
   - Tamaño máximo: **2 MiB**, junto con un límite de resolución.
   - No se acepta SVG, porque puede contener código incrustado. Tampoco imágenes animadas.
   - Se verifica el contenido real del archivo, no solo su extensión ni el tipo declarado.
   - Una carga rechazada no cambia el logotipo vigente ni deja archivos.
4. **Almacenamiento privado.** Se sigue el patrón de ADR-0007: raíz privada, nombres no predecibles, entrega solo mediante la API con sesión vigente y limpieza recuperable de archivos sin registro. El logotipo forma parte de los datos del sistema y entra en los respaldos.
5. **Operación consistente.** Las cargas son idempotentes ante reintentos y quedan auditadas como cambio de configuración. Si dos cargas llegan a la vez, queda un solo logotipo vigente, sin archivos huérfanos permanentes.

### Configuración › Entidades fiscales

6. **Fila «Logo» en cada ficha.** Cada ficha de entidad añade una fila de consulta «Logo»:
   - con logotipo: una vista previa reducida;
   - sin logotipo: el texto «Sin logo».

   Las acciones siguen el patrón de consulta primero y edición en modal: «Subir logo», o «Cambiar» y «Quitar». El modal muestra la vista previa del archivo elegido, y los formatos y el límite aparecen como aviso desplegable. Al guardar se cierra el modal, se actualiza la ficha y aparece una notificación temporal. Un error corregible deja el modal abierto con el error. «Quitar» pide confirmación explícita.

### Comprobantes internos

7. **El encabezado muestra al emisor.** En todos los comprobantes internos, el encabezado de la hoja muestra el logotipo de su entidad fiscal en lugar del isotipo de Tallkit:
   - la venta comercial (COM-VEN) y el ingreso de mercadería (COM-ING) muestran el logo comercial;
   - el comprobante de servicios (ART-SER) muestra el logo artesanal.

   Esto aplica a la vista del comprobante confirmado, a su impresión y a las vistas previas de los editores. Nunca aparece el logotipo de la otra entidad.
8. **Sin logotipo se muestra el nombre.** Si la entidad no tiene logotipo, el encabezado muestra solo su nombre, sin un marcador vacío ni el isotipo de Tallkit.
9. **Tallkit como marca discreta.** La hoja conserva una mención breve al pie, por ejemplo «Generado con Tallkit», que no compite con el emisor.
10. **Logotipo vigente, sin versiones.** Los comprobantes antiguos muestran el logotipo vigente al consultarlos o imprimirlos. El logotipo no se versiona porque no afecta importes, impuestos, numeración ni datos fiscales. Esto no cambia la regla de que un documento confirmado conserva la copia histórica de sus datos de identificación (razón social, RUC y demás).

### Decisiones y recomendaciones

- **D1 — Documentos alcanzados (confirmada por el usuario).** El logo se muestra en todos los comprobantes internos, incluido el ingreso de mercadería, porque los tres comparten la misma hoja. Así no conviven hojas con marcas distintas.
- **D2 — Límite de 2 MiB (confirmada por el usuario).**
- **D3 — Logotipo vigente, no histórico (definida en el alcance).** Es una excepción deliberada y acotada a la «Historia de los datos fiscales»: el logo es identidad visual, no un dato económico ni fiscal.
- **R1 — Consulta del logotipo por usuarios autenticados (recomendación).** Pueden obtener el logotipo quienes tienen sesión vigente, sin permiso adicional. Vendedor y Encargado del taller lo necesitan para ver e imprimir sus comprobantes, y el logo no es un dato personal ni sensible. Se sigue exigiendo sesión y no se publica mediante URL pública (RNF-SEG-009).
- **R2 — ADR propio (recomendación).** No hace falta un ADR nuevo. ADR-0007 ya prevé que otros módulos reutilicen su patrón de archivos privados. El diseño lo citará y registrará la ampliación en sus consecuencias. Si el diseño necesitara otra raíz de almacenamiento u otro mecanismo de entrega, se revisará esta recomendación.
- **R3 — Límite de resolución (recomendación).** La resolución máxima concreta, para evitar imágenes que agoten la memoria al decodificarlas, se fijará en las specs. Se tomará como referencia el límite de 25 megapíxeles de las fotografías.

## Capabilities

### New Capabilities

Ninguna. El logotipo es un dato más de la entidad fiscal y se especifica en su capacidad.

### Modified Capabilities

- `configuracion-operativa-y-fiscal`: requisito nuevo del logotipo por entidad fiscal:
  - formatos, tamaño, resolución y verificación del contenido;
  - permiso de Administrador;
  - almacenamiento y entrega privados;
  - carga, reemplazo y retiro idempotentes y auditados;
  - consistencia ante fallos y concurrencia.

  La «Historia de los datos fiscales» precisa que el logotipo no forma parte de la copia histórica del documento.
- `organizacion-de-la-configuracion`: la ficha de cada entidad en *Entidades fiscales* incorpora la fila «Logo», con vista previa y acciones en modal.
- `ventas-comerciales`: el comprobante interno comercial muestra el logo comercial, o el nombre de la entidad si no hay logo.
- `operacion-artesanal-de-servicios`: el comprobante interno artesanal muestra el logo artesanal, o el nombre de la entidad si no hay logo.
- `patrones-de-pantalla-frontend`: la hoja imprimible de PPF-05 (vistas previas de venta e ingreso de mercadería) encabeza con la identidad de su entidad emisora y relega Tallkit a una mención discreta.
- `sistema-visual-frontend`: «Identidad visual Tallkit» precisa que el logotipo del producto identifica al sistema y no al emisor de los comprobantes internos.

## Impact

- **Usuarios afectados:**
  - el Administrador administra los dos logotipos;
  - Vendedor, Encargado del taller y Administrador ven el logo del emisor en los comprobantes que ya pueden consultar;
  - los permisos de consulta de cada documento no cambian.
- **Backend:**
  - capacidad de configuración fiscal: dato de logotipo por entidad, validación de imagen, almacenamiento privado, entrega autorizada y limpieza;
  - ventas, operaciones artesanales e ingresos: exponer la referencia al logo de su entidad;
  - reutiliza Pillow y el patrón de archivos de ADR-0007;
  - requiere migración, sin transformar datos existentes: todas las entidades empiezan sin logotipo.
- **API:** operaciones nuevas para subir, quitar y obtener el logotipo de una entidad, y una referencia al logo en los datos de cada comprobante. Se actualiza el contrato OpenAPI.
- **Frontend:**
  - ficha de entidad en *Entidades fiscales* y su modal;
  - hoja `DocumentSheet`, compartida por los comprobantes de venta, servicios e ingreso de mercadería;
  - impresión A4 (RNF-USA-012).
- **Operación:** el volumen privado ya previsto para fotografías guarda también los logotipos y debe incluirse en los respaldos (DA-003 sigue abierta). Nginx ya admite cuerpos mayores que 2 MiB en `/api/`.
- **Dependencias:** ninguna nueva.
- **Documentación:**
  - `interfaz-y-navegacion.md` (UI-014, UI-058 y UI-077, y la hoja del ingreso);
  - `matriz-trazabilidad.md`;
  - `glosario.md`, con el término «Logotipo de entidad fiscal»;
  - consecuencias de ADR-0007;
  - specs principales al archivar.
- **Riesgos:**
  - La impresión podría empezar antes de que cargue el logotipo; el diseño debe esperarlo o degradar al nombre de la entidad.
  - Un logotipo muy ancho o muy alto podría descuadrar el encabezado A4; la hoja debe acotar su tamaño sin deformarlo.
  - Mostrar el logotipo vigente en comprobantes antiguos es intencional (D3), pero un cambio de marca también se verá en documentos reimpresos. Por eso la razón social y el RUC históricos siguen visibles en texto.
  - Una entrega sin caché compartida podría volver a descargar el logotipo en cada vista; el diseño debe equilibrar caché privada y privacidad.

## Fuera de alcance

- Etiquetas de productos: las cubre el cambio siguiente, `imprimir-etiquetas-de-productos`, que usará el logo comercial si existe.
- El logotipo de Tallkit en la navegación, la pantalla de acceso y el resto de la interfaz, que no cambia.
- Historial o versiones del logotipo, y logotipos por establecimiento o punto de emisión.
- Recortar, redimensionar o editar la imagen dentro del sistema, más allá de ajustar su presentación en pantalla e impresión.
- Logotipos en documentos fiscales preparados, XML o representaciones de facturas electrónicas. V1 no emite facturas (DP-018).
- Proformas: todavía no tienen comprobante imprimible; cuando lo tengan usarán la misma hoja.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`:
  - separación fiscal obligatoria, CT-001 y DP-018;
  - responsabilidades del Administrador;
  - DA-002, que trata sobre fotografías y no bloquea este cambio.
- `docs/arquitectura/modelo-dominio.md`: entidad fiscal, documento interno e invariantes 1, 2 y 25.
- Specs principales:
  - `configuracion-operativa-y-fiscal`: acceso administrativo, historia de los datos fiscales, auditoría e idempotencia;
  - `organizacion-de-la-configuracion`: consulta primero y edición en modal; entidades en fichas paralelas;
  - `sistema-visual-frontend`: identidad visual Tallkit;
  - `patrones-de-pantalla-frontend`: PPF-04, PPF-05, PPF-06 y PPF-08;
  - `fotografias-de-mantenimiento`;
  - `ventas-comerciales`: consulta comercial y comprobante interno;
  - `operacion-artesanal-de-servicios`: consulta y comprobante interno artesanal;
  - `compras-e-ingresos-de-mercaderia`: no define un comprobante propio; la hoja del ingreso está en PPF-05.
- `docs/adr/0007-almacenamiento-privado-fotografias.md`.
- Producto y requisitos:
  - `docs/negocio/producto/vision.md`: Tallkit como nombre del producto;
  - `alcance-v1.md`: impresión de documentos internos;
  - `reglas-negocio.md`: RN-FIS-001…009 y RN-CON-009;
  - `requisitos-funcionales.md`: RF-ACC-010, RF-VEN-015 y RF-TAL-012;
  - `requisitos-no-funcionales.md`: RNF-SEG-009 y RNF-USA-012;
  - `casos-de-uso.md`: CU-003;
  - `interfaz-y-navegacion.md`: UI-014, UI-058 y UI-077.
- Código actual, solo como evidencia: `frontend/src/shared/ui/business/DocumentSheet.tsx` muestra el isotipo de Tallkit, y lo usan `SalesDocument`, `ServiceOperationDocumentPage` y `PurchaseDocument`.

**Contradicciones y brechas:**
- «Historia de los datos fiscales» exige conservar la copia histórica de los datos usados al confirmar. D3 excluye expresamente el logotipo, y la spec lo precisará para que no haya contradicción.
- RNF-SEG-009 solo menciona fotografías y exportaciones; el logotipo recibe la misma protección por coherencia.

**Información insuficiente:** el límite exacto de resolución (R3), que se propondrá en las specs.
