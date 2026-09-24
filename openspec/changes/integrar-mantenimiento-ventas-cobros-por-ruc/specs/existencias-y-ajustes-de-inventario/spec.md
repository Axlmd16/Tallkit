# Existencias y ajustes de inventario — delta de reservas de mantenimiento

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24; DP-001/002/012; modelo de dominio §4 (Reserva, Disponibilidad), §6, §10 e invariantes 6…9; RN-INV-013/016; RF-INV-007/012; RF-TAL-010; CU-008/018; spec principal `existencias-y-ajustes-de-inventario`. Esta entrega aporta la única reserva admitida en V1: la de la venta abierta vinculada a un mantenimiento. La reserva reduce disponibilidad, no existencia, y nunca genera Kardex.

## MODIFIED Requirements

### Requirement: Consulta de existencias e inactivos

Los tres roles SHALL consultar existencias mediante `inventario.ver`, buscando por código interno, código del fabricante o nombre sin distinguir mayúsculas y filtrando por categoría, estado y con/sin existencias. Los criterios SHALL combinarse por intersección y paginarse con total y orden estable. La consulta inicial SHALL incluir productos activos y también inactivos con saldo o historial; un filtro explícito SHALL permitir consultar todos los inactivos. La ficha SHALL mostrar identidad, presentación, unidad, cantidad real, cantidad reservada y **disponibilidad**, con acceso al **Kardex** y a las ventas vinculadas que sostienen reservas vigentes, según permisos. La falta de movimientos SHALL representar cero una vez consultada la información real, no una cifra simulada durante carga o error. Trazabilidad: RF-INV-007; RF-CAT-005; UI-031/043/074; RNF-USA; CU-008 3; proposal.

#### Scenario: Inactivo con existencias
- **GIVEN** un producto inactivo con 6 unidades
- **WHEN** se abre el inventario sin filtros explícitos
- **THEN** SHALL permanecer visible con su estado, existencia y acceso a historia

#### Scenario: Inactivo agotado con historia
- **GIVEN** un producto inactivo con saldo cero y movimientos previos
- **WHEN** se consulta inventario y Kardex
- **THEN** SHALL conservarse su acceso y mostrarse saldo cero sin eliminar su historia

#### Scenario: Filtros combinados y paginación
- **GIVEN** productos de varias categorías y suficientes coincidencias para varias páginas
- **WHEN** se busca por código o nombre y se filtra categoría y sin existencias
- **THEN** SHALL devolverse solo la intersección con total correcto y orden estable, sin repetir u omitir filas si los datos no cambian

#### Scenario: Existencia, reserva y disponibilidad
- **GIVEN** un producto con existencia 10 y dos órdenes que reservan 3 y 2 unidades
- **WHEN** se consulta su ficha
- **THEN** SHALL mostrarse existencia 10, reservada 5 y disponibilidad 5, y el Kardex SHALL NOT contener movimientos por esas reservas

#### Scenario: Fallo de consulta
- **GIVEN** una consulta de existencia que falla
- **WHEN** se muestra la ficha
- **THEN** SHALL indicarse error recuperable en lugar de presentar cero como saldo confirmado

### Requirement: Stock no negativo bajo concurrencia

Toda salida y reversión SHALL validar las existencias y la **disponibilidad** dentro de la misma operación atómica que las modifica. La disponibilidad SHALL ser la existencia menos las reservas vigentes. SHALL NOT confirmarse cantidad superior a la disponibilidad, salvo la venta vinculada que consume sus propias reservas, ni producir existencia o disponibilidad negativas. Ajustes negativos, correcciones de cargas o ingresos, ventas directas y cualquier otra salida SHALL NOT consumir unidades reservadas. Crear o aumentar una reserva SHALL validar la disponibilidad con el mismo rigor. Operaciones simultáneas sobre productos comunes SHALL equivaler a un orden completo válido; una operación de varios productos SHALL aplicarse por completo o no aplicarse. Trazabilidad: DP-002/012; RN-INV-013/016; RF-INV-012; RNF-INT-001/002/009; invariante 6.

#### Scenario: Stock insuficiente
- **GIVEN** existencia 2 y salida solicitada de 3
- **WHEN** se confirma
- **THEN** SHALL rechazarse indicando cantidad disponible e insuficiencia, sin dejar movimiento ni saldo parcial

#### Scenario: Dos salidas sobre las últimas unidades
- **GIVEN** existencia 5 y dos salidas independientes de 4
- **WHEN** se confirman simultáneamente con sus validaciones vigentes
- **THEN** SHALL confirmarse como máximo una, resultar saldo 1 y fallar la otra por conflicto o insuficiencia sin afectar stock

#### Scenario: Entrada y salida concurrentes
- **GIVEN** existencia 2, entrada de 3 y salida de 4 simultáneas
- **WHEN** se procesan
- **THEN** SHALL resultar saldo 1 si la entrada precede a la salida, o saldo 5 si se rechaza primero la salida insuficiente; nunca saldo negativo

#### Scenario: Ajuste negativo sobre unidades reservadas
- **GIVEN** existencia 4 con 3 unidades reservadas por una orden
- **WHEN** el Administrador confirma un ajuste negativo de 2 unidades
- **THEN** SHALL rechazarse indicando disponibilidad 1, sin movimiento ni cambio en la reserva

#### Scenario: Reserva y ajuste simultáneos
- **GIVEN** existencia 3 sin reservas
- **WHEN** una orden reserva 2 unidades mientras se confirma un ajuste negativo de 2
- **THEN** SHALL aplicarse como máximo una de las dos y nunca resultar disponibilidad negativa

## ADDED Requirements

### Requirement: Reservas de mantenimiento trazables

Una **reserva de mantenimiento** SHALL existir solo mientras la venta vinculada abierta que la sostiene tenga la línea correspondiente. SHALL identificar el producto, la cantidad y la línea de la venta vinculada, y por medio de esta la orden. Proformas y ventas directas en borrador SHALL NOT crear reservas. Retirar o disminuir la línea SHALL liberar exactamente la cantidad retirada; confirmar la venta SHALL consumir la reserva en la misma acción que registra la salida. Una reserva SHALL NOT generar movimientos de Kardex, costo ni valoración, y SHALL NOT corregirse manualmente. La cantidad reservada de un producto SHALL poder reconciliarse con la suma de las líneas de las ventas vinculadas abiertas. Trazabilidad: DP-012; invariantes 8 y 9; modelo de dominio §10 (disponibilidad calculada); RF-TAL-010.

#### Scenario: Reserva liberada al retirar la línea
- **GIVEN** una reserva de 3 unidades sostenida por una línea de venta vinculada abierta
- **WHEN** se retira esa línea desde la orden
- **THEN** la cantidad reservada del producto SHALL disminuir en 3 sin movimiento de Kardex

#### Scenario: Reconciliación de reservas
- **GIVEN** productos con reservas creadas, aumentadas, disminuidas, liberadas y consumidas por varias órdenes
- **WHEN** se verifica la integridad del inventario
- **THEN** la cantidad reservada de cada producto SHALL coincidir con la suma de las líneas de las ventas vinculadas abiertas

#### Scenario: Borrador directo no reserva
- **GIVEN** una venta directa en borrador con 2 unidades de un producto
- **WHEN** se consulta la disponibilidad del producto
- **THEN** SHALL NOT reflejar ninguna reserva por ese borrador

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
