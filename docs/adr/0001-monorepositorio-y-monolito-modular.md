# ADR-0001: Monorepositorio y monolito modular

- Estado: Aceptada
- Fecha: 2026-09-08

## Contexto

La primera versión operará en la red local, será mantenida como un solo producto y debe permitir
evolucionar capacidades estrechamente relacionadas sin la complejidad operativa de servicios
distribuidos. La documentación exige fronteras explícitas y descarta microservicios en V1.

## Decisión

Mantener un monorepositorio con `backend`, `frontend`, `docs`, `openspec` e `infra`. El backend será
una única aplicación Django desplegable, organizada en aplicaciones por capacidad del negocio.
Solo se crearán módulos cuando su dominio se especifique; compartirán la base PostgreSQL, pero se
comunicarán mediante servicios e interfaces públicas y evitarán mutaciones directas entre módulos.

El frontend se organiza por capacidad (`features`) y composición (`app`, `pages`, `shared`), sin
carpetas de negocio vacías durante el bootstrap.

## Alternativas consideradas

- Repositorios separados: aumenta coordinación y dificulta cambios atómicos de contrato.
- Microservicios: añade red, despliegues y consistencia distribuida sin necesidad actual.
- Una sola aplicación Django sin fronteras: comienza simple, pero concentra acoplamiento y reglas.
- Arquitectura hexagonal completa: aporta demasiadas capas antes de conocer el dominio.

## Consecuencias

Los cambios coordinados se revisan y verifican juntos y el despliegue local es sencillo. Las
fronteras dependerán de disciplina y pruebas; una dependencia transversal nueva deberá justificarse.
La migración futura a nube no exige separar procesos. Extraer un servicio solo se reconsiderará con
evidencia operativa y un nuevo ADR.

## Referencias

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`
- `docs/negocio/requisitos/requisitos-no-funcionales.md` (`RNF-MAN-001`)
- `docs/tecnico/arquitectura-inicial.md`
- [Referencia terminológica](0001-monorepositorio-y-monolito-modular-glossary-reference.md)
