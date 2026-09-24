## Why

El sistema visual vigente reproduce una plantilla de terceros (SAAS Dashboard, archivo Figma `GRvgnODulXXrLTz4BsaToK`) y no responde al trabajo real del taller: su tipografía redondeada, sus tarjetas amplias y sus superficies poco diferenciadas reducen la información visible, y las confirmaciones de éxito quedan fijas en la parte superior de la pantalla. El usuario pidió reemplazarlo por una identidad propia, **Tallkit**, pensada para jornadas largas de mostrador y taller, y aprobó el 2026-09-21 una maqueta de referencia con los fundamentos y los patrones de pantalla.

## What Changes

- **BREAKING (visual):** sustituir el lenguaje visual completo del frontend por el sistema propio **Tallkit · Banco de trabajo**: paleta azul Tallkit y naranja del logotipo, acento petróleo para selección y foco, neutros en capas, tipografía IBM Plex Sans para la interfaz e IBM Plex Mono para códigos, placas, RUC y números, radios contenidos, bordes finos y elevación reservada a elementos flotantes.
- Retirar como referencia normativa el archivo Figma `GRvgnODulXXrLTz4BsaToK`, la fidelidad por nodo, la comparación contra frames de terceros y la tipografía Nunito.
- Adoptar como referencia visual aprobada la maqueta Tallkit (lienzo «Tallkit — Sistema visual»), sin exigir fidelidad píxel a píxel: fija fundamentos y patrones, no pantallas cerradas.
- Mostrar la marca **Tallkit** con el logotipo existente en `frontend/src/assets/brand/`.
- Definir patrones de pantalla reutilizables que todas las páginas deben seguir: lista con filtros y tabla, ficha de detalle, formulario por secciones, editor de documento con vista previa, diálogo de confirmación, estados de contenido y notificación temporal.
- Presentar los formularios cortos (hasta unos cuatro campos simples, sin secciones) en un **modal** sobre la lista y los formularios largos en **página completa**. **BREAKING (interacción):** se retira el panel lateral (drawer) como formato de creación y edición.
- Reemplazar la franja de éxito persistente por una **notificación temporal (toast)** abajo a la derecha, que desaparece sola. Los errores y advertencias que exigen actuar siguen en línea, junto al campo o panel afectado.
- Incorporar piezas visuales propias del negocio: placa de vehículo, código de repuesto, indicador de existencias, marca de ámbito fiscal diferenciada para RUC comercial y RUC artesanal, e importes alineados con guion cuando no hay dato.
- Navegación: barra lateral desplegada y agrupada por trabajo en escritorio, variante de iconos en tableta y panel temporal en teléfono.
- Dejar preparada la estructura de tokens para un tema oscuro futuro, sin implementarlo ni ofrecer el cambio de tema.
- Aplicar el sistema a todas las pantallas existentes (acceso, inicio, usuarios, auditoría, estado técnico, configuración, catálogos, clientes y vehículos, proveedores, compras, inventario, ventas, cobros y cuentas por cobrar) sin cambiar permisos, rutas, API ni resultados funcionales.
- Reemplazar el catálogo visual interno de desarrollo, hoy organizado por componentes C01–C66 de la plantilla, por un catálogo de los componentes y patrones Tallkit.
- Cancelar el cambio `aplicar-catalogo-visual-frontend`, que corregía la fidelidad a la plantilla anterior; ver «Cambio cancelado».

## Capabilities

### New Capabilities

- `patrones-de-pantalla-frontend`: patrones de composición e interacción comunes a todas las pantallas: lista, ficha, formulario por secciones, formulario corto en modal, editor de documento con vista previa, diálogos de confirmación, estados de contenido (vacío, sin resultados, carga, error, sin permiso) y notificaciones temporales.

### Modified Capabilities

- `sistema-visual-frontend`: reemplazar la fidelidad a la plantilla Figma por los fundamentos Tallkit (color, tipografía, forma, elevación, iconografía, piezas del negocio, bases del tema oscuro) y por una aceptación visual contra la maqueta aprobada.
- `experiencia-adaptable-frontend`: sustituir la navegación compacta obligatoria de 80 px y la referencia `4:344` por barra desplegada en escritorio, iconos en tableta y panel en teléfono; retirar el panel lateral como formato de formulario; ajustar listas, formularios y diálogos a los nuevos patrones; retirar la comparación contra la referencia nativa de Figma.
- `catalogo-visual-reutilizable`: reemplazar la procedencia Figma y el inventario C01–C66 por el catálogo de componentes y patrones Tallkit, conservando su aislamiento de la aplicación funcional.

## Objetivo

Que todas las pantallas de Tallkit compartan un sistema visual propio, compacto y legible, que muestre más información útil por pantalla y que resulte comprobable mediante pruebas y revisión visual del usuario, sin alterar ninguna regla de negocio.

## Alcance

- Fundamentos visuales, marco autenticado, pantalla de acceso, componentes compartidos, componentes de cada módulo y todas las páginas funcionales existentes.
- Sustitución de los paneles laterales de edición por modal o página según el tamaño del formulario.
- Sustitución de las confirmaciones de éxito persistentes por notificaciones temporales.
- Adaptación a escritorio, tableta y teléfono, accesibilidad y movimiento reducido.
- Recursos tipográficos servidos localmente.
- Catálogo visual interno, pruebas visuales y de accesibilidad, y documentación de interfaz afectada.

## Fuera de alcance

- Cambios de negocio, permisos, roles, rutas, contratos HTTP, API, backend, modelos, migraciones o persistencia.
- Nuevas funciones visibles en la maqueta que no existen hoy, entre ellas:
  - la búsqueda global por placa, cliente, código o comprobante de la barra superior;
  - los indicadores de resumen de la lista de ventas («Vendido hoy», «Por cobrar»…) cuando no exista un dato del servidor que los respalde;
  - umbrales de «stock bajo» (ver «Contradicciones»);
  - atajos de teclado nuevos, exportaciones y pestañas de ficha sin contenido disponible.

  Cada una requiere su propio cambio OpenSpec.
- Implementar el tema oscuro o un selector de tema.
- Rediseñar el logotipo o cambiar el nombre técnico del repositorio.
- Pantallas de módulos todavía no implementados (proformas, mantenimientos, reportes, cierres); adoptarán el sistema cuando se especifiquen.

## Usuarios afectados

**Administrador**, **Vendedor** y **Encargado del taller** verán una interfaz nueva en todas las pantallas:
- más densidad de información;
- navegación con etiquetas en escritorio;
- modales para los formularios cortos;
- confirmaciones temporales en lugar de franjas fijas.

La visibilidad de opciones y acciones sigue dependiendo exclusivamente de los permisos que entrega el backend.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md` (completos).
- `openspec/specs/sistema-visual-frontend/spec.md`, `openspec/specs/experiencia-adaptable-frontend/spec.md` y `openspec/specs/catalogo-visual-reutilizable/spec.md`.
- `docs/negocio/requisitos/interfaz-y-navegacion.md` (secciones 2, 4, 5, 8, 10, 11 y 13) y `docs/negocio/requisitos/requisitos-no-funcionales.md` (`RNF-USA-001`…`012`, `RNF-DIS-001`, `RNF-COM-004`, `RNF-COM-005`, `RNF-MAN-003`, `RNF-MAN-005`).
- `docs/negocio/producto/vision.md`.
- Artefactos del cambio cancelado `aplicar-catalogo-visual-frontend`, antes de retirarlo.
- Código del frontend: navegación, `ProductForm`, catálogos auxiliares, diálogos de ventas y los 14 archivos que muestran hoy confirmaciones de éxito persistentes.
- Maqueta Tallkit aprobada por el usuario, con los tableros Fundamentos, Nueva venta, Lista de ventas, Ficha de vehículo, Nuevo producto, Formulario corto en modal, Diálogos de ventas, Estados, Tableta, Teléfono y Toasts.

## Decisiones confirmadas por el usuario (2026-09-21)

1. Diseño propio adaptado al negocio; no copiar plantillas de terceros.
2. Acento petróleo sobre la base azul marino y naranja del logotipo.
3. Tipografía IBM Plex Sans para la interfaz, con IBM Plex Mono para códigos. Se descartaron Barlow y Archivo tras compararlas.
4. Nombre visible **Tallkit** y logotipo existente.
5. Tema oscuro solo preparado en tokens, para una versión posterior.
6. Formularios cortos en modal y largos en página; se retira el panel lateral de edición.
7. Confirmaciones de éxito mediante toast abajo a la derecha.
8. Cancelar `aplicar-catalogo-visual-frontend` y reemplazar la base visual vigente.
9. «Tallkit» es el nombre visible del producto en la interfaz y en `vision.md`; «Sys-Taller»/«Sys-Inventario» se conserva como nombre técnico del repositorio.
10. Los botones de acciones críticas usan textos breves que nombran la acción, por ejemplo «Confirmar venta», para no romper la composición. El efecto de la acción se explica en el cuerpo del diálogo de confirmación, que sigue indicando objeto, entidad fiscal, efecto y motivo cuando aplique.
11. Entrega por fases con revisión visual intermedia:
    1. Fundamentos y marco de la aplicación.
    2. Componentes compartidos.
    3. Piloto con una lista, una ficha, un formulario y el editor de venta, que el usuario revisa antes de seguir, directamente en la aplicación o mediante capturas si las solicita.
    4. Resto de módulos.
12. Se usa modal para formularios de hasta unos cuatro campos simples y sin secciones, como marcas, categorías y unidades de medida, y también para formularios sin secciones que dejarían vacía una página completa, como el de usuario. La clasificación de cada formulario se fija en las specs.
13. Los toasts duran 6 segundos, se pausan al pasar el cursor o enfocarlos, se pueden cerrar y se muestran hasta tres a la vez.
14. Cerrar un modal con datos modificados advierte de los cambios sin guardar (`RNF-USA-005`).
15. La validación visual final la realiza el usuario directamente en la aplicación. Las capturas comparativas no son un entregable obligatorio y su ausencia no bloquea el cierre del cambio.

## Contradicciones y brechas detectadas

- **Stock bajo:** la maqueta muestra «Stock bajo», pero las alertas de umbral de existencia (`RF-INV-011`) siguen sin decidir. Este cambio solo mostrará la cantidad disponible y el estado «Agotado» cuando sea cero, sin inventar umbrales.
- **Barra lateral:** la sección 2.1 de `interfaz-y-navegacion.md` y el spec `experiencia-adaptable-frontend` fijan una barra de 80 px en escritorio, mientras que la sección 10 del mismo documento pide navegación expandida en escritorio. Este cambio adopta la expandida y actualizará ambos documentos.
- **Panel lateral:** `experiencia-adaptable-frontend` y la sección 10 describen paneles laterales para formularios breves y «tarjetas» para filas en teléfono. Los nuevos patrones usan modal y filas compactas; los documentos se actualizarán.
- **Tipografía:** la spec vigente exige Nunito; se reemplaza.
- **Recursos locales:** el requisito de recursos disponibles en la red local se conserva. IBM Plex debe servirse desde la instalación y no desde un servicio público, aunque la maqueta la cargue desde Google Fonts.
- **Texto de los botones críticos:** la sección 8.1 de `interfaz-y-navegacion.md` pide textos que describan el efecto, por ejemplo «Confirmar venta y descontar stock». Por la decisión 10 se usarán textos breves y el efecto se explicará en el cuerpo del diálogo; la sección 8.1 se actualizará.
- **Mensaje de éxito:** la sección 8.2 define el mensaje de éxito con acceso al documento creado. El toast lo cumple mediante su enlace «Ver».

## Cambio cancelado

`aplicar-catalogo-visual-frontend` se retiró de `openspec/changes/` por decisión del usuario, sin archivarlo, porque no se completará: tenía 20 tareas terminadas y 8 pendientes. Su historia se conserva en git.

Parte de su trabajo ya está en `master`: la barra lateral desplegada de 218 px, los ajustes de `MetricCard` y `DropdownMenu`, los estados de evidencia del catálogo y las pruebas asociadas. Este cambio sustituirá ese resultado; no se revierte por separado.

## Dependencias

- Se aplica sobre `master` después de integrar el cambio activo `gestionar-ventas-pagos-credito-simple`, cuyas pantallas de ventas todavía están en curso en `develop`. Un rediseño previo del editor de ventas en esa rama, anterior a la maqueta Tallkit, será sustituido por este cambio.
- Requiere servir localmente IBM Plex Sans e IBM Plex Mono (licencia SIL Open Font License). La forma de incorporarlas se decidirá en el design, conforme a la política de dependencias.
- Afecta las pruebas e2e visuales `figma-fidelity`, `visual-system`, `catalogs-styles` y `visual-evidence`, que dependen de la referencia retirada.

## Riesgos

- **Alcance amplio:** tocar todas las páginas puede alterar comportamientos por accidente. Se mitiga preservando las pruebas funcionales, entregando por fases y reemplazando solo la presentación.
- **Contraste insuficiente** en tonos claros (petróleo suave, naranja, estados). Se mitiga con verificación automática de accesibilidad y porque el naranja nunca se usa como texto.
- **Pérdida de contexto al retirar los paneles laterales:** se mitiga con modales para formularios cortos y la advertencia de cambios sin guardar.
- **Toasts que el usuario no llega a leer:** se mitiga con la pausa al pasar el cursor, el anuncio accesible y porque los errores nunca se muestran solo como toast.
- **Nuevas funciones sugeridas por la maqueta:** se mitiga declarándolas fuera de alcance, con un cambio propio para cada una.

## Impact

- **Frontend:** estilos y tokens globales, marco autenticado, acceso, componentes compartidos, componentes de cada módulo, las 33 páginas actuales, el catálogo visual interno y las pruebas unitarias, e2e y de accesibilidad afectadas.
- **Backend, API, datos y permisos:** sin cambios.
- **Documentación:** `interfaz-y-navegacion.md` (secciones 2.1, 8.1 y 10), `vision.md` (nombre visible), specs principales afectadas, glosario técnico si aparecen términos nuevos y matriz de trazabilidad.
- **Operación:** sin cambios de despliegue salvo los archivos de fuentes locales.
