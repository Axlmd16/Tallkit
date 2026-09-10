## Why

El frontend ya permite ejecutar la primera capacidad funcional, pero su apariencia oscura provisional, sus patrones visuales repetidos y la ausencia de un sistema de diseño documentado dificultan mantener una experiencia coherente al incorporar las siguientes áreas del taller. Antes de ampliar el producto, se necesita una base visual limpia, operativa y adaptable que funcione principalmente en computadora y tableta, sin degradarse en teléfono.

## What Changes

### Objetivo y alcance

- Establecer una dirección visual propia para una herramienta de operación del taller, inspirada en las referencias limpias aportadas por el usuario, sin copiarlas ni adoptar una apariencia genérica de producto SaaS.
- Definir un sistema visual reutilizable para color, tipografía, iconografía, espaciado, jerarquía, bordes, elevación, movimiento y estados interactivos.
- Definir patrones comunes para navegación, encabezados, botones, formularios, filtros, tablas, distintivos de estado, avisos, confirmaciones, diálogos y estados de carga, vacío y error.
- Reorganizar el marco autenticado para ofrecer navegación lateral en escritorio, una adaptación apropiada para tableta y un mecanismo compacto y accesible en teléfono.
- Aplicar la nueva base visual a las pantallas existentes de acceso, cambio de contraseña, inicio, usuarios, auditoría y estado técnico, preservando sus permisos y comportamiento funcional.
- Diferenciar de forma visible el ámbito de una futura operación del **RUC comercial** o del **RUC artesanal** mediante texto e indicadores redundantes, sin usar el color como única señal.
- Validar la experiencia desde 360 px hasta escritorio, con controles táctiles adecuados, navegación por teclado, foco visible, contraste orientado a WCAG 2.2 AA y reducción de movimiento.
- Documentar la dirección aprobada y los criterios de uso para que las futuras capacidades reutilicen el mismo lenguaje visual.

### Reutilización, modificación y sustitución

- Se reutilizarán React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query y el comportamiento funcional ya verificado.
- Se reorganizarán los estilos y componentes de presentación existentes alrededor de tokens y patrones compartidos, sin trasladar reglas del negocio al frontend.
- La apariencia temporal oscura `slate/cyan` dejará de ser la referencia visual objetivo; la nueva dirección se decidirá mediante comparación y prototipado antes de implementarse.
- Las capturas aportadas son referencias de limpieza, densidad y jerarquía, no activos que deban copiarse ni reproducirse literalmente.

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
- Recomendación todavía no aprobada: adoptar una dirección clara y sobria de “taller de precisión”, con color reservado para acciones, ámbitos y estados significativos. La paleta, tipografía, familia de iconos y geometría exactas se resolverán y someterán a aprobación durante el diseño.
- Contradicción encontrada: el frontend provisional declara exclusivamente un esquema oscuro, mientras las referencias elegidas y la necesidad de lectura prolongada orientan la exploración hacia una interfaz principalmente clara. No existe una decisión vigente que obligue a conservar el esquema actual.
- Información insuficiente aplazable: no existe todavía nombre comercial, logotipo ni manual de marca definitivos; el sistema visual debe poder incorporarlos después sin bloquear este cambio.

## Capabilities

### New Capabilities

- `sistema-visual-frontend`: Lenguaje visual reutilizable para tokens, tipografía, iconografía, componentes, estados y documentación de la interfaz operativa.
- `experiencia-adaptable-frontend`: Comportamiento observable del marco, navegación, formularios y datos en computadora, tableta y teléfono, con requisitos de accesibilidad e interacción.

### Modified Capabilities

Ninguna. La especificación principal del modelo de dominio no cambia y el comportamiento funcional de identidad se conserva.

## Impact

- **Frontend:** afectará estilos globales, marco autenticado, navegación y componentes de presentación usados por las pantallas existentes; no cambiará la autoridad del backend ni los contratos HTTP.
- **Experiencia:** sustituirá la apariencia provisional por una base coherente y reducirá la duplicación visual antes de añadir nuevas áreas funcionales.
- **Documentación:** incorporará una referencia duradera del producto y del sistema visual aprobado, además de mantener trazabilidad con los requisitos de interfaz y accesibilidad.
- **Dependencias:** cualquier fuente o biblioteca de iconos propuesta deberá funcionar en la instalación local, tener licencia compatible y justificar su incorporación durante el diseño; no se aprueba ninguna dependencia mediante esta propuesta.
- **Pruebas:** requerirá pruebas de componentes y flujos existentes, verificación visual en anchos representativos, navegación por teclado, contraste, estados interactivos y build del frontend.
- **Riesgos:** perder densidad útil por priorizar una estética demasiado espaciosa, ocultar acciones importantes en teléfono, confundir los dos ámbitos fiscales, producir inconsistencias entre pantallas o depender de recursos externos no disponibles en la red local.

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
