## Why

La documentación vigente describe buena parte del negocio, pero conserva contradicciones, decisiones marcadas como pendientes y vacíos descubiertos durante la entrevista de dominio. Es necesario consolidar un **modelo de dominio** conceptual aprobado antes de redactar nuevas especificaciones funcionales o diseñar el modelo de datos.

## What Changes

- Crear `docs/arquitectura/modelo-dominio.md` como descripción conceptual única del dominio aprobado, con contextos, glosario, agregados, estados, invariantes, eventos, decisiones, riesgos y un solo diagrama de clases Mermaid.
- Actualizar los documentos vigentes de negocio, requisitos y arquitectura que contradigan las decisiones confirmadas o el modelo aprobado.
- Incorporar las decisiones descubiertas sobre presentaciones cerradas, kits comprados, reservas exclusivas para mantenimientos, consumos internos, correcciones sin cargo, pagos simples, devoluciones, documentos internos y cierres separados por RUC.
- Distinguir expresamente **existencia**, **disponibilidad**, **reserva** y **movimiento de Kardex**.
- Mantener separados el **RUC comercial** y el **RUC artesanal**, compartiendo únicamente clientes, vehículos y usuarios.
- Registrar como pendientes de validación contable o normativa los asuntos fiscales que no pueden resolverse como decisiones técnicas.
- Excluir código, modelos Django, migraciones, tablas, endpoints, componentes React, pruebas de software y `modelo-datos.md`.

## Capabilities

### New Capabilities

- `modelo-dominio-taller`: Define el modelo conceptual del taller y exige coherencia entre la documentación vigente y las decisiones aprobadas.

### Modified Capabilities

Ninguna. Actualmente no existen especificaciones principales en `openspec/specs/`.

## Impact

- Documentación afectada: `docs/negocio/decisiones/`, `docs/negocio/producto/`, `docs/negocio/requisitos/`, documentación arquitectónica aplicable y el nuevo `docs/arquitectura/modelo-dominio.md`.
- OpenSpec: se incorpora una especificación inicial del dominio como base de futuros cambios funcionales.
- ADR: se evaluarán las decisiones transversales; solo se crearán ADR si documentan una decisión arquitectónica duradera y no una regla puramente de negocio.
- Código, API, base de datos, dependencias y despliegue: sin cambios.
