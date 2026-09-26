# ADR-0010: Módulo fiscal independiente y archivo transaccional

- Estado: Aceptada el 2026-09-26 al aplicar el cambio `establecer-modulo-fiscal-independiente`.
- Fecha: 2026-09-26

## Contexto

El sistema necesita preparar información fiscal para dos contribuyentes y conservar comprobantes externos sin acoplar ventas, servicios o estados internos a un proveedor de emisión. La preparación debe preservar importes históricos, y los XML deben sobrevivir cambios de proveedor, cancelaciones locales y restauraciones.

## Decisión

- `fiscal` es un módulo propio del monolito. Conserva preparaciones, snapshots, identidades de ensayo, archivo, vínculos y solicitudes locales de corrección; consume lecturas públicas de ventas, taller y configuración.
- Los estados borrador, preparada y cancelada son locales. Pago, operación comercial, evidencia externa y resultado oficial son dimensiones separadas. Esta decisión no implementa transmisión, firma ni autorización del SRI.
- La numeración fiscal propia solo opera en ambiente de pruebas. Producción queda reservada a una integración futura y no comparte las series internas COM-VEN o ART-SER.
- Cada XML admitido se valida con esquemas locales identificados, se limita a 2 MiB y se conserva con sus bytes y SHA-256 en PostgreSQL dentro de la misma transacción que identidad, procedencia y vínculo.
- La incorporación productiva requiere política versionada por entidad fiscal y evidencia aplicable de restauración. Cambiar procedimiento o almacenamiento invalida esa habilitación.
- Una futura integración se conecta fuera de las transacciones comerciales y no redefine el modelo fiscal según los códigos de un proveedor.

## Alternativas consideradas

- Construir la capacidad dentro de ventas: duplica la variante artesanal y cruza fronteras de propiedad.
- Modelar directamente la API de un proveedor: impide cambiar entre emisión propia y externa sin reescribir el dominio.
- Unificar venta de repuestos y operación artesanal: contradice la separación económica aprobada.
- Guardar XML junto a fotografías privadas: exige coordinar dos almacenamientos para un documento pequeño que debe restaurarse junto con identidad y vínculos.
- Habilitar emisión productiva en esta fase: introduciría firma, secretos, red y estados oficiales sin decisión ni operación suficiente.

## Consecuencias

La preparación y consulta funcionan sin proveedor, los snapshots son reproducibles y el archivo se respalda con la base. A cambio, PostgreSQL crece, el proyecto mantiene XSD oficiales y debe ensayar restauraciones. La preparación no equivale a factura emitida y una evidencia externa permanece no verificada salvo una futura consulta oficial.

## Referencias

- [Diseño D1–D13](../../openspec/changes/establecer-modulo-fiscal-independiente/design.md).
- [ADR-0001](0001-monorepositorio-y-monolito-modular.md), [ADR-0004](0004-contrato-transaccional-configuracion-y-numeracion.md), [ADR-0006](0006-coordinacion-transaccional-ventas-comerciales.md) y [ADR-0008](0008-documentos-artesanales-separados-y-nucleo-monetario.md).
- [ADR-0007](0007-almacenamiento-privado-fotografias.md) sigue rigiendo fotografías; este ADR no lo sustituye.
- [Operación del archivo fiscal](../tecnico/operacion-archivo-fiscal.md).
- [Referencia terminológica](0010-modulo-fiscal-independiente-y-archivo-transaccional-glossary-reference.md).
