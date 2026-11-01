# Operación del archivo fiscal

Estado: procedimiento operativo de la capacidad fiscal local. No acredita por sí solo cumplimiento legal, existencia de una copia externa ni emisión ante el SRI.

## Alcance y responsables

El Administrador registra una política versionada por cada entidad fiscal. La política identifica al responsable fiscal, la finalidad, el fundamento, los plazos por categoría, el canal de derechos, el procedimiento de atención, la revisión al terminar la conservación, la versión del procedimiento de respaldo y la huella del almacenamiento. Vendedor y Encargado no administran esta información.

## Categorías y conservación

| Categoría | Tratamiento mínimo |
|---|---|
| XML fiscal y envoltorios | Original inmutable en PostgreSQL, SHA-256, mínimo siete años desde emisión y revisión antes de cualquier eliminación posterior. |
| Contacto operativo | Separado del XML; conservar solo mientras sea necesario para la atención autorizada. Una rectificación no reescribe el comprobante. |
| Auditoría | Conservar actor, acción, resultado y referencias necesarias; evitar copias innecesarias de datos personales. |
| Exportaciones | Entrega privada y acotada; eliminar copias temporales conforme al procedimiento local. |
| Respaldos | Copia consistente de PostgreSQL en destino protegido independiente, con rotación documentada y revisión de eliminaciones posteriores antes de reabrir datos restaurados. |

## Atención de derechos

El canal declarado recibe solicitudes de acceso, rectificación o eliminación. El responsable verifica identidad, legitimación, alcance y entidad fiscal antes de consultar o entregar información. Una solicitud no modifica el XML ni lo elimina automáticamente durante una obligación de conservación: se documentan fundamento, alcance, decisión y respuesta. Los datos operativos ajenos a esa obligación se evalúan por separado.

## Habilitación del archivo productivo

La incorporación de un XML con ambiente `2` queda bloqueada hasta que la entidad tenga:

1. política vigente con todas las categorías anteriores;
2. evidencia de restauración cuya versión de procedimiento y huella de almacenamiento coincidan con la política vigente;
3. resultados positivos para contenido/hashes, identidades, permisos, vínculos y revisión de decisiones de eliminación.

Una política nueva invalida la evidencia anterior cuando cambia el procedimiento o el almacenamiento. El registro es una declaración administrativa respaldada por un informe; el sistema no inspecciona el destino externo. Los XML sintéticos de ambiente de pruebas continúan disponibles para ejercicios.

### Prueba real supervisada (aprobada, todavía no opera)

`DP-034` (regla 9) permite, antes de la facturación diaria, una prueba real supervisada con pocas facturas reales aunque no se cumplan las condiciones anteriores (`RN-FIS-018`). Esa excepción todavía no existe en el sistema: la incorporación de un XML con ambiente `2` sigue bloqueada por `backend/src/fiscal/application/xml_archive.py:174`. El cambio 3 o el 4 debe programarla y fijar antes la cantidad y los casos de la prueba. La excepción no sustituye la política ni la restauración probada, que siguen siendo condición de la facturación diaria.

## Respaldo y restauración

1. Detener o coordinar escrituras y producir un `pg_dump` consistente en formato custom.
2. Cifrar y trasladar la copia a un destino protegido independiente del host y volumen de PostgreSQL.
3. Crear una instancia aislada sin rutas de producción y restaurar con `pg_restore`.
4. Comprobar migraciones, usuarios/roles, número de expedientes, bytes exactos contra SHA-256, identidades fiscales, vínculos internos y relaciones de corrección.
5. Revisar solicitudes o decisiones legítimas de eliminación posteriores a la fecha de la copia antes de habilitar lecturas.
6. Registrar fecha, responsable, versión del procedimiento, huella de almacenamiento, identificador de copia, destino aislado, informe y resultados.
7. Destruir de forma controlada la instancia de ensayo y sus copias temporales.

Este procedimiento cubre el archivo fiscal conservado en PostgreSQL. No cubre fotografías ni completa `DA-003` para toda la instalación.

## Rollback operativo

Ante una incidencia se deshabilitan comandos y pantallas fiscales, preservando consulta y recuperación administrativa. No se revierten migraciones que contengan XML, identidades o historia; una versión anterior solo puede desplegarse si comprende el esquema ampliado. Restaurar una copia antigua sobre datos nuevos no es un rollback válido.

## Evidencia sintética 2026-09-26

El ensayo documentado en [restauracion-fiscal-sintetica-2026-09-26.md](restauracion-fiscal-sintetica-2026-09-26.md) restauró una copia en otra base PostgreSQL temporal y comprobó bytes, hashes, identidades, permisos, vínculo entre factura y nota de crédito y readiness. No demuestra que exista la copia externa operativa de una instalación real.
