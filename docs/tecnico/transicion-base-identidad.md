# Transición segura de una base inicializada hacia identidad

## Evidencia encontrada

El 2026-09-09 se inspeccionó la base local configurada. Contenía 18 migraciones estándar de Django aplicadas y cero usuarios. No se ejecutó ninguna migración, recreación, restauración ni traslado sobre esa base. El cambio introduce `AUTH_USER_MODEL = "identity.User"` desde la migración funcional inicial, por lo que el historial local anterior es incompatible aunque no contenga usuarios.

## Base nueva o descartable

1. Confirmar por escrito que la base es descartable y no contiene información que deba conservarse.
2. Guardar un respaldo si existe cualquier duda.
3. Recrear únicamente esa base identificada, nunca el clúster ni otras bases.
4. Ejecutar las migraciones desde cero y `make admin` para crear el primer Administrador.
5. Verificar login, rol `ADMINISTRADOR`, sesión y consulta de usuarios antes de habilitar operación.

La implementación no ejecuta automáticamente el paso destructivo: requiere autorización explícita.

## Base con datos que deban conservarse

No debe aplicarse la migración directamente. Primero se necesita un cambio OpenSpec específico que inventarie usuarios, referencias de autoría y sesiones; defina el mapeo hacia `identity.User`; ensaye exportación, transformación e importación sobre una copia; verifique conteos e integridad; y documente rollback. Solo después de aprobar y respaldar se programa el traslado real.

## Ensayo realizado

Las migraciones `identity.0001_initial` y `identity.0002_auditevent` se aplicaron desde cero en bases PostgreSQL desechables. Playwright usa `manage.py testserver`, que crea y destruye una base de prueba separada y carga identidades ficticias; nunca reutiliza datos personales ni la base local.
