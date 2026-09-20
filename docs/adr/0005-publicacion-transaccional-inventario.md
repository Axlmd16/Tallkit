# ADR-0005: Publicación transaccional de inventario

- Estado: Aceptada
- Fecha: 2026-09-20

## Contexto

Compras y las futuras salidas comparten saldos, costos y correcciones. Una confirmación no puede
dejar recepción, número, uso fiscal o valoración parciales; dos operaciones concurrentes sobre el
mismo producto no pueden producir existencia negativa; y la historia debe ser inmutable y
reproducible. ADR-0001 fija el **monolito modular** y ADR-0004 el contrato transaccional de
configuración y numeración; falta decidir quién es propietario del saldo y de los movimientos y
cómo se publican los efectos.

## Impulsores de la decisión

- Atomicidad de compra, número, uso fiscal, movimientos y auditoría en una sola transacción.
- Saldos no negativos y valoración reproducible bajo concurrencia.
- Historia inmutable con correcciones por movimientos compensatorios.
- Fronteras comprobables: compras no muta la persistencia de inventario.

## Decisión

`inventory` es propietario de la posición por producto y bodega, de las operaciones y de los
movimientos. Expone servicios (`prepare_operation`, `lock_positions`, `post_operation`,
`reverse_operation`) que exigen la transacción exterior del coordinador y no confirman por
separado. `purchasing` coordina el documento y sus efectos: toma los recursos en un orden total
(recibo, identidad y compras, operación original, proveedor, catálogo por ID, posiciones,
contexto de configuración e inserciones), resuelve la configuración con el contrato de ADR-0004
y publica una entrada agrupada por producto. Las posiciones se crean bajo el bloqueo del
producto; el ordinal por posición se asigna bajo su bloqueo y el momento efectivo se lee después
de los bloqueos sin retroceder. La historia se protege con triggers PostgreSQL además de
modelos sin mutadores. Valoración por promedio ponderado con residuos conservados; la reversión
restituye el estado previo y se rechaza si existe cualquier movimiento posterior.

## Alternativas descartadas

- Saldo en el producto: contradice el catálogo y crea carreras.
- Sumas de movimientos sin bloqueo de posición: no impiden el saldo negativo.
- Transacciones independientes por efecto: permiten efectos parciales.
- Event sourcing o mensajería: complejidad sin necesidad actual.
- Un módulo por tabla o SQL ajeno desde las vistas: rompen el monolito modular.

## Consecuencias

Consultas rápidas y explicables, fronteras comprobables y un núcleo reutilizable por ventas y
mantenimientos. A cambio se mantiene un protocolo de bloqueo, snapshots históricos, la
reconciliación de solo lectura y pruebas de concurrencia sobre PostgreSQL. Complementa a
ADR-0001 y ADR-0004 sin reemplazarlos.
