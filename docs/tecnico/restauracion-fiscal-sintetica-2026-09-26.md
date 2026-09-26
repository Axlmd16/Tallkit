# Evidencia de restauración fiscal sintética — 2026-09-26

## Alcance

Ensayo local con datos exclusivamente sintéticos en dos bases PostgreSQL 17.11 temporales del contenedor de desarrollo. No se usaron RUC, certificados, credenciales ni comprobantes reales y no se alteró la base de desarrollo.

## Procedimiento ejecutado

1. Se crearon `sys_taller_fiscal_restore_source` y `sys_taller_fiscal_restore_target`.
2. Se aplicaron todas las migraciones hasta `fiscal.0009_fiscal_archive_readiness` en la fuente.
3. Se registraron un Administrador sintético, una entidad fiscal sintética, una factura de pruebas, una solicitud local preparada de nota de crédito, su XML de evidencia, el vínculo entre ambos, una política y evidencia de readiness.
4. Se produjo `/tmp/fiscal_restore.dump` con `pg_dump -Fc`.
5. Se restauró en la base objetivo mediante `pg_restore --no-owner --no-privileges`.
6. Se verificaron dos contenidos binarios contra su SHA-256 almacenado, dos expedientes distintos, la relación original/evidencia de la corrección, el rol Administrador y readiness aplicable.
7. Se eliminaron el dump y ambas bases temporales.

## Resultado observado

`verified 2 <factura_uuid> <nota_credito_uuid> True`: las comprobaciones finalizaron sin error. Los UUID concretos eran datos efímeros del ensayo y no constituyen identificadores productivos.

## Límites

- El destino aislado fue otra base del mismo servidor PostgreSQL de desarrollo; demuestra restaurabilidad lógica del conjunto, no independencia física ni protección externa.
- La evidencia productiva continúa bloqueada hasta que la instalación real registre una copia en destino protegido independiente y un informe aplicable.
- No se midieron fotografías ni otros volúmenes ajenos al archivo fiscal. `DA-003` general sigue pendiente.
- Antes de usar una restauración real deben revisarse decisiones de eliminación posteriores a la copia.
