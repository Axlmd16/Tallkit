# Arquitectura técnica inicial

## Alcance

La solución es una aplicación web de red local preparada para publicarse posteriormente. El
bootstrap comprueba React, Django, PostgreSQL, estilos, navegación, contrato OpenAPI, sesiones,
CSRF, pruebas y empaquetado; no define el dominio ni crea modelos propios.

Los diagramas C4 de [contexto](../architecture/c4-context.md) y
[contenedores](../architecture/c4-containers.md) muestran el alcance y las unidades desplegables.

## Estructura y fronteras

El backend es un monolito modular. `config` contiene composición, settings y la API técnica;
`shared` solo contiene infraestructura transversal comprobada. Las futuras aplicaciones se crearán
por capacidad del negocio después de su OpenSpec, no por tabla. Cuando aporten valor, separarán
`api`, `application`, `domain` e `infrastructure`; no se crearán capas vacías.

Un módulo puede consultar interfaces públicas de otro, pero no mutar directamente su persistencia.
La coordinación con efectos económicos o de inventario pertenecerá a servicios de aplicación con
límites transaccionales explícitos. Las vistas y serializers traducen HTTP y no deciden reglas.

El frontend compone providers y router en `app`, pantallas en `pages`, futuras capacidades en
`features` y piezas transversales en `shared`. El acceso HTTP no vive dentro de componentes de
presentación. TanStack Query gestiona estado remoto; React Router gestiona navegación. No hay un
almacén global de estado añadido por defecto.

## Configuración por entorno

Django comparte `settings/base.py` y aplica diferencias en `development.py`, `test.py` y
`production.py`. PostgreSQL se usa en desarrollo, pruebas y producción. Las variables de entorno
controlan conexión, hosts, orígenes confiables, idioma, zona horaria y logging. Producción exige una
clave explícita, activa cookies seguras, HSTS y Gunicorn; WhiteNoise sirve los estáticos de Django.

Vite reenvía `/api` a Django en desarrollo. En producción, Nginx entrega la SPA y reenvía `/api`,
`/admin` y `/static` al mismo backend, manteniendo el mismo origen. El ejemplo productivo es una
base, no el procedimiento definitivo del servidor del taller.

## API, errores y observabilidad

La API empieza en `/api/v1/`. El health check ejecuta `SELECT 1`, por lo que su éxito demuestra que
Django y PostgreSQL responden. `/api/v1/schema/` genera el contrato OpenAPI. Los errores esperados
usan `application/problem+json` y cada respuesta incluye `X-Request-ID`; el logging de consola es
JSON estructurado y correlacionado.

## Seguridad

La autenticación usa sesiones de Django. La cookie de sesión es `HttpOnly` y `SameSite=Lax`, y es
`Secure` con HTTPS. Login y escrituras exigen CSRF; el token rota al autenticar. El login se limita a
cinco intentos por minuto mediante el cache configurado. Solo health, esquema y endpoints técnicos
de establecimiento/consulta de sesión son públicos. El backend seguirá siendo autoridad de
autorización cuando existan roles. No se habilita CORS ni JWT.

## Reglas de dependencia

1. Presentación depende de casos de uso, nunca al revés.
2. Reglas del dominio no dependen de DRF, React ni detalles HTTP.
3. Persistencia e integraciones implementan necesidades del módulo; no exponen mutación general.
4. `shared` contiene mecanismos transversales, no conceptos de negocio.
5. Toda dependencia entre capacidades debe ser explícita, unidireccional y probada.
6. Un cambio de frontera, autenticación, despliegue o persistencia requiere OpenSpec y ADR.

## Contradicciones documentales observadas

- La fuente de precedencia menciona `docs/producto`, `docs/requisitos`, `docs/arquitectura` y
  `docs/plan`, pero los documentos disponibles de producto y requisitos están bajo `docs/negocio` y
  no existen todavía las dos últimas carpetas de negocio.
- `DP-008` identifica dos decisiones diferentes: campos de Cliente y campos de Vehículo.
- Documentos inferiores aún describen como pendientes decisiones ya cerradas (por ejemplo bodega,
  stock negativo, medios de pago y descuentos). Por precedencia se aplican `DP-001` a `DP-004`.
- El estado histórico cita `repo-review/Back-Inventario` y `repo-review/Front-Inventario`, ausentes en
  este árbol. No se tomó código legado como fuente.
- `DA-001` figuraba abierta. La aprobación expresa de este bootstrap confirma sesiones de Django y
  mismo origen; queda registrada en ADR-0003 sin alterar el documento del negocio.

No se encontró una contradicción que obligue a diseñar dominio durante este bootstrap.

Consulte la [referencia terminológica](arquitectura-inicial-glossary-reference.md).
