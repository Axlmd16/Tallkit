# ADR-0004: Contrato transaccional de configuración y numeración

- Estado: Aceptada
- Fecha: 2026-09-14

## Contexto

Las capacidades futuras de ingresos, proformas, ventas y servicios deben resolver la **entidad
fiscal**, la configuración tributaria y el **secuencial** aplicables sin duplicar reglas ni mutar
directamente la persistencia de configuración. La asignación debe ser segura ante concurrencia,
idempotente y reversible cuando falla cualquier efecto de la confirmación consumidora.

ADR-0001 establece el **monolito modular** y la colaboración mediante interfaces públicas;
ADR-0003 exige sesión, CSRF y mismo origen para la API administrativa. Falta concretar quién abre
la transacción, qué se bloquea y en qué orden, y qué garantías debe respetar cada consumidor.

## Impulsores de la decisión

- Una confirmación no puede conservar número, impuesto o inventario de forma parcial.
- Un reintento lógico no puede crear otro documento ni consumir otro número.
- Dos confirmaciones concurrentes deben obtener números distintos y consecutivos.
- Una sustitución de serie o vigencia no puede competir con una selección ya en curso.
- La configuración histórica y los números confirmados no pueden reutilizarse ni reescribirse.
- Las fronteras entre módulos deben permanecer explícitas y probables.

## Opciones consideradas

### 1. Transacción exterior del consumidor con servicios públicos de configuración

El consumidor abre una **transacción atómica**, bloquea primero sus recursos propios conforme a su
contrato y llama a servicios públicos que resuelven configuración y numeración dentro de esa misma
transacción. Configuración bloquea sus filas en un orden documentado y devuelve copias inmutables.

Ventajas: rollback completo, una sola unidad de idempotencia y límites modulares explícitos.
Desventajas: cada consumidor debe respetar el contrato y probar su orden total de bloqueos.

### 2. Transacciones internas independientes en configuración

Cada servicio confirma su propio cambio antes de devolver el resultado al consumidor.

Ventajas: interfaz aparentemente simple. Desventajas: deja números o usos confirmados si el resto
de la operación falla y obliga a compensaciones que contradicen la garantía de no producir efectos
parciales.

### 3. `MAX()+1` o secuencia independiente de PostgreSQL

Calcular el máximo es inseguro ante concurrencia. Una secuencia de base evita duplicados, pero su
incremento no revierte con la confirmación exterior y crea huecos incluso cuando la operación no se
confirma. Ninguna alternativa satisface por sí sola la semántica acordada.

### 4. Bloqueo global de la instalación

Serializar toda operación económica sobre el singleton simplifica el razonamiento.

Ventajas: orden único. Desventajas: contención innecesaria entre ámbitos fiscales y tipos de
documento que pueden avanzar independientemente.

## Decisión

Adoptar la opción 1. La capacidad consumidora es propietaria de la transacción exterior completa y
de su clave lógica estable. Dentro de esa unidad debe validar permisos y estado, bloquear sus
recursos propios, resolver configuración, asignar el número, guardar documento y efectos, y
confirmar una sola vez. No se permiten llamadas de numeración fuera de una transacción activa.

Los servicios públicos de configuración son la única vía de escritura entre módulos. Devuelven
valores inmutables y guardan `ConfigurationUse` y sus copias históricas en la transacción del
consumidor. Ningún consumidor actualiza modelos de configuración directamente ni exige el permiso
administrativo `parametros.gestionar` para colaborar internamente.

### Orden de bloqueos

Cada consumidor documenta y bloquea primero sus recursos propios en orden estable. Después,
configuración adquiere siempre:

1. `FiscalEntity` aplicable.
2. Cada `TaxDefinition` solicitada, ordenada por identificador ascendente, y su `TaxPeriod`.
3. `NumberingScope` de la entidad y tipo documental.
4. `DocumentSeries` activa del ámbito.

La inicialización bloquea primero `WorkshopConfiguration`. Una escritura tributaria bloquea su
`TaxDefinition` antes de cualquier período. La sucesión de serie y la asignación bloquean el mismo
`NumberingScope`; por ello nunca toman la serie antes del ámbito. No se realizan llamadas externas,
auditorías fuera de base ni cálculos costosos mientras se mantienen estos bloqueos.

### Idempotencia y resultados

La identidad estable del documento deduplica por ámbito aunque cambie la clave de transporte. La
clave de solicitud y la huella canónica impiden que una misma clave o documento oculte entradas
incompatibles. Un resultado compatible ya confirmado se devuelve sin repetir efectos; una
incompatibilidad responde conflicto. El reintento abarca la transacción completa, nunca solo el
fragmento de numeración.

Una excepción antes del commit revierte asignación, contador, uso de configuración, documento,
efectos y auditoría exitosa. Un número de una transacción confirmada se conserva aun si el documento
se anula después. Los rechazos esperados se auditan después del rollback; una indisponibilidad real
de la base solo puede conservarse en el registro técnico correlacionado.

## Consecuencias

### Positivas

- Documento, configuración histórica, numeración y efectos se confirman o revierten juntos.
- Los ámbitos independientes evitan un bloqueo global de todas las operaciones.
- Sustitución y asignación se serializan sobre la misma raíz de consistencia.
- Los consumidores futuros reciben un contrato único y comprobable.

### Negativas

- Django no impide por tipos una llamada fuera de transacción; el servicio debe comprobarla y las
  pruebas deben cubrir el rechazo.
- Cada nueva capacidad consumidora debe documentar sus bloqueos propios y demostrar que el orden
  combinado no introduce ciclos.
- Las pruebas reales de concurrencia requieren PostgreSQL y conexiones independientes.

### Riesgos y mitigaciones

- **Interbloqueo por orden distinto:** revisar cada consumidor contra el orden de este ADR y probar
  carreras con barreras, sin esperas temporizadas.
- **Sección crítica extensa:** preparar y validar entradas antes de bloquear; no ejecutar red ni
  renderizado bajo bloqueo.
- **Uso indebido de persistencia ajena:** exponer servicios estrechos y prohibir mutaciones directas
  mediante revisión y pruebas de frontera.
- **Reintento parcial:** exigir identidad estable e idempotencia a la operación exterior completa.

## Estado y adopción

La reconciliación del cambio `configuracion-operativa-y-fiscal-taller` y esta decisión fueron
aprobadas explícitamente el 2026-09-14. La implementación debe añadir pruebas transaccionales y de
concurrencia para demostrar la adopción del contrato.

## Referencias

- `openspec/changes/configuracion-operativa-y-fiscal-taller/design.md`
- `openspec/changes/configuracion-operativa-y-fiscal-taller/specs/configuracion-operativa-y-fiscal/spec.md`
- `docs/adr/0001-monorepositorio-y-monolito-modular.md`
- `docs/adr/0003-sesiones-y-mismo-origen.md`
- `docs/tecnico/arquitectura-inicial.md`
- [Referencia terminológica](0004-contrato-transaccional-configuracion-y-numeracion-glossary-reference.md)
