# Guía para agentes

## Inicio obligatorio

Lea solo lo que la tarea necesita: todo lo leído se reenvía en cada turno de la sesión. Si un
documento es largo, busque la sección con `rg` en lugar de abrirlo entero.

- **Propuesta o decisión de negocio:** lea completos
  `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`,
  además de la spec principal y los documentos de producto y requisitos del área.
- **Specs, design y tasks:** lea los artefactos anteriores del cambio y solo las decisiones, reglas
  y secciones que citan. En design añada la arquitectura técnica y los ADR aplicables.
- **Aplicar tareas:** lea `tasks.md` y lo que la tarea cite.
- **Arreglo pequeño:** no lea documentación, salvo la regla concreta si toca dinero, impuestos,
  inventario, permisos o facturación.

Indique las fuentes consultadas y registre contradicciones o información insuficiente.

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
- `backend/`: Django/DRF, configuración, pruebas y los módulos de la línea base (identidad, catálogos, clientes, compras, inventario, ventas, proformas, mantenimientos, pagos y fiscal); la facturación electrónica opera solo en pruebas.
- `frontend/`: React/Vite, pantallas de esos módulos y pruebas.
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
- No cree archivos de glosario por artefacto. Los términos nuevos van en `docs/negocio/producto/glosario.md` o `docs/tecnico/glosario-tecnico.md`.
- La cobertura de un cambio es breve: una fila por requisito con su prueba, no una por escenario.
- En las specs, agrupe las variantes en un solo escenario; detalle cada caso solo en lo de riesgo alto.

## Implementación

- Mantenga el **monolito modular**: capacidades con fronteras explícitas, API y presentación delgadas,
  coordinación mediante servicios y sin mutar directamente la persistencia de otros módulos.
- Las reglas del dominio no dependen de DRF, React, HTTP ni detalles de persistencia.
- El backend decide permisos, invariantes, dinero, impuestos, inventario, secuencias y transiciones.
- No añada dependencias sin uso actual y documentado; conserve `uv.lock` y `package-lock.json`.
- Preserve cambios ajenos y evite refactorizaciones que no pertenezcan al cambio aprobado.

## Pruebas según el riesgo

| Nivel | Cuándo | Qué hacer |
|---|---|---|
| Estricto (**TDD**) | Dinero, impuestos, inventario, secuencias, permisos, concurrencia, facturación y reglas de dominio | Prueba que falla por la razón esperada, implementación mínima y refactorización |
| Prueba al final | Lógica de pantallas, formularios y API sin reglas críticas | Implementar y agregar una prueba por flujo, sin ciclo de prueba previa |
| Sin prueba nueva | Textos, colores, espaciado, maquetación, documentación y configuración | Lint y tipos; revisar la pantalla si es visual |

- Un error corregido lleva prueba de regresión, salvo en el tercer nivel.
- Ejecute solo las pruebas relacionadas y hágalo al cerrar cada grupo de tareas, no tras cada edición.
- Use E2E solo en flujos críticos y al cerrar el cambio, no por tarea.
- La suite completa solo se ejecuta si el titular la pide.
- No fije textos exactos de la interfaz en las pruebas, salvo avisos legales o fiscales.

## Comandos oficiales

Use `make install`, `make dev`, `make check`, `make test`, `make audit`, `make migrate` y
`make admin`. En backend use siempre `uv run`; en frontend use npm exclusivamente. Consulte
`README.md` para requisitos, puertos y comandos detallados.

## Seguridad y terminado

Nunca versione secretos, `.env`, datos, cargas, respaldos, cachés o artefactos generados. No use
CORS `*` con credenciales, no desactive CSRF y no introduzca JWT sin un cambio OpenSpec y ADR que
reemplace expresamente la decisión vigente. Valide autorización en el backend y no registre
contraseñas ni datos personales innecesarios.

Una tarea termina únicamente después de ejecutar con éxito las verificaciones aplicables a su nivel de riesgo: formato,
lint, tipos, pruebas, cobertura, build, chequeo de migraciones, documentación y trazabilidad. Informe
los comandos y resultados reales; nunca afirme que una comprobación pasó sin evidencia reciente.
