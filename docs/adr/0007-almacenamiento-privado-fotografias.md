# ADR-0007: Almacenamiento privado de fotografías de mantenimiento

- Estado: Propuesta en el diseño del cambio `gestionar-ordenes-mantenimiento`; pasará a Aceptada al aplicar el cambio tras la aprobación del diseño.
- Fecha: 2026-09-24

## Contexto

El taller debe adjuntar fotografías a los mantenimientos (RN-TAL-006, RF-TAL-004) y DA-002 se resolvió para esta entrega con la decisión P4: imágenes JPEG, PNG o WebP estáticas de hasta 10 MiB y 25 megapíxeles, 20 vigentes por orden, conservadas mientras exista la orden y accesibles solo por usuarios autorizados. El sistema no tenía almacenamiento de archivos: `STORAGES["default"]` es `FileSystemStorage` sin `MEDIA_ROOT`, no hay volumen persistente, Nginx limita el cuerpo a 1 MiB y Pillow no es dependencia. ADR-0003 exige sesión y mismo origen; V1 opera en red local (DA-003 sigue abierta para respaldo e instalación).

## Opciones consideradas

1. **Sistema de archivos local privado servido por la API autorizada.** Sin servicios nuevos; la autorización es la misma de la orden; requiere volumen y respaldo.
2. **`MEDIA_URL` público servido por Nginx o WhiteNoise.** Simple, pero expone enlaces permanentes sin autorización; rechazado.
3. **Almacenamiento de objetos (S3 o compatible) con URLs firmadas.** Escalable, pero añade un servicio, credenciales y operación que V1 en red local no necesita.
4. **Imágenes en PostgreSQL (`bytea`).** Transaccional, pero engorda la base y los respaldos y complica la entrega por streaming.

## Decisión

Adoptar la opción 1. Las fotografías se guardan en una instancia dedicada de `FileSystemStorage` con raíz `PRIVATE_MEDIA_ROOT` (configurable por entorno y montada como volumen), sin URL pública. Los nombres son aleatorios (UUID) y los archivos solo se entregan mediante endpoints de la API que validan sesión y `mantenimientos.ver` en cada solicitud, con `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` y una CSP restrictiva.

Se incorpora `pillow` para validar el contenido real, las dimensiones y la animación antes de decodificar, y para generar miniaturas sin metadatos. El registro en base de datos se crea solo después de escribir por completo los archivos; los fallos borran los archivos de inmediato y un comando idempotente (`purge_workshop_files`) elimina los huérfanos con un margen temporal. Nginx admite cuerpos de hasta 12 MiB en `/api/`.

## Consecuencias

- El volumen de fotografías forma parte de los datos del sistema y debe incluirse en los respaldos que defina DA-003.
- Cualquier otro módulo que necesite archivos privados puede reutilizar el mismo patrón: raíz privada, nombres no predecibles, entrega autorizada y limpieza recuperable.
- Migrar después a almacenamiento de objetos exigirá un nuevo backend de almacenamiento y la copia de los archivos, sin cambiar el contrato de la API.
- Pillow queda sujeto a `make audit` y a la política de versiones de ADR-0002.

Referencia terminológica: [0007-almacenamiento-privado-fotografias-glossary-reference.md](0007-almacenamiento-privado-fotografias-glossary-reference.md).
