# Guía para agentes

## Estructura

- `backend/`: Django/DRF, configuración y pruebas; no contiene dominio todavía.
- `frontend/`: React/Vite, página técnica y pruebas.
- `docs/negocio/`: fuentes del negocio; no se acomodan al código.
- `docs/tecnico/` y `docs/architecture/`: arquitectura técnica vigente.
- `docs/adr/`: decisiones duraderas aceptadas.
- `openspec/`: especificaciones y cambios propuestos.
- `infra/` y `compose.yaml`: despliegue y desarrollo local.

## Fuentes y precedencia

Lea primero `docs/negocio/decisiones/decisiones-confirmadas.yaml`. Su precedencia declarada es:
decisiones confirmadas; producto; requisitos; arquitectura; plan; código existente. En este árbol,
las rutas reales de producto y requisitos están bajo `docs/negocio/`. Un cambio OpenSpec aprobado
que sea posterior concreta esa documentación sin contradecir una decisión confirmada. Registre las
brechas; no corrija documentos del negocio para ajustarlos a la implementación.

No recree `modelo-dominio.md` ni `modelo-datos.md`. Está prohibido crear entidades, modelos de
negocio, tablas o migraciones propias antes de que el dominio correspondiente tenga propuesta,
especificación y aprobación mediante OpenSpec. Las migraciones incluidas de Django son
infraestructura del framework.

## Flujo obligatorio

- Use OpenSpec para cambios funcionales y para cambios arquitectónicos no triviales.
- Aplique TDD: prueba que falla por la razón esperada, implementación mínima y refactorización.
- Mantenga el monolito modular: módulos alineados con capacidades, API/presentación delgada,
  servicios explícitos para coordinación y sin acceso indiscriminado a modelos de otros módulos.
- Actualice documentación, trazabilidad y ADR cuando cambie una decisión duradera.
- No añada dependencias sin uso actual y documentado; conserve `uv.lock` y `package-lock.json`.

## Comandos

Use `make install`, `make dev`, `make check`, `make test`, `make audit`, `make migrate` y
`make admin`. En backend use siempre `uv run`; en frontend use npm exclusivamente. Los comandos
detallados y puertos están en `README.md`.

## Seguridad y terminado

Nunca versione secretos, `.env`, datos, cargas, respaldos, cachés o artefactos generados. No use
CORS `*` con credenciales, no desactive CSRF y no introduzca JWT sin ADR. Valide autorización en el
backend, no registre contraseñas ni datos personales innecesarios y preserve cambios ajenos.

Una tarea termina solo con lint, formato, tipos, pruebas, cobertura, build, chequeo de migraciones y
documentación aplicables ejecutados con éxito. Informe comandos y resultados reales; no afirme que
algo pasó sin evidencia reciente. Véase la [referencia terminológica](AGENTS-glossary-reference.md).
