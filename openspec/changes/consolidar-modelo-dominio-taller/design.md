## Context

El repositorio contiene decisiones confirmadas, visión, alcance, reglas, glosario, requisitos y arquitectura técnica, pero todavía no dispone de un modelo conceptual aprobado. Parte de la documentación inferior conserva decisiones antiguas, menciona funcionalidades excluidas o no incorpora comportamientos confirmados durante la exploración del dominio.

La fuente de mayor precedencia es `docs/negocio/decisiones/decisiones-confirmadas.yaml`. Los documentos históricos no representan la arquitectura objetivo. El cambio es exclusivamente documental y antecede al diseño de datos y a la implementación funcional.

## Goals / Non-Goals

**Goals:**

- Crear un **modelo de dominio** conceptual único, comprensible y trazable.
- Consolidar la separación entre el **RUC comercial** y el **RUC artesanal**.
- Representar entidades, objetos de valor, agregados, catálogos, operaciones, estados, invariantes, eventos y conceptos calculados.
- Corregir contradicciones en los documentos vigentes sin usar el sistema histórico como requisito.
- Mantener un único diagrama de clases Mermaid con agrupaciones y cardinalidades.
- Registrar decisiones aplazadas y asuntos que requieren validación contable o normativa.

**Non-Goals:**

- Diseñar tablas, claves foráneas, modelos Django, migraciones o endpoints.
- Implementar código, pantallas o pruebas de software.
- Crear `modelo-datos.md`.
- Implementar contabilidad, cuentas por pagar o facturación electrónica.
- Crear un módulo completo de garantías, planes de pago o kits armados por el taller.

## Decisions

### Una fuente conceptual y actualización coordinada

Se creará `docs/arquitectura/modelo-dominio.md` y se actualizarán los documentos vigentes que entren en contradicción. El modelo no reemplazará las decisiones confirmadas: las resumirá y mantendrá trazabilidad hacia ellas.

Alternativa descartada: crear el modelo sin corregir documentos anteriores. Mantendría varias respuestas incompatibles para una misma regla.

### Modelo de dominio, no modelo de persistencia

El documento clasificará conceptos por responsabilidad de negocio y límites de consistencia. No incluirá tablas, identificadores técnicos, claves foráneas ni detalles propios de Django.

Alternativa descartada: convertir cada sustantivo en una entidad. Aumentaría complejidad y condicionaría prematuramente el diseño de datos.

### Un único diagrama de clases

Se usará Mermaid `classDiagram`, organizado mediante espacios de nombres. El diagrama mostrará relaciones, cardinalidades, agregados y estados relevantes, pero los flujos detallados permanecerán en texto para conservar legibilidad.

Alternativa descartada: dividir el dominio en varios diagramas independientes, porque el objetivo aprobado exige visualizar las relaciones entre todos los contextos.

### Separación fiscal con referencias entre contextos

Las operaciones económicas, documentos, pagos, impuestos, secuencias y cierres pertenecerán a una sola entidad fiscal. Los vínculos entre mantenimiento artesanal y venta comercial serán referencias explícitas y no composición dentro de un mismo agregado.

Alternativa descartada: un documento único de atención. Mezclaría operaciones pertenecientes a contribuyentes distintos.

### Existencia, reserva y Kardex como conceptos distintos

La **existencia** expresa unidades registradas; la **reserva de mantenimiento** reduce únicamente la disponibilidad; el **movimiento de Kardex** explica toda variación física confirmada. Las proformas y ventas directas en borrador no reservan.

Alternativa descartada: descontar inventario al seleccionar un repuesto en el mantenimiento. Confundiría asignación temporal con salida definitiva.

### Correcciones mediante operaciones trazables

Los documentos y movimientos confirmados serán inmutables. Anulaciones, devoluciones, reembolsos, ajustes y reposiciones por corrección conservarán el original y producirán los efectos compensatorios necesarios.

Alternativa descartada: editar o eliminar operaciones confirmadas. Impediría reconstruir dinero, inventario y responsabilidades.

### ADR únicamente para decisiones arquitectónicas duraderas

Las reglas descubiertas son principalmente decisiones de negocio y se documentarán en el modelo, decisiones confirmadas y requisitos. No se creará un ADR para cada regla. La coordinación transaccional futura de reservas, confirmación y Kardex será candidata a ADR cuando exista un diseño técnico con alternativas de implementación reales.

## Risks / Trade-offs

- [La actualización alcanza numerosos documentos] → Usar búsqueda terminológica, matriz de trazabilidad y revisión de diferencias para evitar cambios parciales.
- [El único diagrama puede resultar grande] → Agrupar por contextos, limitar atributos a los relevantes y explicar el detalle en texto.
- [La reserva de mantenimiento es nueva respecto de algunos requisitos] → Actualizar explícitamente disponibilidad, confirmación y cierre del mantenimiento.
- [La corrección sin cargo relaciona dos RUC] → Documentar la operación y dejar pendiente el tratamiento fiscal y contable para un profesional competente.
- [La venta de presentaciones completas simplifica cantidades] → Mantener `Cantidad` y `Unidad de medida` como objetos conceptuales para no impedir una evolución futura controlada.
- [El precio final incluye IVA] → Conservar también base, tarifa e impuesto históricos y definir reglas de redondeo en una especificación posterior.
- [La documentación puede confundirse con aprobación de implementación] → Declarar expresamente que este cambio no autoriza modelos de datos ni código.

## Migration Plan

1. Inventariar las afirmaciones afectadas en las fuentes vigentes, excluyendo históricos.
2. Crear el modelo conceptual y su único diagrama Mermaid.
3. Actualizar decisiones, visión, alcance, reglas, glosario, actores, requisitos, casos de uso, interfaz y trazabilidad aplicables.
4. Revisar que no permanezcan marcas de decisiones pendientes ya resueltas ni referencias a descuentos en V1.
5. Validar enlaces, sintaxis Mermaid, terminología y trazabilidad.
6. Revisar el cambio documental completo antes de considerarlo fuente para futuras especificaciones.

La reversión consiste en revertir únicamente los cambios documentales de este cambio; no existe migración de datos ni despliegue.

## Open Questions

- Tratamiento fiscal y contable de reposiciones sin cargo y consumos internos entre los dos RUC.
- Tarifas y clasificación tributaria reales de productos y servicios.
- Formatos exactos de series y secuencias internas.
- Requisitos legales futuros de consumidor final y facturación electrónica.
- Reglas de redondeo requeridas por la integración fiscal futura.
