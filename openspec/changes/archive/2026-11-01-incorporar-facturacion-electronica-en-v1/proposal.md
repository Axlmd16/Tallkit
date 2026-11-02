## Why

La documentación vigente dice que V1 no factura: `DP-018` limita V1 a documentos internos y los límites de la versión excluyen la conexión con el **SRI**. El cliente pidió facturar desde Tallkit porque el Facturador del SRI le resulta tedioso, y el titular decidió incluir la **facturación electrónica** en V1 mediante un proveedor reemplazable.

Mientras esa decisión no quede registrada, cualquier cambio de emisión contradiría una fuente de mayor precedencia. Este cambio ordena primero la decisión, los documentos y las normas. No toca código: habilita los cambios 2 a 7 del [plan](../../../../docs/cambios-pendientes.md), pero no habilita la emisión por sí mismo.

## What Changes

### A. Decisión nueva `DP-034`

Sustituye a `DP-018` solo donde dice que V1 no emite facturas. Propone estas reglas:

1. **V1 emite comprobantes autorizados por el SRI:** factura y nota de crédito, además de la anulación. Otros comprobantes quedan fuera: guía de remisión, nota de débito, liquidación de compra y retención emitida.
2. **Emisión por proveedor:** el proveedor genera el XML, lo firma, lo envía al SRI y genera el RIDE. Tallkit reúne los datos, solicita la emisión, guarda el resultado y conserva su propia copia. Tallkit no firma ni custodia la firma electrónica.
3. **Proveedor reemplazable:** cambiar de proveedor significa agregar un adaptador y cambiar una configuración, sin tocar ventas, taller, cobros ni pantallas. El proveedor inicial es Factuplan, elegido el 2026-11-01 y sujeto a obtener una autorización real.
4. **Activación por RUC:** V1 incluye los dos RUC y cada uno se activa por separado. El artesanal puede salir primero y no espera al comercial. El comercial necesita su RUC definitivo, su firma vigente y la validación del redondeo del IVA.
5. **Estado fiscal independiente:** emitir no gobierna inventario, cobros ni mantenimientos. Un fallo de emisión no deshace la venta ni el cobro. Esta parte de `DP-018` sigue vigente.
6. **Internet solo de salida:** sin Internet la operación diaria continúa, la venta queda registrada y el comprobante espera en Tallkit. El acceso público desde Internet sigue fuera de V1.
7. **Documentos internos:** siguen existiendo y no son facturas. Los números internos de `DP-006` siguen separados de la numeración fiscal.
8. **Transición:** hasta archivar los cambios 3 y 4, el sistema sigue operando solo en pruebas y rechazando producción. La decisión no habilita la emisión real.
9. **Prueba real supervisada:** se permiten pocas facturas reales para comprobar la autorización del SRI, sin tener todavía política de conservación ni restauración probada. La facturación diaria sigue bloqueada hasta tenerlas. Cada factura de la prueba es un documento tributario real, por lo que debe corresponder a una operación real con un comprador que lo acepte.

### B. Salida de cada choque

| Regla o decisión | Salida | Motivo |
|---|---|---|
| `DP-018` | Reemplaza en parte | Cae «no emite»; siguen la identidad y el estado independientes. |
| Límite de V1 sobre facturación y SRI | Reemplaza | Es la decisión misma. El acceso público por Internet sigue excluido. |
| `alcance-v1.md` §1, §2.2, §6, extensión final y `FUT-001` | Reemplaza | `FUT-001` se cierra; consumidor final pasa al cambio 6. |
| `RF-REP-014` | Reemplaza | «Futura referencia» pasa a referencia fiscal real. |
| Exclusión final de `requisitos-funcionales.md` §13 y §14 | Reemplaza | Retira firma, transmisión, autorización y entrega de lo no derivable. |
| `RF-FIS-003` y `RN-FIS-012` | Se ajusta | Solo pruebas hasta los cambios 3 y 4, por la regla 8. |
| `RNF-DIS-001` | Se ajusta | La operación depende de la red local; solo la emisión necesita Internet. |
| `RN-FIS-014` y `RF-FIS-006` | Se ajusta | Excepción de la regla 9, decidida por el titular el 2026-11-01. |
| `ADR-0010` | Se ajusta | Se agrega una actualización; `ADR-0013` queda para el cambio 3. |
| `RN-CON-003`, `RN-CON-009`, `RF-VEN-015`, `RF-PRO-010`, `RNF-USA-012`, invariante 25 y `openspec/config.yaml` | Se mantiene | Un documento interno sigue sin ser una factura. |
| `DP-006` | Se mantiene | La numeración interna no acredita una factura. |
| Convivencia del comprobante interno con el RIDE | Se aplaza | La decide el cambio 5. |
| Permisos para emitir y corregir (`actores-y-roles.md` §7) | Se aplaza | Los deciden los cambios 3 y 7. |

Los choques que cambian algo y que el plan no listaba son `RN-FIS-012`, `RN-FIS-014`, `RF-FIS-006` y la exclusión final de requisitos.

### C. Sincronización documental

- Actualizar decisiones confirmadas, visión, alcance, reglas, requisitos, casos de uso, actores, interfaz, glosario y trazabilidad.
- Actualizar el modelo de dominio: alcance, referencia fiscal, estados, asuntos abiertos, diagrama y explicación.
- Actualizar el diagrama C4 de contexto, que hoy declara que no existen integraciones externas.
- Agregar requisitos y un caso de uso de alto nivel, marcados como pendientes y asignados a su cambio.
- Asignar el redondeo del IVA al cambio 2 en el plan. Un cambio archivado lo delegó a `alinear-calculo-de-iva-con-el-sri`, que nunca se creó ni figura entre los 15 del plan. Afecta al RUC comercial, no al artesanal, que factura a IVA 0 %.

### D. Matriz de normas

Documento nuevo que relaciona cada norma aplicable con su fuente oficial, lo que exige, el cambio responsable y su estado de verificación. Una norma sin texto oficial consultado queda marcada como pendiente y no como verificada.

## Capabilities

### New Capabilities

- `normativa-de-facturacion-electronica`: matriz de las normas aplicables, con fuente oficial, exigencia, cambio responsable y estado de verificación.

### Modified Capabilities

- `modelo-dominio-taller`: «Documentos internos y futura facturación» pasa a reconocer la emisión en V1. Se agregan las reglas conceptuales de proveedor reemplazable, activación por RUC, operación sin Internet y transición.

### Specs sin cambio en esta propuesta

Conservan su comportamiento hasta que su propio cambio las modifique. La regla 8 evita que contradigan a `DP-034`.

| Spec | Cambio que la modificará |
|---|---|
| `configuracion-operativa-y-fiscal` | 2 y 4 |
| `identidad-y-numeracion-fiscal` | 2 y 3 |
| `preparacion-y-seguimiento-fiscal` | 2 y 3 |
| `archivo-de-comprobantes-fiscales` | 3 y 4 |
| `solicitudes-de-correccion-fiscal` | 7 |

## Impact

- **Código, datos, API, permisos y pantallas:** sin cambios. El módulo `fiscal` se reutiliza en cambios posteriores.
- **Dependencias:** ninguna nueva.
- **Operación:** sin cambios. Producción sigue rechazada.
- **Plan:** `docs/cambios-pendientes.md` recibe el redondeo en el cambio 2, la prueba real en el cambio 4 y las casillas de este cambio.
- **Referencias:** `DP-006`, `DP-018`, `DP-025`, `DP-031`; `RN-FIS-011…014`, `RN-CON-003`, `RN-CON-009`, `RN-CON-010`; `RF-FIS-001…007`, `RF-REP-014`, `RF-VEN-009`; `RNF-DIS-001`, `RNF-SEG-008`; `CU-003`, `CU-028…030`; `ADR-0010`.

## Fuera de alcance

- Código, modelos, migraciones, endpoints y pantallas.
- Adaptadores, cola de emisión y conexión con Factuplan: cambios 3 y 4.
- Datos del comprobante, plazo de crédito y corrección del redondeo del IVA: cambio 2.
- Convivencia del comprobante interno con el RIDE: cambio 5.
- Consumidor final sin registro: cambio 6.
- Notas de crédito y anulaciones reales: cambio 7.
- Política de conservación y datos personales: cambio 13.
- Instalación, respaldos y `ADR-0014`: cambio 14.
- Correo enviado por Tallkit: cambio 16, diferido.

## Usuarios afectados

- **Titular y cliente:** la versión 1 pasa a comprometer la facturación.
- **Administrador, Vendedor y Encargado del taller:** nada cambia en sus pantallas en este cambio.
- **Contador y abogado:** reciben asuntos concretos por validar, sin que el sistema los dé por resueltos.

## Dependencias

- **Necesita:** textos oficiales de las normas, para cerrar la matriz.
- **Habilita:** los cambios 2 a 7, que no pueden contradecir la decisión vigente.
- **Orden afectado:** la prueba real del cambio 4 ocurre antes de los cambios 13 y 14; la facturación diaria, después.

## Riesgos

- **Confundir decisión con habilitación:** la regla 8 mantiene producción rechazada.
- **Factuplan aún sin autorización real:** todas las autorizaciones han sido simuladas. La regla 3 permite cambiar de proveedor sin rehacer el sistema.
- **Datos personales en la prueba real:** viajarían al proveedor antes del contrato de tratamiento de datos y del cambio 13. Debe usarse un comprador que lo acepte.
- **Facturas reales sin archivo garantizado:** la excepción se limita a la prueba y sus XML se guardan en el archivo fiscal.
- **Cruce con el Facturador del SRI:** usarlo a la vez con el mismo establecimiento y punto podría duplicar números. Se resuelve al fijar la numeración en el cambio 4.

## Pendientes e información insuficiente

- **Texto oficial sin consultar:** `NAC-DGERCGC25-00000014`, `NAC-DGERCGC25-00000017` y `NAC-DGERCGC26-00000027`.
- **Fecha del comprobante que esperó sin Internet:** falta confirmar en la norma qué fecha lleva y cuánto puede esperar. `DP-025` no admite retrofechar. Debe resolverse antes del diseño del cambio 3.
- **Registro del desarrollador como proveedor ante el SRI:** sin confirmar. Puede condicionar la primera factura real.
- **Redondeo del IVA (`EXT-002`):** condiciona solo la activación del RUC comercial.
- **Tope de consumidor final y leyenda de Negocio Popular (`DP-031`):** siguen abiertos para los cambios 2 y 6.

## Decisiones y recomendaciones

- **Confirmadas por el titular:** incluir la facturación en V1, Factuplan como proveedor inicial, proveedor reemplazable, activación por RUC (2026-11-01) y excepción para la prueba real (2026-11-01).
- **Recomendadas, sujetas a la aprobación de esta propuesta:** las demás reglas de `DP-034` y las salidas de la tabla B.

## Fuentes consultadas

`docs/negocio/decisiones/decisiones-confirmadas.yaml`, `docs/arquitectura/modelo-dominio.md`, `docs/cambios-pendientes.md`, `docs/negocio/producto/` (`alcance-v1.md`, `vision.md`, `reglas-negocio.md`, `glosario.md`), `docs/negocio/requisitos/` (`requisitos-funcionales.md`, `requisitos-no-funcionales.md`, `casos-de-uso.md`, `actores-y-roles.md`, `interfaz-y-navegacion.md`), `docs/adr/0010-modulo-fiscal-independiente-y-archivo-transaccional.md`, `docs/architecture/c4-context.md`, `docs/tecnico/operacion-archivo-fiscal.md` y las specs `modelo-dominio-taller`, `identidad-y-numeracion-fiscal`, `archivo-de-comprobantes-fiscales`, `preparacion-y-seguimiento-fiscal`, `solicitudes-de-correccion-fiscal` y `configuracion-operativa-y-fiscal`. `docs/negocio/historico/` no se consultó.
