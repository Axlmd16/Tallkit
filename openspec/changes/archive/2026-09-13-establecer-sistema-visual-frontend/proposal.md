## Why

El frontend ya permite ejecutar la primera capacidad funcional, pero la primera implementación visual de este cambio, denominada “Hoja de taller de precisión”, no representa la experiencia aprobada por el usuario. Su apariencia austera, técnica y basada en divisores se aleja de la referencia elegida: el archivo de Figma Community **SAAS Dashboard** de Jiangyu. Antes de ampliar el producto, se debe sustituir esa dirección por una interfaz luminosa, elegante, amable y adaptable, con la misma claridad compositiva y densidad equilibrada de la referencia, aplicada al contenido real de Sys-Taller.

## What Changes

### Objetivo y alcance

- Establecer una dirección visual para la herramienta de operación del taller que reproduzca fielmente el lenguaje visual del archivo **SAAS Dashboard**: lienzo gris-lavanda muy claro, superficies blancas, tinta azul marino, acento violeta, iconografía suave, tarjetas y filas elevadas, radios amables, estados pastel y espacios generosos sin perder densidad operativa.
- Usar la copia completa del archivo de Figma proporcionada por el usuario como autoridad visual para proporciones, jerarquía, espaciado, geometría, color, elevación y patrones de composición; adaptar su contenido a Sys-Taller y no copiar su nombre “Base”, su logotipo, personajes, fotografías ni textos de demostración.
- Definir un sistema visual reutilizable para color, tipografía, iconografía, espaciado, jerarquía, bordes, elevación, movimiento y estados interactivos.
- Definir patrones comunes para navegación, encabezados, botones, formularios, filtros, tarjetas de indicadores, tablas, filas elevadas, distintivos de estado, avisos, confirmaciones, diálogos, paneles laterales y estados de carga, vacío y error.
- Reorganizar el marco autenticado para ofrecer navegación lateral en escritorio, una adaptación apropiada para tableta y un mecanismo compacto y accesible en teléfono.
- Aplicar la nueva base visual a las pantallas existentes de acceso, cambio de contraseña, inicio, usuarios, auditoría y estado técnico, preservando sus permisos y comportamiento funcional. El acceso seguirá el patrón dividido de la referencia en escritorio y se simplificará a una sola columna en pantallas estrechas.
- Diferenciar de forma visible el ámbito de una futura operación del **RUC comercial** o del **RUC artesanal** mediante texto e indicadores redundantes, sin usar el color como única señal.
- Validar la experiencia desde 360 px hasta escritorio, con controles táctiles adecuados, navegación por teclado, foco visible, contraste orientado a WCAG 2.2 AA y reducción de movimiento.
- Documentar la dirección aprobada y los criterios de uso para que las futuras capacidades reutilicen el mismo lenguaje visual.

### Reutilización, modificación y sustitución

- Se reutilizarán React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query y el comportamiento funcional ya verificado.
- Se reorganizarán los estilos y componentes de presentación existentes alrededor de tokens y patrones compartidos, sin trasladar reglas del negocio al frontend.
- La apariencia temporal oscura `slate/cyan` y la posterior dirección “Hoja de taller de precisión” dejan de ser referencias visuales objetivo.
- La estructura funcional, accesibilidad, comportamiento adaptable y primitivas reutilizables de la primera implementación podrán conservarse cuando sean compatibles; sus decisiones estéticas serán sustituidas, no mezcladas con la nueva dirección.
- Las capturas y la copia completa del archivo de Figma son referencias normativas de apariencia. Sus estilos y patrones se reproducirán de forma cercana, mientras los activos identificativos y el contenido se reemplazarán por material propio de Sys-Taller.

### Fuera de alcance

- Nuevas funciones de clientes, vehículos, productos, servicios, proveedores, inventario, Kardex, proformas, ventas, pagos o mantenimientos.
- Cambios en autenticación, permisos, contratos API, modelos, migraciones o reglas del dominio.
- Creación de una aplicación móvil nativa o funcionamiento sin conexión.
- Sitio público, página de marketing, portal para clientes o identidad corporativa completa.
- Un tema oscuro alternativo, selector de temas o personalización visual por usuario en esta etapa.
- Un logotipo definitivo, fotografías comerciales o afirmaciones publicitarias no proporcionadas por el negocio.

### Usuarios afectados

- El **Administrador**, el **Vendedor** y el **Encargado del taller** utilizarán una estructura común, pero verán únicamente la navegación y las acciones permitidas por sus permisos.
- La computadora será la referencia principal para tareas extensas; la tableta tendrá importancia operativa equivalente para consulta y captura; el teléfono conservará todos los flujos esenciales con una presentación adecuada a su ancho.

### Decisiones, trazabilidad y estado de la información

- Decisiones confirmadas preservadas: `CT-001` mantiene los tres roles fijos y la autorización obligatoria del backend; la separación fiscal exige distinguir claramente los dos RUC en toda interfaz económica.
- Requisitos aplicables: `RNF-USA-001` a `RNF-USA-011`, `RNF-COM-001`, `RNF-COM-002`, `RNF-MAN-003` y `RNF-MAN-005`.
- Pantallas y patrones aplicables: secciones 1 a 5, 8, 10 y 13 de `interfaz-y-navegacion.md`, además de `UI-001`, `UI-002`, `UI-010`, `UI-011`, `UI-018` y `UI-082` ya representadas total o parcialmente en el frontend.
- Casos de uso inicialmente visibles: `CU-001` y `CU-002`; las futuras pantallas deberán heredar el sistema sin adelantar sus capacidades funcionales.
- Dirección aprobada por el usuario: reemplazar “Hoja de taller de precisión” por una adaptación fiel de **SAAS Dashboard**, manteniendo una experiencia elegante, simple, amigable y con saturación visual moderada.
- Contradicción encontrada: la spec vigente de experiencia adaptable favorece una tabla continua en escritorio y desaconseja convertir cada registro en una tarjeta aislada; la nueva referencia usa filas blancas independientes, redondeadas y ligeramente elevadas. La spec deberá permitir este patrón cuando preserve comparación, alineación y densidad.
- Contradicción encontrada: el design vigente limita las sombras a superposiciones y reserva las tarjetas para agrupaciones excepcionales, mientras la nueva referencia construye su jerarquía principal mediante superficies elevadas suaves. Esas decisiones deberán sustituirse en el siguiente artefacto de diseño.
- Información insuficiente aplazable: no existe todavía nombre comercial, logotipo ni manual de marca definitivos; el sistema visual debe poder incorporarlos después sin bloquear este cambio.

## Capabilities

### New Capabilities

- `sistema-visual-frontend`: Lenguaje visual reutilizable para tokens, tipografía, iconografía, componentes, estados y documentación de la interfaz operativa.
- `experiencia-adaptable-frontend`: Comportamiento observable del marco, navegación, formularios y datos en computadora, tableta y teléfono, con requisitos de accesibilidad e interacción.

### Modified Capabilities

Ninguna. La especificación principal del modelo de dominio no cambia y el comportamiento funcional de identidad se conserva.

## Impact

- **Frontend:** afectará estilos globales, marco autenticado, navegación, acceso, composición de páginas y componentes de presentación usados por las pantallas existentes; no cambiará la autoridad del backend ni los contratos HTTP.
- **Experiencia:** sustituirá tanto la apariencia provisional como la primera implementación rechazada por una adaptación coherente de la referencia de Figma antes de añadir nuevas áreas funcionales.
- **Documentación:** incorporará una referencia duradera del producto y del sistema visual aprobado, además de mantener trazabilidad con los requisitos de interfaz y accesibilidad.
- **Dependencias:** cualquier fuente o biblioteca de iconos propuesta deberá funcionar en la instalación local, tener licencia compatible y justificar su incorporación durante el diseño; no se aprueba ninguna dependencia mediante esta propuesta.
- **Pruebas:** requerirá pruebas de componentes y flujos existentes, verificación visual en anchos representativos, navegación por teclado, contraste, estados interactivos y build del frontend.
- **Riesgos:** copiar estructuras decorativas que no correspondan al taller, perder densidad útil por priorizar una estética demasiado espaciosa, degradar las filas elevadas en pantallas estrechas, ocultar acciones importantes en teléfono, confundir los dos ámbitos fiscales, reproducir activos ajenos o depender de recursos externos no disponibles en la red local.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`.
- `docs/arquitectura/modelo-dominio.md`.
- `docs/negocio/producto/vision.md`, `alcance-v1.md` y `glosario.md`.
- `docs/negocio/requisitos/actores-y-roles.md`, `casos-de-uso.md`, `interfaz-y-navegacion.md`, `requisitos-funcionales.md`, `requisitos-no-funcionales.md` y `matriz-trazabilidad.md`.
- `docs/tecnico/arquitectura-inicial.md` y `glosario-tecnico.md`.
- `docs/architecture/c4-context.md`, `c4-containers.md` y ADR vigentes.
- `openspec/specs/modelo-dominio-taller/spec.md`.
- Implementación actual bajo `frontend/src/`, configuración de Tailwind CSS y pruebas existentes.
- Capturas de referencia proporcionadas por el usuario: `Screenshot_20260910_000900_TikTok.jpg`, `Screenshot_20260910_000848_TikTok.jpg`, `Screenshot_20260910_000840_TikTok.jpg` y `Screenshot_20260910_000832_TikTok.jpg`.
- Dieciocho capturas adicionales proporcionadas por el usuario del kit **SAAS Dashboard**, que cubren dashboard, listas, calendario, tareas, paneles laterales, diálogos, acceso, recuperación, confirmación y chat.
- Copia completa de Figma Design facilitada por el usuario: `SAAS Dashboard (Community)`, archivo `GRvgnODulXXrLTz4BsaToK`, inspeccionado visualmente en modo de solo lectura.
