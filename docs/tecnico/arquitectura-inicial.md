# Arquitectura técnica inicial

## Alcance

La solución es una aplicación web de red local preparada para publicarse posteriormente. El
bootstrap comprobó React, Django, PostgreSQL, estilos, navegación, contrato OpenAPI, sesiones,
CSRF, pruebas y empaquetado. Sobre esa base están implementadas identidad y acceso, configuración,
clientes y vehículos, catálogos de productos, servicios y proveedores, y compras e inventario
(ingresos de mercadería, existencias, carga inicial, ajustes y Kardex). Ventas, pagos,
mantenimientos, alertas de stock mínimo y adjuntos continúan sin implementación.

### Fronteras de compras e inventario

`purchasing` coordina el ingreso y `inventory` es propietario de posiciones, operaciones y
movimientos ([ADR-0005](../adr/0005-publicacion-transaccional-inventario.md)). Los módulos solo se
comunican por interfaces públicas: `catalog.application.inventory_references`,
`supplier_registry.application.purchase_references` y
`workshop_configuration.application.operation_context`; `inventory` nunca importa `purchasing`, y
la API y la presentación no importan modelos ajenos. Una confirmación abre una única transacción
exterior con orden total de bloqueos (ADR-0004 dentro de configuración). El diagrama C4 de
contenedores no cambia: son fronteras internas del backend.

Los diagramas C4 de [contexto](../architecture/c4-context.md) y
[contenedores](../architecture/c4-containers.md) muestran el alcance y las unidades desplegables.
El [modelo conceptual aprobado](../arquitectura/modelo-dominio.md) define el lenguaje, las
relaciones y las invariantes del negocio que deberán respetar las futuras capacidades.

## Estructura y fronteras

El backend es un monolito modular. `config` contiene composición y settings; `shared` solo contiene
infraestructura transversal comprobada. `identity` contiene usuarios, asignaciones de roles,
credenciales, autorización y auditoría de identidad. Las futuras aplicaciones se crearán
por capacidad del negocio después de su OpenSpec, no por tabla. Cuando aporten valor, separarán
`api`, `application`, `domain` e `infrastructure`; no se crearán capas vacías.

`customer_registry` conserva clientes, marcas de vehículo, vehículos y períodos de propiedad compartidos por ambos RUC: sus casos de uso viven en `application` (`customers`, `vehicles`, `brands`, `queries`), las reglas puras en `domain` y la API en `api`; consume los servicios públicos de autorización y de auditoría de `identity` (`record_audit_event`) sin escribir sus modelos, y expone a otros módulos solo consultas como `application.catalog_references`. El propietario vigente se deriva del único período de propiedad abierto, sin columna redundante, y los bloqueos se adquieren en el orden cliente → marca → vehículo/período.

`catalog` (productos, categorías, unidades, marcas de producto, compatibilidades y servicios) y `supplier_registry` (proveedores) son aplicaciones independientes: `supplier_registry` no depende de `catalog` ni contiene ingresos o cuentas por pagar. Consultan únicamente `customer_registry.application.catalog_references` (marcas de vehículo) y `workshop_configuration.application.catalog_options` (opciones tributarias de solo lectura). Cada una conserva su propio recibo de idempotencia y su transacción; ningún otro módulo importa sus modelos o servicios.

Un módulo puede consultar interfaces públicas de otro, pero no mutar directamente su persistencia.
La coordinación con efectos económicos o de inventario pertenecerá a servicios de aplicación con
límites transaccionales explícitos. Las vistas y serializers traducen HTTP y no deciden reglas.

El frontend compone providers, guards, navegación y router en `app`, pantallas en `pages`, capacidades en
`features` y piezas transversales en `shared`. `features/auth`, `features/users` y `features/audit`
implementan el estado remoto y contratos de identidad; `features/customers`, `features/vehicles` y `features/vehicle-brands` hacen lo propio para el registro de clientes y vehículos. El acceso HTTP no vive dentro de componentes de
presentación. TanStack Query gestiona estado remoto; React Router gestiona navegación. No hay un
almacén global de estado añadido por defecto.

## Configuración por entorno

Django comparte `settings/base.py` y aplica diferencias en `development.py`, `test.py`, `e2e.py` y
`production.py`. `e2e.py` solo amplía el límite de login durante recorridos automatizados aislados.
PostgreSQL se usa en desarrollo, pruebas y producción. Las variables de entorno
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
cinco intentos por minuto mediante el cache configurado. Solo health, esquema, CSRF, login y la
consulta mínima de sesión son públicos. El backend calcula la unión de permisos de los roles fijos
y deniega por defecto. Una versión de autorización invalida sesiones tras desactivar, restablecer
credenciales o reducir roles; la interfaz únicamente adapta navegación y acciones. No se habilita
CORS ni JWT.

## Reglas de dependencia

1. Presentación depende de casos de uso, nunca al revés.
2. Reglas del dominio no dependen de DRF, React ni detalles HTTP.
3. Persistencia e integraciones implementan necesidades del módulo; no exponen mutación general.
4. `shared` contiene mecanismos transversales, no conceptos de negocio.
5. Toda dependencia entre capacidades debe ser explícita, unidireccional y probada.
6. Un cambio de frontera, autenticación, despliegue o persistencia requiere OpenSpec y ADR.

## Estado documental del dominio

- `DP-008` identifica dos decisiones diferentes: campos de Cliente y campos de Vehículo.
- Las decisiones de bodega, stock negativo, medios de pago, descuentos, reapertura y datos mínimos
  ya están confirmadas y se consolidan en el modelo conceptual.
- Los documentos bajo `docs/negocio/historico/` y el antiguo sistema Flutter no son arquitectura
  objetivo ni requisitos vigentes.
- Continúan pendientes `DA-002`, `DA-003`, `DM-001` y las validaciones fiscales externas
  enumeradas en el modelo conceptual.
- Las reglas de negocio no requieren un ADR individual. La futura coordinación transaccional de
  reservas, confirmación de ventas y Kardex será candidata a ADR cuando el diseño técnico compare
  alternativas concretas.

Identidad y acceso se implementaron mediante `gestion-usuarios-autenticacion-roles`. El resto del
dominio funcional sigue sin implementarse y requiere su propio flujo OpenSpec antes de crear
modelos, migraciones, API o pantallas.

Consulte la [referencia terminológica](arquitectura-inicial-glossary-reference.md).
