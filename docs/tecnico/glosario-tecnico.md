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

## Combobox

Campo de texto editable con una lista de resultados flotante, conforme al patrón ARIA
«combobox». En Tallkit busca referencias en el servidor (cliente, proveedor, producto), se
recorre con el teclado y sus opciones inactivas no se pueden elegir. Sustituye al antiguo
selector con botones «Elegir».

## Concurrencia

Ejecución simultánea de operaciones que deben coordinarse para preservar las reglas del sistema.

## Drawer

Panel contextual superpuesto que entra desde un borde de la interfaz. El sistema visual Tallkit
lo retiró como formato para crear o editar: los formularios cortos usan un modal y los largos
una página completa. El componente base se conserva sin exportación pública ni consumidores
funcionales para una capacidad futura; la navegación en teléfono usa `NavigationPanel`.

## Evidencia visual

Conjunto reproducible de referencia, captura actual, diferencia y metadatos que permite revisar
la fidelidad de una interfaz sin deducir estilos a partir de la imagen. Con Tallkit, la evidencia
visual es opcional: el usuario valida normalmente la aplicación de forma directa y solicita
capturas comparativas solo cuando las necesita.

## Referencia Figma

Frame o nodo identificado de forma estable en Figma y consultado mediante sus propiedades
estructuradas. Término histórico: la plantilla Figma dejó de ser referencia normativa con el
sistema visual Tallkit, que sigue una maqueta propia sin fidelidad por nodo.

## Identidad de operación

UUID estable de un hecho de dinero (cobro, corrección, devolución o reembolso). Se distingue de la clave de idempotencia de transporte: repetir el mismo UUID con el mismo contenido devuelve el hecho ya registrado aunque cambie la clave HTTP, y dos cobros legítimos del mismo importe llevan UUID distintos.

## Idempotencia

Propiedad que evita repetir los efectos de una misma solicitud procesada más de una vez.

## Orden total de bloqueos

Secuencia fija en la que una operación toma sus recursos (recibo, identidad y compras, proveedor, catálogo, posiciones, configuración e inserciones), con identificadores ascendentes dentro de cada grupo, para que dos operaciones concurrentes nunca formen un ciclo.

## Lockfile

Archivo generado por el gestor de dependencias que fija el grafo exacto para instalaciones
reproducibles. En este repositorio son `uv.lock` y `package-lock.json`.

## Mismo origen

Estrategia en la que interfaz y API se publican con el mismo esquema, host y puerto, permitiendo
cookies de sesión sin una política CORS abierta.

## Modal

Superficie superpuesta y centrada que bloquea la pantalla de origen hasta cerrarse, contiene el
foco y lo devuelve al control que la abrió. En Tallkit presenta los formularios cortos y las
confirmaciones; en teléfono ocupa el ancho disponible.

## Monolito modular

Una sola aplicación backend desplegable, dividida internamente en módulos con fronteras y reglas
de dependencia explícitas.

## Notificación temporal (toast)

Aviso breve que confirma una acción terminada y desaparece solo. En Tallkit aparece abajo a la
derecha, dura 6 segundos, se pausa con el puntero o el foco, se cierra con Escape, se anuncia sin
mover el foco y nunca comunica errores ni advertencias que exigen actuar.

## OpenSpec

Flujo de artefactos usado para proponer, especificar, diseñar, implementar y verificar cambios.

## Proxy de desarrollo

Reenvío que realiza Vite desde `/api/` hacia Django para conservar una experiencia de mismo origen
durante el desarrollo.

## TDD

Desarrollo guiado por pruebas: observar primero un fallo relevante, implementar lo mínimo y
refactorizar manteniendo las pruebas en verde.
