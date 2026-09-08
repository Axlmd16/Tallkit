# C4 nivel 1: contexto

```mermaid
C4Context
  title Contexto del sistema - Sys-Inventario

  Person(personal, "Personal del taller", "Opera el sistema desde la red local")
  System(system, "Sys-Inventario", "Gestionará integralmente el taller sin mezclar entidades fiscales")

  Rel(personal, system, "Realiza y consulta operaciones", "HTTPS en producción")
```

En V1 no existen usuarios públicos ni integraciones externas. La aplicación anterior y el SRI
quedan fuera del sistema. Consulte la [referencia terminológica](c4-context-glossary-reference.md).
