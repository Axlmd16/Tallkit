# Glosario técnico

Este glosario complementa, sin sustituir, el glosario del negocio.

## ADR

Registro de una decisión arquitectónica duradera, su contexto, alternativas y consecuencias.

## Atomicidad

Propiedad por la que una operación compuesta se completa totalmente o no produce ningún efecto.

## API versionada

Interfaz HTTP cuyo prefijo (`/api/v1/`) identifica una versión estable del contrato.

## Bootstrap técnico

Base ejecutable, reproducible y verificada sobre la que se construirán capacidades funcionales.

## Contrato OpenAPI

Descripción legible por herramientas de las rutas, entradas y respuestas de la API HTTP.

## Concurrencia

Ejecución simultánea de operaciones que deben coordinarse para preservar las reglas del sistema.

## Drawer

Panel contextual superpuesto que entra desde un borde de la interfaz. Conserva el contexto de la
pantalla de origen y ocupa el ancho completo cuando el espacio disponible es estrecho.

## Evidencia visual

Conjunto reproducible de referencia, captura actual, diferencia y metadatos que permite revisar
la fidelidad de una interfaz sin deducir estilos a partir de la imagen.

## Referencia Figma

Frame o nodo identificado de forma estable en Figma y consultado mediante sus propiedades
estructuradas. Una captura complementa la revisión, pero no sustituye esas propiedades.

## Idempotencia

Propiedad que evita repetir los efectos de una misma solicitud procesada más de una vez.

## Lockfile

Archivo generado por el gestor de dependencias que fija el grafo exacto para instalaciones
reproducibles. En este repositorio son `uv.lock` y `package-lock.json`.

## Mismo origen

Estrategia en la que interfaz y API se publican con el mismo esquema, host y puerto, permitiendo
cookies de sesión sin una política CORS abierta.

## Monolito modular

Una sola aplicación backend desplegable, dividida internamente en módulos con fronteras y reglas
de dependencia explícitas.

## OpenSpec

Flujo de artefactos usado para proponer, especificar, diseñar, implementar y verificar cambios.

## Proxy de desarrollo

Reenvío que realiza Vite desde `/api/` hacia Django para conservar una experiencia de mismo origen
durante el desarrollo.

## TDD

Desarrollo guiado por pruebas: observar primero un fallo relevante, implementar lo mínimo y
refactorizar manteniendo las pruebas en verde.
