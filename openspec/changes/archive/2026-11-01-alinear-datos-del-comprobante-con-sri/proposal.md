## Why

Tallkit prepara los datos de una factura, pero no siempre reúne lo que la ficha técnica 2.34 del **SRI** pide: el correo del comprador puede faltar, el crédito no declara plazo, no existe la condición de gran contribuyente y varias pantallas no muestran datos que el comprobante admite. El cambio 3 armará la emisión sobre esos datos, así que primero deben estar completos y ser correctos, sin depender de ningún proveedor.

Esta revisión comparó la ficha y el XSD oficial con el código y encontró cinco diferencias que el [plan](../../../docs/cambios-pendientes.md) no listaba (tabla B). Este cambio no emite nada: el sistema sigue solo en pruebas (`DP-034`, regla 8).

## What Changes

### A. Decisión nueva `DP-035`

Se registra como decisión nueva y **no sustituye** a otra. Ajusta `DP-003`, `DP-027` y `DP-031` con excepciones escritas, y aplica lo que `DP-008` ya había previsto.

1. **Correo del comprador:** es obligatorio al preparar la factura de un comprador identificado. Se completa en la preparación y no cambia la ficha del cliente. El registro del cliente sigue igual. Consumidor final queda como hoy hasta el cambio 6.
2. **Plazo del comprobante:** al preparar una venta u operación a crédito con saldo pendiente, se pide un plazo en días. Es solo un dato de la factura: el crédito sigue sin vencimiento, cuotas, mora ni alertas, y cobros y saldos no cambian.
3. **Detalle por servicio:** cada línea de servicio admite una nota opcional que el Encargado escribe en el mantenimiento, se conserva al confirmar la operación, llega precargada a la preparación y aún se puede ajustar ahí, sin tocar la operación.
4. **Leyendas del emisor:** se derivan de la configuración y nadie las escribe.
5. **Gran contribuyente:** es una condición nueva del perfil del emisor, con su número de resolución.

### B. Salida de cada choque

| Regla o decisión | Salida | Motivo |
|---|---|---|
| `DP-008` Cliente, `RN-CLI-003` | Se mantiene | Ya preveía exigir datos al facturar. Decidido por el titular. |
| `DP-003`, `DP-027`, `RF-PAG-012`, `RN-VEN-008` | Se ajusta | El plazo existe solo en el comprobante. El crédito interno no cambia. Decidido por el titular. |
| Spec `preparacion-y-seguimiento-fiscal`: correo opcional y plazo rechazado | Reemplaza | Son las dos reglas anteriores llevadas al comportamiento. |
| `DP-031`: leyenda de Negocio Popular por confirmar | Se ajusta | La ficha define el texto (`NOR-002`). Ver el riesgo con el XSD. |
| `DP-025`, `EXT-002`, `V-5`: redondeo del IVA incluido | Se aplaza | Sin respuesta del contador. Pasa a ser condición de activación del RUC comercial, como ya dice `RN-FIS-017`. |
| Spec `identidad-y-numeracion-fiscal`: ambiente único de pruebas | Se aplaza | Pasa al cambio 3, junto con la activación por RUC. Nada aquí podría usarlo. Decidido por el titular. |
| `RUC Proveedor` | Se aplaza | Sin un comprobante autorizado no hay nada que comprobar. Aquí solo se reserva su nombre y su espacio; la comprobación pasa al cambio 4. |
| `matriz-instantanea-fiscal.md` | Se corrige | Ver las diferencias nuevas. |

**Diferencias nuevas, que el plan no listaba**

| Diferencia | Salida propuesta |
|---|---|
| El XSD 2.1.0 solo admite `CONTRIBUYENTE RÉGIMEN RIMPE`, pero la ficha exige la leyenda de Negocio Popular en esa misma etiqueta. | Se sigue la ficha y se registra la contradicción como fila nueva Pendiente. Ningún RUC está hoy en ese régimen. |
| `DP-031` admite `contribuyenteEspecial` de 1 a 13 caracteres; la ficha y el XSD exigen mínimo 3. | Se ajusta a 3 a 13. |
| La ficha pide el número de `agenteRetencion` sin ceros a la izquierda; hoy se aceptan. | Se rechazan, sin corregirlos en silencio. |
| La matriz marca `nombreComercial` y `dirEstablecimiento` como conservados, pero no llegan a la instantánea. | Se conservan de verdad. |
| No existe la condición de gran contribuyente, que el Anexo 24 exige en la información adicional. | Se agrega, según el punto A.5. |

### C. Datos del comprobante

- **Leyendas:** se deriva `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE`, y `Gran Contribuyente` con su resolución va como información adicional.
- **Pantalla de detalle adicional:** la API ya lo admite, pero la preparación no lo muestra. Se agregan pares de nombre y valor de hasta 300 caracteres, con espacio reservado para que el comprobante no pase de 15 campos.
- **Nombres reservados:** el usuario no puede escribir `RUC Proveedor` ni `Gran Contribuyente`.
- **Plazo:** solo se escribe el número y la unidad es siempre `dias`, único valor que usan los ejemplos de la ficha.
- **Detalle por servicio:** un solo texto de hasta 300 caracteres por línea. También aparece en el comprobante interno artesanal.
- **Instantánea:** las preparaciones nuevas usan un formato nuevo. Las ya completadas no se tocan.

### D. Sincronización documental

- Actualizar decisiones confirmadas, reglas, requisitos, casos de uso, interfaz, modelo de dominio, glosario y trazabilidad.
- Corregir `matriz-instantanea-fiscal.md` con los campos que dejan de ser no aplicables.
- Agregar a la matriz de normas filas para plazo, límites de campos y la contradicción de Negocio Popular, además de la validación `V-6`.
- Actualizar el plan: ambiente al cambio 3, `RUC Proveedor` al cambio 4 y redondeo a validaciones externas. Corregir también la nota de que el cambio 1 falta en `master`, porque ya está.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `preparacion-y-seguimiento-fiscal`: correo obligatorio para compradores identificados, plazo del crédito, pantalla de detalle adicional con nombres reservados, detalle por línea, emisor completo y formato nuevo de la instantánea.
- `configuracion-operativa-y-fiscal`: leyenda de Negocio Popular, condición de gran contribuyente, límites de `contribuyenteEspecial` y `agenteRetencion`, y plazo fuera de la regla «no se captura».
- `servicios-aplicados-al-mantenimiento`: nota opcional en cada línea de servicio.
- `operacion-artesanal-de-servicios`: la nota se conserva al confirmar y aparece en el comprobante interno.

### Specs sin cambio en esta propuesta

| Spec | Motivo |
|---|---|
| `identidad-y-numeracion-fiscal` | El ambiente pasa al cambio 3. |
| `gestion-de-clientes` | El correo sigue siendo opcional al registrar. |
| `pagos-comerciales-y-credito-simple`, `pagos-artesanales-y-credito-simple` | El plazo no entra a cobros ni saldos. |
| `normativa-de-facturacion-electronica` | Crecen las filas de la matriz, no sus requisitos. |

## Impact

- **Backend:** módulos `fiscal`, `workshop_configuration` y `workshop`. Sin dependencias nuevas.
- **Datos:** migración para la nota en las líneas de servicio y para la nueva condición del perfil. No cambia dinero, inventario ni secuencias.
- **API:** el plazo pasa de rechazado a aceptado solo en crédito. Hay cambios en el borrador fiscal, el perfil del emisor y las líneas de servicio, con OpenAPI actualizado.
- **Frontend:** preparación fiscal, perfil del emisor, líneas de servicio del mantenimiento y comprobante interno artesanal.
- **Operación:** cada perfil debe declarar una vez la condición de gran contribuyente. Hasta entonces esa entidad queda en *Falta completar* y no prepara facturas. Las ventas y los cobros no se afectan.
- **Referencias:** `DP-003`, `DP-008`, `DP-025`, `DP-027`, `DP-031`, `DP-034`; `RN-CLI-003`, `RN-VEN-008`, `RN-FIS-010`, `RN-FIS-017`, `RN-CON-002`; `RF-FIS-001`, `RF-FIS-007`, `RF-PAG-012`, `RF-ACC-010`, `RF-TAL-005`; `CU-003`; `NOR-001` a `NOR-005`, `NOR-009`, `NOR-018`; `ADR-0010`.

## Fuera de alcance

- Generar XML, adaptadores, cola de emisión y conexión con Factuplan: cambios 3 y 4.
- Ambiente por RUC y activación: cambio 3.
- Comprobar `RUC Proveedor` en el XML autorizado: cambio 4.
- Entrega impresa a un cliente sin correo y RIDE: cambio 5.
- Consumidor final sin registro: cambio 6.
- Cambiar la regla de redondeo: espera a `V-5`.
- Vencimientos, mora o alertas de crédito: siguen fuera de V1.
- Número de calificación artesanal en el comprobante (`DP-031` D5): la ficha no lo trata y sigue abierto para los cambios de emisión.

## Usuarios afectados

- **Vendedor y Encargado del taller:** al preparar deben dar el correo del comprador y, a crédito, el plazo. El Encargado gana la nota por servicio.
- **Administrador:** declara gran contribuyente una vez por entidad.
- **Comprador:** quien no tiene correo no recibe por ahora factura con sus datos.
- **Contador:** recibe una pregunta nueva, `V-6`.

## Dependencias

- **Necesita:** el cambio 1, ya archivado y presente en `master`.
- **Habilita:** el cambio 3.
- **Toca a otros cambios:** el 3 debe decidir qué pasa con preparaciones completadas antes de este cambio, sin correo ni plazo. El 5 puede revisar la entrega impresa.

## Riesgos

- **Cliente sin correo:** es un caso real en el mostrador y bloquea su factura con datos. Se acepta porque `NOR-009`, que permitiría entregar el impreso, sigue Pendiente. El cambio 5 lo revisa.
- **Negocio Popular y el XSD:** el archivo fiscal valida contra el XSD local, de modo que hoy rechazaría un XML autorizado con esa leyenda. Debe resolverse antes de activar un RUC en ese régimen. Hay que preguntar por el régimen del RUC comercial definitivo.
- **Redondeo del IVA:** con IVA 15 % y precios de USD 0,01 a USD 200, el 13 % de los valores difiere en un centavo entre el método de `DP-025` y calcular base por 15 %. La ficha tiene el error 52 *Error en diferencias*, pero no dice qué tolerancia aplica. Solo afecta al RUC comercial, que no se activará sin esa respuesta.
- **Plazo no acordado:** quien prepara debe escribir un número aunque el crédito no tenga fecha. Se pregunta en `V-6`.
- **Factuplan sin probar a crédito:** falta confirmar que acepta plazo y detalle por línea. Se comprueba en el cambio 4, y el plan ya lo tiene pendiente.

## Pendientes e información insuficiente

- **`V-6` para el contador:** una venta a crédito sin fecha acordada ¿debe llevar plazo? ¿Qué número corresponde? La ficha dice «obligatorio, cuando corresponda» y no define cuándo. Si la respuesta difiere, cambia la regla A.2.
- **Contradicción de la ficha con el XSD:** falta saber cuál manda. Se puede preguntar al SRI o a Factuplan.
- **`NOR-005`:** sigue sin leerse el texto de la resolución. No afecta a este cambio, porque el `RUC Proveedor` se comprueba en el 4.

## Decisiones y recomendaciones

- **Confirmadas por el titular el 2026-11-01:** correo exigido al preparar, plazo solo en la preparación, detalle escrito en el mantenimiento y ambiente pasado al cambio 3.
- **Recomendadas, sujetas a la aprobación de esta propuesta:** el resto de `DP-035`, las salidas de la tabla B y la tabla de diferencias nuevas.

## Fuentes consultadas

**Completas:** `docs/negocio/decisiones/decisiones-confirmadas.yaml`, `docs/arquitectura/modelo-dominio.md`, `docs/cambios-pendientes.md`, `docs/negocio/requisitos/matriz-normas-facturacion-electronica.md`, `docs/tecnico/matriz-instantanea-fiscal.md`, propuesta archivada de `incorporar-facturacion-electronica-en-v1` y las specs `normativa-de-facturacion-electronica`, `preparacion-y-seguimiento-fiscal`, `identidad-y-numeracion-fiscal` y `configuracion-operativa-y-fiscal`.

**Por búsqueda dirigida:** `reglas-negocio.md`, `requisitos-funcionales.md`, `requisitos-no-funcionales.md`, `glosario.md`, `ADR-0010` y las specs `operacion-artesanal-de-servicios`, `servicios-aplicados-al-mantenimiento` y `gestion-de-clientes`.

**Fuente oficial:** ficha técnica 2.34 del SRI, descargada el 2026-11-01 (apartado 4.7, tablas de factura 2.1.0, Anexos 21, 22, 24, 25 y 26) y `factura-2.1.0.xsd` del repositorio.

**Código, solo como estado actual:** módulos `fiscal`, `workshop_configuration` y `workshop`. `docs/negocio/historico/` no se consultó.

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
