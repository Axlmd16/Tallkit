# C4 nivel 2: contenedores

```mermaid
C4Container
  title Contenedores de Sys-Inventario

  Person(personal, "Personal del taller", "Usa computadora, tableta o teléfono")

  System_Boundary(system, "Sys-Inventario") {
    Container(web, "Aplicación web", "React 19, TypeScript 6, Nginx", "Entrega la interfaz responsive y reenvía la API")
    Container(api, "Monolito modular", "Django 5.2 LTS, DRF, Gunicorn", "Expone API versionada y aplica reglas y autorización")
    ContainerDb(database, "Base de datos", "PostgreSQL 17", "Fuente persistente de verdad")
  }

  Rel(personal, web, "Navega y envía acciones", "HTTPS")
  Rel(web, api, "Consulta y modifica mediante sesión y CSRF", "JSON/HTTPS")
  Rel(api, database, "Lee y escribe transaccionalmente", "protocolo PostgreSQL")
```

Cada contenedor es una unidad ejecutable; los módulos internos de Django no son microservicios.
Consulte la [referencia terminológica](c4-containers-glossary-reference.md).
