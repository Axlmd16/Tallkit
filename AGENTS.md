# Guía para agentes

## Inicio obligatorio

Antes de analizar, especificar o implementar una capacidad:

1. Lea completos `docs/negocio/decisiones/decisiones-confirmadas.yaml` y
   `docs/arquitectura/modelo-dominio.md`.
2. Lea la spec principal y los documentos de producto y requisitos relacionados con el área.
3. Lea la arquitectura técnica y los ADR aplicables cuando el cambio afecte diseño o plataforma.
4. Si existe un cambio OpenSpec activo, lea todos sus artefactos anteriores antes de continuarlo.
5. Indique las fuentes consultadas y registre contradicciones o información insuficiente.

No cargue indiscriminadamente documentos históricos. `docs/negocio/historico/` y el sistema
Flutter anterior solo explican el pasado; no definen requisitos ni arquitectura objetivo.

## Estructura documental y del repositorio

- `docs/negocio/decisiones/`: decisiones confirmadas y asuntos todavía abiertos.
- `docs/arquitectura/modelo-dominio.md`: modelo conceptual aprobado; no es modelo de datos.
- `docs/negocio/producto/`: visión, alcance, reglas y glosario del negocio.
- `docs/negocio/requisitos/`: roles, requisitos, casos de uso, interfaz y trazabilidad.
- `docs/tecnico/` y `docs/architecture/`: arquitectura técnica vigente y diagramas C4.
- `docs/adr/`: decisiones arquitectónicas duraderas aceptadas.
- `openspec/specs/`: línea base de comportamiento aprobada.
- `openspec/changes/`: cambios activos; `openspec/changes/archive/` conserva su historia.
- `backend/`: Django/DRF, configuración y pruebas; el dominio funcional aún no está implementado.
- `frontend/`: React/Vite, página técnica y pruebas.
- `infra/` y `compose.yaml`: despliegue y desarrollo local.

## Fuentes y precedencia

Las decisiones confirmadas tienen máxima precedencia. Una spec principal aprobada puede concretar
documentos anteriores, pero nunca contradecir una decisión confirmada. Después se aplican producto,
requisitos, arquitectura y código existente, en ese orden. Si una fuente inferior contradice otra
superior, siga la superior y registre la brecha; no cambie el negocio para acomodarlo al código.

El **modelo de dominio** aprobado es la fuente conceptual para entidades, objetos de valor,
agregados, estados, relaciones e invariantes. No lo convierta directamente en tablas. No cree ni
modifique `modelo-datos.md`, modelos de negocio, tablas o migraciones antes de que la capacidad
correspondiente tenga propuesta, specs y diseño aprobados mediante **OpenSpec**.

## Flujo OpenSpec y Git

- Use OpenSpec para funcionalidades, cambios de comportamiento y decisiones arquitectónicas no triviales.
- Durante descubrimiento use `grill-me` solo para ambigüedades que cambien el negocio; no pregunte lo ya documentado.
- Respete la secuencia `proposal → specs → design → tasks → apply → verify → archive` y las aprobaciones requeridas en `openspec/config.yaml`.
- Un artefacto aprobado debe quedar registrado en `master` antes de que la fase siguiente dependa de él.
- Aplique cambios solo desde una propuesta disponible en `master`; archive solo desde `master` después de integrar y verificar la aplicación.
- No cree commits, ramas ni merges sin autorización explícita del usuario.
- Mantenga specs principales, documentación, trazabilidad, glosarios y ADR sincronizados con cada cambio.

## Implementación

- Aplique **TDD**: prueba que falla por la razón esperada, implementación mínima y refactorización.
- Mantenga el **monolito modular**: capacidades con fronteras explícitas, API y presentación delgadas,
  coordinación mediante servicios y sin mutar directamente la persistencia de otros módulos.
- Las reglas del dominio no dependen de DRF, React, HTTP ni detalles de persistencia.
- El backend decide permisos, invariantes, dinero, impuestos, inventario, secuencias y transiciones.
- No añada dependencias sin uso actual y documentado; conserve `uv.lock` y `package-lock.json`.
- Preserve cambios ajenos y evite refactorizaciones que no pertenezcan al cambio aprobado.

## Comandos oficiales

Use `make install`, `make dev`, `make check`, `make test`, `make audit`, `make migrate` y
`make admin`. En backend use siempre `uv run`; en frontend use npm exclusivamente. Consulte
`README.md` para requisitos, puertos y comandos detallados.

## Seguridad y terminado

Nunca versione secretos, `.env`, datos, cargas, respaldos, cachés o artefactos generados. No use
CORS `*` con credenciales, no desactive CSRF y no introduzca JWT sin un cambio OpenSpec y ADR que
reemplace expresamente la decisión vigente. Valide autorización en el backend y no registre
contraseñas ni datos personales innecesarios.

Una tarea termina únicamente después de ejecutar con éxito las verificaciones aplicables: formato,
lint, tipos, pruebas, cobertura, build, chequeo de migraciones, documentación y trazabilidad. Informe
los comandos y resultados reales; nunca afirme que una comprobación pasó sin evidencia reciente.

Consulte la [referencia terminológica](AGENTS-glossary-reference.md).
