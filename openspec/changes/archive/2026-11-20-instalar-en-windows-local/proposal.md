# Propuesta: instalar-en-windows-local

## Why

El repositorio cuenta con despliegue de desarrollo y un ejemplo de producción basado en contenedores Linux, pero la decisión arquitectónica `DA-003` (empaquetado, instalación, actualización, respaldo y restauración local) sigue abierta. En la prueba piloto (Fase 0 del 20/11/2026) se comprobó que Tallkit funciona de forma nativa en la mini PC compartida del taller sobre Windows 11 Pro (PostgreSQL 17, backend Python 3.13 y proxy HTTPS local aceptado por la tablet Lenovo Android), por lo que corresponde formalizar una instalación local repetible, segura y mantenible para cerrar `DA-003`.

## What Changes

1. **Cierre de `DA-003` y registro de `ADR-0013`:** Formalizar la estrategia de empaquetado, instalación nativa en Windows 11 Pro, operación como servicios sin sesión de usuario, actualización conectada con GitHub y respaldo/restauración cifrada local y en la nube.
2. **Instalación y operación local en Windows:** Incorporar los artefactos operativos para instalar, verificar, actualizar, respaldar y restaurar Tallkit en una mini PC Windows 11 Pro compartida, aislando la aplicación y sus datos de cuentas de usuario no autorizadas y ejecutándola mediante servicios de arranque automático.
3. **Actualizaciones conectadas a GitHub:** Definir un flujo reproducible para publicar versiones desde el repositorio y aplicar actualizaciones en la mini PC con respaldo preventivo previo, validación de versión y chequeo de salud posterior, sin depender de copias manuales por memoria USB.
4. **Respaldo y restauración verificables:** Formalizar el respaldo diario conjunto de base de datos, fotografías privadas, configuración sensible y autoridad certificadora local, cifrado y replicado a disco USB externo y Google Drive, junto con su procedimiento de restauración.
5. **Expiración de sesión por inactividad:** Agregar cierre automático de sesión por inactividad con duración configurable para proteger el acceso en equipos compartidos del taller.
6. **Compatibilidad y verificación en Windows:** Asegurar compatibilidad de la suite de pruebas en Windows (incluida la normalización de rutas en pruebas de fronteras de módulos) y añadir verificación automatizada en CI sobre Windows.

## Capabilities

### New Capabilities
- `despliegue-y-operacion-local`: Empaquetado, instalación nativa en Windows 11 Pro, operación automática en red local con HTTPS interno, actualización controlada desde GitHub y respaldo/restauración cifrada de base de datos, archivos privados y configuración.

### Modified Capabilities
- `autenticacion-y-credenciales`: Incorporar expiración de sesión por inactividad configurable además de la expiración absoluta vigente, manteniendo la protección de sesión y CSRF.

## Impact

- **Usuarios afectados:** Administrador (instalación, actualización, respaldos y restauración), Vendedor y Encargado del taller / usuaria diaria (acceso estable por HTTPS desde mini PC y tablet, cierre por inactividad). La cuenta de Windows del tercero/guardia queda aislada sin acceso a los archivos ni servicios del sistema.
- **Dependencias y backend:** Inclusión del servidor WSGI compatible con Windows para ejecución en producción local, configuración de expiración por inactividad en sesiones y ajuste menor de compatibilidad de rutas en pruebas. No altera reglas de negocio, dinero, impuestos, inventario ni separación fiscal.
- **Frontend:** Sin cambios funcionales en pantallas de negocio; se mantiene la compilación estática servida en el mismo origen que la API.
- **Operación e infraestructura:** Nuevos descriptores y guías operativas en `infra/windows/`, CI en Windows y actualización de documentación técnica, C4, trazabilidad y glosarios si corresponde.
- **Datos y seguridad:** Sin cambios en el esquema de negocio; protección en reposo mediante cifrado del equipo, permisos del sistema operativo sobre los directorios de aplicación/datos/respaldos y cifrado de copias de seguridad.

## Fuera de alcance

- Publicación de Tallkit en Internet o acceso remoto público al sistema de gestión (sigue fuera de V1).
- Migración hacia contenedores Docker, Hyper-V o máquinas virtuales Linux en la mini PC del taller.
- Habilitación de facturación electrónica real ante el SRI (`DP-034` regla 8; continúa operando únicamente en ambiente de pruebas).
- Cambios en permisos de negocio, roles (`CT-001`), reglas fiscales, monetarias o de inventario.
- Compra de dominio público o certificados públicos mientras el certificado de CA local funcione en la mini PC y en la tablet del taller.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` (incluyendo `DA-003`, `CT-001`, `DP-034`, `DP-036`)
- `docs/arquitectura/modelo-dominio.md` (sección 11.4 sobre `DA-003`)
- `docs/negocio/requisitos/requisitos-no-funcionales.md` (`RNF-DIS-001` a `RNF-DIS-008`, `RNF-SEG-001` a `RNF-SEG-012`)
- `docs/negocio/requisitos/casos-de-uso.md` (`CU-021`)
- `docs/negocio/requisitos/matriz-trazabilidad.md`
- `openspec/specs/autenticacion-y-credenciales/spec.md`
- `docs/tecnico/plan-instalacion-taller.md` (resultados de la Fase 0 del 20/11/2026)
- `docs/adr/0003-sesiones-y-mismo-origen.md` y `docs/adr/0007-almacenamiento-privado-fotografias.md`

## Decisiones, recomendaciones, contradicciones y pendientes

- **Decisiones confirmadas aplicables:** `RNF-DIS-001` a `RNF-DIS-008`, `RNF-SEG-004` a `RNF-SEG-012`, `CU-021`, `ADR-0003` (sesiones y mismo origen) y `ADR-0007` (almacenamiento privado de fotografías incluido en respaldos).
- **Recomendación para cerrar `DA-003` (requiere aprobación del titular):**
  1. Adoptar la instalación nativa en Windows 11 Pro sin Docker (PostgreSQL 17 + servidor WSGI nativo + proxy inverso HTTPS con CA local) gestionada como servicios de Windows, en lugar de WSL2/Docker o Hyper-V.
  2. Adoptar actualizaciones conectadas con GitHub mediante artefactos versionados (o descarga de release) con respaldo previo obligatorio, en lugar de transferencias manuales por USB.
  3. Adoptar respaldo diario cifrado conjunto (base de datos, fotografías, `.env` y CA local) con retención 7 diarios / 4 semanales / 3 mensuales hacia disco USB externo y Google Drive.
  4. Fijar un tiempo de inactividad de sesión configurable (por definir en `specs`/`design`, p. ej. 30–60 minutos de inactividad en entorno de taller).
- **Contradicciones detectadas:** Ninguna con las decisiones confirmadas; únicamente `test_only_published_customer_interfaces_are_imported_by_other_modules` asume separadores POSIX (`/`) y falla en Windows (`\`).
- **Pendientes excluidos:** `DA-002` (política completa de retención/límites de fotografías fuera de lo ya decidido en `ADR-0007`) y habilitación de facturación electrónica en producción (`DP-034`).

## Riesgos y dependencias

- **Dependencias:** Mini PC con Windows 11 Pro, PostgreSQL 17, conectividad Ethernet en red local del taller, cuenta de Google Drive del cliente y acceso a GitHub para actualizaciones.
- **Riesgos:**
  - Cambio accidental de IP local si el router reasigna direcciones (mitigado con IP manual fija en Windows).
  - Pérdida de claves de BitLocker o cifrado de respaldos (mitigado guardando copias fuera de la mini PC con el dueño).
  - Interferencia de software de terceros en la cuenta de entretenimiento (ej. anti-cheat) o reinicios por actualizaciones de Windows en horario laboral (mitigado con horas activas y verificación en Fase 2).
  - Cierre de sesión por inactividad demasiado corto que interrumpa capturas en la tablet (mitigado haciendo el umbral configurable).
