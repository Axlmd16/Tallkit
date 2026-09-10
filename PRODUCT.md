# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

El producto es utilizado por personal interno del taller con los roles **Administrador**, **Vendedor** y **Encargado del taller**. La computadora es el dispositivo principal para tareas extensas; la tableta tiene importancia operativa para consulta y captura, y el teléfono debe conservar los flujos esenciales.

## Product Purpose

Centralizar la operación comercial de repuestos y el trabajo del taller automotriz, compartiendo usuarios, clientes y vehículos sin mezclar las operaciones económicas de los dos contribuyentes. El éxito consiste en ejecutar el trabajo diario con rapidez, trazabilidad y claridad desde la red local.

## Positioning

Una sola herramienta relaciona mantenimientos y repuestos mientras conserva claramente separados el **RUC comercial** y el **RUC artesanal**, sus documentos, pagos, saldos y reportes.

## Operating Context

La aplicación se utiliza durante la jornada en computadoras, tabletas y teléfonos conectados a la red local del taller. Sus usuarios consultan y editan listas, formularios, documentos, estados y operaciones que pueden afectar inventario o dinero; necesitan reconocer rápidamente el ámbito fiscal, el estado y la acción disponible.

## Capabilities and Constraints

- React, TypeScript, Vite y Tailwind CSS en el frontend; Django REST Framework y PostgreSQL en el backend.
- Tres roles internos fijos y acumulables; el backend es la autoridad de autorización.
- Una sola **bodega** en V1, inventario sin valores negativos y **Kardex** trazable.
- Separación estricta de las operaciones económicas del **RUC comercial** y **RUC artesanal**.
- Instalación inicial en red local; los recursos esenciales de la interfaz no pueden depender de Internet.
- Interfaz utilizable desde 360 px hasta escritorio, con orientación a WCAG 2.2 AA.
- Los requisitos completos y su precedencia permanecen en `docs/`; este archivo no los sustituye.

## Brand Commitments

El nombre técnico provisional es Sys-Inventario. El usuario prefiere interfaces limpias, claras, sobrias y de alta legibilidad, con navegación compacta, jerarquía precisa y poco ruido visual, según las cuatro capturas de referencia proporcionadas el 10 de septiembre de 2026. No existe todavía nombre comercial, logotipo ni manual de marca definitivo.

## Evidence on Hand

- Documentación aprobada bajo `docs/` y specs principales bajo `openspec/specs/`.
- Capacidad funcional de identidad y acceso ya implementada en `frontend/src/`.
- Cuatro capturas visuales de referencia ubicadas en `/home/axlmd/Descargas/`.
- No existen todavía fotografías corporativas, logotipo definitivo ni activos de marca que deban presentarse como oficiales.

## Product Principles

1. Claridad operativa antes que decoración.
2. Separación fiscal visible sin duplicar la navegación.
3. Acciones críticas explícitas y trazables.
4. Densidad útil en computadora con adaptación real para interacción táctil.
5. Un lenguaje visual común para todas las capacidades futuras.

## Accessibility & Inclusion

La interfaz debe orientarse a WCAG 2.2 AA, funcionar con teclado, ofrecer foco visible, controles táctiles adecuados, texto legible, estados redundantes al color y movimiento reducible.
