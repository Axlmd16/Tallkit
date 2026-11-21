# despliegue-y-operacion-local Specification

## Purpose
Definir los requisitos observables de instalación local, operación automática en red local, actualización controlada desde GitHub y respaldo/restauración cifrada de Tallkit para el cierre de `DA-003`.

## ADDED Requirements

### Requirement: Instalación local repetible y aislamiento en equipo compartido
El sistema SHALL instalarse de forma repetible en el equipo principal del taller con Windows 11 Pro sin requerir contenedores ni máquina virtual Linux, y SHALL restringir el acceso a los archivos de aplicación, configuración sensible, fotografías privadas y respaldos únicamente a cuentas administrativas y de servicio autorizadas. Trazabilidad: `DA-003`, `RNF-DIS-001`, `RNF-SEG-008`, `RNF-SEG-012`.

#### Scenario: Instalación limpia y protección de archivos en equipo compartido
- **WHEN** un Administrador ejecuta la instalación parametrizada con la dirección IP local del equipo y la configuración sensible fuera del repositorio
- **THEN** el sistema SHALL quedar operativo en la red local del taller y una cuenta estándar de terceros en el mismo equipo SHALL NOT poder leer ni modificar los directorios de aplicación, datos privados ni respaldos

### Requirement: Operación automática sin sesión de usuario y transporte seguro local
El sistema SHALL iniciar automáticamente sus servicios tras un arranque o recuperación de energía sin requerir que ningún usuario inicie sesión en el sistema operativo, SHALL servir la aplicación bajo HTTPS en el mismo origen mediante certificado de autoridad local para los equipos autorizados de la red del taller y SHALL impedir conexiones de red externas directas al motor de base de datos. Trazabilidad: `DA-003`, `RNF-DIS-001`, `RNF-SEG-004`, `RNF-SEG-010`, `ADR-0003`.

#### Scenario: Arranque autónomo y acceso seguro en red local
- **WHEN** el equipo principal se reinicia sin iniciar sesión de usuario en el escritorio
- **THEN** el chequeo de salud del sistema SHALL responder por HTTPS desde los dispositivos autorizados de la red local y el puerto de base de datos SHALL NOT aceptar conexiones desde otros equipos de la red

### Requirement: Respaldo conjunto, cifrado y replicado
El sistema SHALL generar respaldos automáticos diarios y manuales bajo demanda que empaqueten de forma coherente la base de datos, las fotografías privadas, la configuración de entorno y los certificados de la autoridad local en un conjunto cifrado, SHALL replicarlos hacia almacenamiento local externo y almacenamiento en la nube, SHALL aplicar retención histórica de copias y SHALL registrar fecha, resultado y tamaño de cada ejecución. Trazabilidad: `DA-003`, `CU-021`, `RNF-DIS-002`, `RNF-DIS-003`, `RNF-DIS-006`, `RNF-SEG-012`, `ADR-0007`.

#### Scenario: Ejecución de respaldo completo y registro de evidencia
- **WHEN** se ejecuta el respaldo programado o manual
- **THEN** el sistema SHALL producir un paquete cifrado con base de datos, archivos privados, configuración y autoridad local, SHALL copiarlo al disco externo y a la nube configurada, SHALL depurar copias vencidas según retención y SHALL registrar el resultado con fecha y tamaño

#### Scenario: Falla en un destino de respaldo
- **WHEN** uno de los destinos configurados (disco externo o nube) no está disponible durante el respaldo
- **THEN** el sistema SHALL conservar la copia local cifrada generada y SHALL registrar el fallo de forma explícita sin reportar el respaldo como completamente exitoso

### Requirement: Restauración verificable en entorno independiente
El sistema SHALL proveer un procedimiento documentado y automatizable para descifrar un respaldo y restaurar la base de datos, las fotografías privadas, la configuración y la autoridad local sobre una instalación limpia o equipo de reemplazo, permitiendo verificar la integridad de los datos restaurados. Trazabilidad: `DA-003`, `CU-021`, `RNF-DIS-004`, `RNF-DIS-005`, `RNF-DIS-006`.

#### Scenario: Restauración exitosa en equipo distinto
- **WHEN** un Administrador ejecuta la restauración desde una copia cifrada descargada en un entorno independiente
- **THEN** la aplicación SHALL iniciar con los datos, fotografías y configuración recuperados y las conciliaciones operativas SHALL completarse sin diferencias atribuidas a la restauración

### Requirement: Actualización controlada conectada con GitHub
El sistema SHALL permitir actualizar a una nueva versión publicada en GitHub mediante un procedimiento automatizado que ejecute un respaldo previo obligatorio, detenga los servicios, actualice el código y la interfaz compilada preservando la configuración sensible y los archivos privados, aplique las migraciones y verifique la salud antes de dar por completada la actualización. Trazabilidad: `DA-003`, `RNF-DIS-007`, `RNF-DIS-008`.

#### Scenario: Actualización exitosa preservando configuración y datos
- **WHEN** un Administrador ejecuta la actualización hacia una nueva versión disponible desde GitHub
- **THEN** el sistema SHALL crear un respaldo previo, SHALL actualizar la aplicación sin sobrescribir configuración ni fotografías, SHALL aplicar migraciones y SHALL confirmar respuesta válida en el chequeo de salud

#### Scenario: Falla durante la actualización
- **WHEN** falla la descarga, la instalación de dependencias, la migración o el chequeo de salud posterior
- **THEN** el procedimiento SHALL detenerse informando el error sin eliminar el respaldo previo ni corromper la configuración existente
