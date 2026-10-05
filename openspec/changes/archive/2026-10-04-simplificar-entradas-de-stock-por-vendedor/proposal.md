## Why

El cliente comunicó que no dispone de tiempo para revisar ni confirmar cada entrada de mercadería. Hoy solo el **Administrador** puede registrar un **ingreso de mercadería**, y debe hacerlo con proveedor, documento externo, fecha, costo, impuesto y recuperabilidad por línea. Cuando el Administrador no está, la mercadería recibida no consta en el sistema y no puede venderse, porque la existencia no admite valores negativos (DP-002).

El cliente pide que el **Vendedor** registre las entradas por sí mismo y que el sistema deje de exigir costos y datos del documento del proveedor, información que declara no necesitar. Este cambio sustituye la compra documentada por una **entrada de stock** simple, conservando el Kardex inmutable, la numeración y la protección contra duplicados.

## What Changes

- **BREAKING** — El Vendedor podrá consultar, registrar y confirmar entradas de stock. Deja de ser una operación exclusiva del Administrador. El Encargado del taller no recibe estos permisos.
- **BREAKING** — La entrada exige únicamente productos activos y cantidades enteras positivas de **presentaciones** completas. Proveedor, referencia externa, observación y costo unitario pasan a ser opcionales.
- **BREAKING** — Se retiran de la entrada el impuesto por línea, la clasificación recuperable/no recuperable, la fecha del documento del proveedor, los tipos documentales, la unicidad de la referencia externa y el reemplazo vinculado de un documento anulado.
- **BREAKING** — Queda un solo flujo. El módulo actual de compras se reemplaza por la entrada simple; las compras ya confirmadas o anuladas se conservan como historia de solo lectura, con todos sus datos originales.
- La entrada se registra y confirma en una sola acción con revisión previa, sin borrador persistente intermedio. Sigue asignando número de la serie comercial de ingresos (COM-ING), produciendo movimientos de Kardex y actualizando existencias de forma atómica e idempotente.
- Una entrada con costo actualiza el **costo promedio ponderado** como hoy. Una entrada sin costo aumenta la existencia sin alterar el promedio vigente y queda identificada como entrada sin costo registrado.
- La anulación sigue reservada al Administrador, con motivo y con la misma regla conservadora: solo procede si los efectos de la entrada son los últimos de cada producto.
- La lista de entradas permitirá al Administrador revisar después quién registró cada entrada, cuándo y con qué cantidades, sin obligarlo a aprobarlas.

### Decisiones confirmadas por el usuario (2026-10-04)

- **D1 — Costo opcional.** No se elimina: puede dejarse vacío.
- **D2 — Proveedor y referencia opcionales.** Ninguno bloquea la entrada.
- **D3 — Reemplazo del flujo.** La entrada simple sustituye a la compra documentada; no conviven dos formularios.
- **D4 — Anulación administrativa.** Solo el Administrador anula o corrige una entrada confirmada.
- **D5 — Registro sencillo.** La pantalla de entrada debe ser lo más simple posible para el cliente: pocos pasos, solo lo imprescindible a la vista y sin saturar de información. Los datos opcionales no deben estorbar el flujo principal.

### Recomendaciones aprobadas por el usuario (2026-10-04)

El usuario aprobó R1…R6 tal como se recomiendan y añadió el principio D5.

- **R1 — Valoración de una entrada sin costo.** Se recomienda valorarla al promedio vigente del producto, de modo que no lo modifique. Si el producto no tiene promedio, la existencia queda sin valor y el producto se identifica como «sin costo registrado» hasta que una entrada posterior lo aporte. Alternativa descartada: valorar en cero, porque abarataría artificialmente el promedio de las unidades que sí tienen costo.
- **R2 — Costo como un solo valor.** Se recomienda que el costo opcional sea lo que costó cada presentación, sin desglose de impuesto. Sustituye el cálculo de base, IVA y recuperabilidad.
- **R3 — Confidencialidad de costos.** Se recomienda que el Vendedor pueda escribir el costo de la entrada que registra, pero que siga sin recibir el promedio, la valoración ni los costos de entradas ajenas. El Administrador conserva la consulta completa (RF-CAT-005).
- **R4 — Proveedor para el Vendedor.** Se recomienda que el Vendedor elija entre los proveedores activos viendo solo su nombre, sin crear ni editar proveedores y sin acceder a identificación ni contacto.
- **R5 — Aviso de posible duplicado.** Al desaparecer la referencia externa única, se recomienda advertir cuando exista otra entrada del mismo día con los mismos productos y cantidades, y exigir un reconocimiento explícito para continuar. No bloquea.
- **R6 — Borradores existentes.** Se recomienda que los borradores de compra pendientes no puedan confirmarse con el flujo retirado; quedan visibles como historia sin efectos. El diseño definirá su cierre sin eliminar registros.

### Consecuencias que el cliente debe conocer

- Sin costo registrado no es posible calcular el margen bruto de ese producto ni el valor de la bodega. El reporte de margen (RF-REP-013) y la valoración mostrarán esos productos como incompletos, no como cero.
- Una misma persona registrará entradas y ventas sin aprobación previa. El control pasa a ser posterior: usuario y momento en cada movimiento, auditoría y revisión de la lista de entradas.
- El sistema deja de conservar el documento del proveedor y el IVA de compras. No sustituye a la contabilidad: las facturas recibidas y el crédito tributario siguen siendo responsabilidad del contador. Esta propuesta no es asesoría tributaria.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `compras-e-ingresos-de-mercaderia`: autorización ampliada al Vendedor; datos mínimos de la entrada; retiro de impuestos, fechas documentales, referencia única y reemplazos; confirmación directa con revisión; historia de solo lectura de las compras anteriores; consulta y experiencia.
- `existencias-y-ajustes-de-inventario`: valoración de entradas sin costo, identificación de productos sin costo registrado y efecto sobre el promedio ponderado.
- `kardex-de-productos`: acceso del Vendedor al documento de origen de una entrada sin recibir costos, y presentación de movimientos sin costo.
- `catalogo-de-proveedores`: lectura mínima de proveedores activos para seleccionar uno al registrar una entrada.
- `ventas-comerciales`: costo histórico de salida cuando el producto no tiene costo registrado.

## Impact

- **Usuarios afectados:** Vendedor (nueva responsabilidad) y Administrador (deja de ser requisito para recibir mercadería; conserva anulación, costos y valoración). El Encargado del taller no cambia.
- **Decisiones y documentos a actualizar:** sustituir DP-011 (proveedor obligatorio) y retirar DP-022, DP-023 en lo relativo a compras y DP-024; ajustar la descripción de roles de `decisiones-confirmadas.yaml`; modelo de dominio §5.1, §6 y §7; `alcance-v1.md` §3.4; RN-INV-003/004/006, RN-CAT-010; RF-INV-001…006; CU-007 y CU-015; `actores-y-roles.md` §3.3; UI-040…042; matriz de trazabilidad y `cobertura-compras-inventario.md`.
- **Permisos:** `ingresos.ver`, `ingresos.crear` e `ingresos.confirmar` se conceden también al Vendedor; `ingresos.anular`, `productos.ver_costos` e `inventario.ver_valorizacion` permanecen solo en Administrador. No se crean roles (CT-001).
- **Datos:** cambia la forma del ingreso y de sus líneas, y la valoración admite ausencia de costo. Requiere migración que conserve intactas las compras confirmadas y anuladas, y un plan para los borradores pendientes.
- **Backend y API:** módulos `purchasing` e `inventory`, lectura mínima en `supplier_registry`, permisos en `identity` y costo de salida en `sales`. Se actualiza el contrato OpenAPI.
- **Frontend:** lista, formulario y detalle de entradas; se retiran el editor de impuestos y el diálogo de reemplazo; la navegación muestra entradas al Vendedor.
- **Dependencias:** ninguna dependencia nueva. Puede requerir actualizar ADR-0005 si cambia el contrato de publicación de inventario.
- **Riesgos:** pérdida de control previo sobre entradas; inventario parcialmente valorado y margen incompleto; duplicados por doble registro sin referencia externa; exposición accidental de costos al Vendedor; regresiones en ventas y devoluciones que usan costo histórico.
- **Trazabilidad:** DP-001, DP-002, DP-006, DP-009, DP-011, DP-022…024, CT-001; RN-INV-001…007, RN-INV-011…014, RN-CAT-010, RN-CAT-015, RN-SEG-001…007; RF-INV-001…008, RF-INV-010, RF-INV-012…014, RF-CAT-005, RF-VEN-004, RF-VEN-018, RF-REP-013; CU-007, CU-008, CU-015; UI-036, UI-040…044.

## Fuera de alcance

- Cuentas por pagar, pagos a proveedores y cualquier saldo con ellos.
- Adjuntar fotografías o archivos de la factura del proveedor.
- Completar o corregir después el costo de una entrada ya confirmada.
- Reconstruir retrospectivamente la valoración de productos sin costo.
- Conteo físico, alertas de stock mínimo (RF-INV-011), consumo interno, reposición por corrección, desarme de kits y devolución a proveedor (RF-INV-016…019).
- Conceder al Vendedor ajustes, cargas iniciales, anulaciones o consulta de valoración.
- Crear o editar proveedores desde el formulario de entrada.
- Implementar el reporte de margen bruto; solo se define cómo se comporta el costo ausente.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`, completos.
- Producto: `alcance-v1.md` §3.4 y `reglas-negocio.md` (RN-INV, RN-CAT).
- Requisitos: `requisitos-funcionales.md` (RF-INV, RF-CAT-005, RF-VEN, RF-REP), `actores-y-roles.md` §3.3, `casos-de-uso.md` (CU-007, CU-008, CU-015), `interfaz-y-navegacion.md` (UI-036…049), `matriz-trazabilidad.md` y `cobertura-compras-inventario.md`.
- Specs principales: `compras-e-ingresos-de-mercaderia`, `existencias-y-ajustes-de-inventario`, `kardex-de-productos`, `autorizacion-y-navegacion`, `catalogo-de-proveedores` y `ventas-comerciales`.
- Código actual, solo como evidencia: `backend/src/purchasing`, `backend/src/inventory`, `frontend/src/pages/purchases` y `frontend/src/features/purchases`.

**Contradicciones:** este cambio contradice deliberadamente DP-011, DP-022, DP-023 (compras) y DP-024, y la asignación de ingresos al Administrador. Por precedencia, esas decisiones deben sustituirse de forma expresa antes de que las specs dependan de ellas; la aprobación de esta propuesta constituye esa sustitución.

**Información insuficiente:** no se ha validado con un contador el efecto de dejar de registrar el IVA de compras ni de mantener inventario sin valoración. No bloquea las specs, pero el cliente debe confirmarlo antes de operar con datos reales.

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
