# Sys-Inventario

Bootstrap técnico del sistema web de gestión integral para un taller automotriz. Es un
monorepositorio con una SPA React y una API Django, desplegadas como monolito modular y con
PostgreSQL como única base de datos relacional.

El repositorio incluye identidad (autenticación por sesión, roles fijos, autorización y auditoría
administrativa), configuración, catálogos de productos, servicios y proveedores, y el registro de
clientes, vehículos y marcas de vehículo. Inventario, ventas, pagos y mantenimientos todavía no
están implementados.

## Inicio rápido con Docker

Requisitos: Docker Engine con Compose v2. Los puertos predeterminados son `55173` para la web,
`8000` para la API y `55432` para PostgreSQL; pueden cambiarse copiando `.env.example` a `.env`.

```bash
docker compose up --build -d
docker compose ps
```

- Aplicación técnica: <http://localhost:55173>
- Health check directo: <http://localhost:8000/api/v1/health/>
- Esquema OpenAPI: <http://localhost:8000/api/v1/schema/>

La página técnica consulta el health check a través del proxy de Vite. Para detener servicios sin
eliminar los datos: `docker compose down`.

## Instalación nativa reproducible

Requisitos: Python 3.13.14 administrado por `uv` 0.11.23, Node.js 24.20.0 y PostgreSQL 17.11.

```bash
cd backend
uv sync --frozen
cd ../frontend
npm ci
```

Para trabajar fuera de Docker, levante PostgreSQL con `docker compose up -d db`, ejecute el backend
con `cd backend && uv run python manage.py runserver` y el frontend con
`cd frontend && npm run dev`. Todos los comandos Python deben ejecutarse mediante `uv run`.

## Comandos oficiales

```bash
make install          # instala desde uv.lock y package-lock.json
make dev              # construye y levanta el entorno de desarrollo
make check            # formato, lint, tipos, migraciones, pruebas y build
make test             # pruebas de ambos stacks
make audit            # vulnerabilidades Python y npm
make migrate          # migraciones dentro de Compose
make admin            # crea un superusuario y le asigna el rol Administrador del negocio
make compose-check    # valida compose.yaml
```

Las pruebas backend necesitan PostgreSQL disponible en `127.0.0.1:55432`. La cobertura mínima es
85 % en backend y 85 % de líneas/funciones/sentencias y 80 % de ramas en frontend. Playwright
ejecuta identidad contra un `testserver` de Django y una base PostgreSQL de prueba aislada; requiere
Chromium instalado mediante `cd frontend && npx playwright install chromium`.

`make admin` es el procedimiento de arranque para el primer Administrador. El comando conserva
las banderas técnicas de Django para entrar al panel administrativo y, además, asigna
explícitamente el rol `ADMINISTRADOR`. Los permisos funcionales se calculan desde ese rol y nunca
desde `is_superuser`.

Una base creada antes del usuario personalizado no debe migrarse directamente. Consulte el
[procedimiento de transición de identidad](docs/tecnico/transicion-base-identidad.md); cualquier
recreación o traslado exige respaldo y autorización explícita.

## Sesiones y CSRF

La autenticación usa la sesión segura de Django, sin JWT. El navegador obtiene la cookie CSRF con
`GET /api/v1/auth/csrf/`, envía credenciales a `POST /api/v1/auth/login/` con el encabezado
`X-CSRFToken` y vuelve a leer la cookie, porque Django rota el token al iniciar sesión. Toda petición
que modifique estado envía la cookie de sesión y ese encabezado. Producción sirve frontend y API
bajo el mismo origen mediante Nginx; no se habilita CORS permisivo.

## Catálogos de productos, servicios y proveedores

Las tablas de `catalog` y `supplier_registry` nacen vacías: ninguna migración crea unidades, marcas, productos, impuestos, proveedores, existencias ni precios. Orden de carga inicial recomendado, con un Administrador:

1. Categorías, unidades de medida y marcas de producto (no requieren configuración fiscal). Proveedores pueden registrarse en cualquier momento; solo el nombre es obligatorio.
2. Configuración operativa y fiscal (`/configuration`): cada producto exige una definición de impuesto del ámbito comercial y cada servicio una del ámbito artesanal. Sin ellas los formularios muestran «Configuración tributaria pendiente» y no permiten guardar.
3. Productos y servicios.

Despliegue de este cambio (solo con autorización): respaldo probado de PostgreSQL, backend y `make migrate` (migraciones aditivas que no alteran datos anteriores), comprobaciones funcionales y luego el frontend; el frontend anterior sigue funcionando con los contratos existentes. Ante un problema con registros reales se prefiere la corrección hacia adelante: volver al código anterior conserva las tablas nuevas, y no se deshacen migraciones destruyendo catálogos ni se restaura sin respaldo comprobado y autorización.

## Clientes, vehículos y marcas de vehículo

El módulo `customer_registry` conserva clientes, marcas de vehículo, vehículos y períodos de propiedad
(`docs/arquitectura/modelo-datos.md`). Sus tablas nacen vacías: ninguna migración crea clientes, marcas ni
vehículos, y no se importan datos de la aplicación Flutter anterior. Las marcas se cargan desde la interfaz
(`/vehicle-brands`) por un Administrador o Encargado del taller antes de registrar el primer vehículo.

Rutas de la API bajo `/api/v1/`: `customers/` (con `matches/`, `activate/`, `deactivate/` y
`customers/<id>/vehicles/`), `vehicles/` (con `change-owner/`, `ownership/`, `activate/` y `deactivate/`) y
`vehicle-brands/` (con `activate/` y `deactivate/`). Ninguna admite `DELETE`; el estado y el propietario solo cambian
por sus acciones dedicadas y las ediciones exigen `expected_version`. Los errores por campo y los conflictos por
duplicado se devuelven en los campos opcionales `errors` y `conflict` del error uniforme. El contrato completo está en
el esquema OpenAPI.

Despliegue (solo con autorización): respaldo probado de PostgreSQL, backend y `make migrate`, comprobaciones
funcionales y luego frontend. Las migraciones son aditivas y se ensayaron en una base limpia y en una base con
identidad previa; ante problemas con datos reales se prefiere la corrección hacia adelante, sin deshacer migraciones ni
restaurar sin respaldo comprobado y autorización. Detalle en `docs/arquitectura/modelo-datos.md`.

## Documentación

- [Arquitectura técnica inicial](docs/tecnico/arquitectura-inicial.md)
- [Decisiones confirmadas](docs/negocio/decisiones/decisiones-confirmadas.yaml)
- [ADR](docs/adr/)
- [OpenSpec](openspec/config.yaml)

Consulte [AGENTS.md](AGENTS.md) antes de realizar cambios. Los cambios funcionales o arquitectónicos
no triviales deben comenzar en OpenSpec. Consulte también la
[referencia terminológica](README-glossary-reference.md).
