# Visión del producto

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.2 |
| Estado | Borrador para revisión |
| Fecha | 2026-08-04 |

> Este documento describe el sistema objetivo. El comportamiento del código existente no modifica esta visión ni se considera automáticamente correcto.

## 1. Propósito

Definir la visión común del producto que reemplazará las herramientas separadas utilizadas por el negocio y reunirá, en una sola aplicación web, la gestión comercial de repuestos y la operación del taller automotriz.

La visión sirve como referencia para delimitar requisitos, tomar decisiones de arquitectura, evaluar cambios y evitar que la implementación mezcle operaciones que pertenecen a contribuyentes legalmente distintos.

## 2. Contexto del negocio

El negocio desarrolla dos actividades relacionadas, pero fiscalmente independientes:

- El **RUC comercial** compra, almacena y vende productos y repuestos.
- El **RUC artesanal** presta servicios de mantenimiento, reparación y mano de obra.

Ambas actividades atienden a los mismos clientes y vehículos y pueden ser operadas por los mismos usuarios. Sin embargo, sus operaciones económicas deben conservar de forma independiente sus secuenciales, impuestos, pagos, documentos, anulaciones y reportes.

Cuando un mantenimiento requiere repuestos del negocio comercial, el sistema debe relacionar las dos operaciones sin convertirlas en una sola: el mantenimiento registra el trabajo realizado y una venta vinculada registra los repuestos utilizados.

## 3. Problema que se desea resolver

La información operativa se encuentra fragmentada entre procesos manuales, una aplicación anterior y módulos incompletos del sistema actual. Esta situación dificulta:

- Conocer existencias y movimientos reales de los repuestos.
- Relacionar compras, costos, ventas y devoluciones.
- Consultar el historial de un cliente y sus vehículos.
- Dar seguimiento ordenado a los mantenimientos.
- Controlar créditos, abonos y saldos pendientes.
- Evitar la mezcla de operaciones entre los dos RUC.
- Determinar quién realizó una operación que afectó dinero o inventario.
- Trabajar de forma segura con varios usuarios al mismo tiempo.

## 4. Visión del producto

Para el personal administrativo y operativo del taller que necesita controlar repuestos, clientes, vehículos, ventas y mantenimientos, el producto será una aplicación web centralizada que permitirá ejecutar y consultar los procesos diarios desde computadoras, tabletas o teléfonos conectados a la red del negocio.

A diferencia de mantener aplicaciones y registros separados, el sistema compartirá los datos comunes y relacionará las operaciones vinculadas, pero preservará la independencia legal y contable entre el RUC comercial y el RUC artesanal.

## 5. Objetivo general

Desarrollar una aplicación web segura y trazable que integre la gestión de inventario, compras, ventas, pagos, clientes, vehículos y mantenimientos del taller, manteniendo separadas las operaciones fiscales del negocio comercial y del negocio artesanal.

## 6. Objetivos específicos

1. Centralizar los datos compartidos de clientes, vehículos, usuarios y catálogos.
2. Controlar productos, proveedores, ingresos, existencias y Kardex del RUC comercial.
3. Gestionar proformas, ventas, devoluciones, pagos, abonos y saldos de repuestos.
4. Registrar mantenimientos, servicios, diagnóstico, kilometraje, observaciones y evidencias fotográficas.
5. Vincular los repuestos utilizados en un mantenimiento con una venta comercial independiente.
6. Mantener separados los secuenciales, impuestos, pagos, documentos, anulaciones y reportes de cada entidad fiscal.
7. Proteger las operaciones críticas mediante permisos, transacciones, control de concurrencia y auditoría.
8. Facilitar la consulta de información operativa y la generación de comprobantes internos y reportes.
9. Permitir una instalación inicial en la red local y preparar el sistema para un despliegue futuro en Internet.

## 7. Usuarios y partes interesadas

| Parte interesada | Necesidad principal |
|---|---|
| Administrador | Control general, usuarios, configuración, catálogos, inventario, auditoría, reportes, respaldos y operaciones de alto impacto. |
| Vendedor | Consultar productos, preparar proformas, registrar ventas y pagos autorizados. |
| Encargado del taller | Registrar clientes, vehículos, mantenimientos, servicios, repuestos y evidencias. |
| Cliente | Recibir información clara y documentos separados por repuestos y servicios. |

Los únicos roles internos de V1 son **Administrador**, **Vendedor** y **Encargado del taller**. El cliente es una parte interesada, pero no accede al sistema en esta versión. Los permisos definitivos de los tres roles se detallan en `docs/requisitos/actores-y-roles.md`.

## 8. Propuesta de valor

- Una única fuente confiable para los datos compartidos del negocio.
- Separación fiscal explícita sin perder la relación entre venta y mantenimiento.
- Existencias explicables mediante un Kardex, no mediante cambios manuales sin origen.
- Historial de vehículos y trabajos accesible para la atención futura.
- Seguimiento de créditos, abonos y saldos sin confundirlos con formas de pago.
- Menor riesgo de duplicar secuenciales o descontar stock de forma incorrecta.
- Registro de acciones críticas para facilitar revisión y corrección de errores.

## 9. Capacidades principales

El producto se organiza en las siguientes capacidades:

1. Identidad, usuarios y tres roles fijos con permisos por acción.
2. Entidades fiscales y configuración del negocio.
3. Clientes y vehículos compartidos.
4. Catálogo de productos, categorías, marcas y compatibilidad vehicular.
5. Proveedores, compras e ingresos de mercadería.
6. Bodegas, existencias, movimientos y Kardex.
7. Proformas.
8. Ventas, devoluciones, pagos, abonos y crédito.
9. Catálogo de servicios y mantenimientos.
10. Relación entre mantenimientos y ventas de repuestos.
11. Reportes, comprobantes internos y auditoría.

El contenido comprometido para la primera versión se define en `alcance-v1.md`.

## 10. Principios del producto

1. **Separación fiscal:** una relación operativa nunca debe mezclar las obligaciones de los dos RUC.
2. **Datos compartidos sin duplicación innecesaria:** clientes, vehículos y usuarios se registran una vez y pueden participar en ambas actividades.
3. **Trazabilidad antes que edición destructiva:** los errores económicos se corrigen mediante anulaciones, devoluciones o movimientos inversos.
4. **Inventario explicado por movimientos:** toda variación de stock debe tener un tipo, origen, fecha, responsable y motivo.
5. **Estados independientes:** venta, pago y facturación evolucionan por separado.
6. **Configuración antes que valores fijos:** impuestos, tarifas y parámetros variables no deben quedar incrustados permanentemente en el código.
7. **Seguridad por acción:** los permisos se conceden sobre operaciones concretas, especialmente aquellas que afectan dinero, inventario o configuración.
8. **Consistencia concurrente:** una operación debe producir el mismo resultado correcto aunque varios usuarios trabajen simultáneamente.
9. **Simplicidad operativa:** la primera versión cubrirá el flujo real del taller sin incorporar procesos que actualmente no se utilizan.

## 11. Criterios generales de éxito

La primera versión se considerará útil cuando permita:

- Ejecutar los flujos diarios definidos en el alcance sin depender de la aplicación Flutter anterior.
- Rastrear toda entrada o salida de inventario hasta su documento de origen y usuario responsable.
- Consultar por separado las operaciones y saldos de cada entidad fiscal.
- Relacionar un mantenimiento con su venta de repuestos sin mezclar documentos ni pagos.
- Evitar duplicación de secuenciales y resultados inconsistentes en pruebas concurrentes.
- Recuperar la información mediante un procedimiento de respaldo y restauración probado.
- Utilizar las pantallas principales en computadora, tableta y teléfono dentro de la red local.

Los indicadores cuantitativos y sus valores objetivo se establecerán durante el plan de pruebas y la prueba piloto.

## 12. Restricciones y supuestos generales

- La solución tecnológica objetivo utiliza React con TypeScript, Django REST Framework y PostgreSQL.
- La instalación inicial operará en la red local del taller y admitirá varios usuarios concurrentes.
- El diseño debe permitir un despliegue futuro mediante Internet, sin comprometer la seguridad de la instalación local.
- No se migrarán los registros de la aplicación Flutter anterior.
- La facturación electrónica se integrará en una fase posterior.
- El sistema no sustituye las obligaciones contables o tributarias ni decide por sí mismo qué tarifa legal aplicar; utiliza la configuración autorizada del negocio.
- Las decisiones funcionales aprobadas tendrán prioridad sobre el comportamiento heredado del código actual.

## 13. Riesgos del producto

- Interpretar como requisito correcto un comportamiento incompleto del código existente.
- Mezclar operaciones o reportes de los dos RUC por compartir clientes y usuarios.
- Alterar existencias sin un movimiento trazable.
- Generar secuenciales duplicados o vender el mismo stock en operaciones concurrentes.
- Perder fotografías o datos si no se respaldan conjuntamente.
- Ampliar la primera versión con facturación electrónica, garantías u otros procesos antes de estabilizar el núcleo operativo.

## 14. Decisiones pendientes de validación

Antes de cerrar la línea base de requisitos se debe confirmar:

1. Si la primera versión operará exclusivamente con una bodega principal o habilitará varias bodegas.
2. Si se prohibirá totalmente el stock negativo o existirá una excepción autorizada.
3. Las formas de pago disponibles y las reglas para pagos combinados.
4. El límite de descuento ordinario del Vendedor; los excesos serán autorizados por el Administrador.
5. El tratamiento exacto de devoluciones parciales y saldos a favor.
6. Los secuenciales internos requeridos para cada tipo de documento.

## 15. Documentos relacionados

- `alcance-v1.md`
- `reglas-negocio.md`
- `glosario.md`
- `../requisitos/requisitos-funcionales.md`
- `../requisitos/actores-y-roles.md`
