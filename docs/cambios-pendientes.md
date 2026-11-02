# Cambios pendientes para terminar Tallkit

| Campo | Valor |
|---|---|
| Fecha | 2026-11-01 |
| Cambios activos en OpenSpec | `alinear-datos-del-comprobante-con-sri` (cambio 2) |
| Cambios pendientes | 15, más 1 diferido |
| Proveedor actual | Factuplan; reemplazable sin rehacer el sistema |
| Fecha límite | No hay |
| Estado | Plan de trabajo; cada cambio se aprueba por separado en OpenSpec |

Este archivo es la lista de seguimiento. Marca cada casilla al completarla. No sustituye a OpenSpec:
cada cambio tiene su propuesta, specs, diseño y tareas propias.

## Regla para cada cambio

Ninguna regla anterior es intocable, pero ninguna se reemplaza en silencio. Antes de escribir la
propuesta de un cambio:

1. **Buscar:** leer las decisiones confirmadas, el modelo de dominio, las reglas y las specs del área.
2. **Comparar:** listar cada regla o decisión que el cambio contradice o limita.
3. **Analizar:** explicar qué pasa si se mantiene la anterior y qué pasa si se adopta la nueva.
   Revisar dinero, inventario, impuestos, seguridad y datos ya guardados.
4. **Decidir:** el usuario elige una de estas salidas.
   - **Reemplaza:** la regla nueva sustituye a la anterior.
   - **Se ajusta:** la anterior sigue vigente con una excepción escrita.
   - **Se mantiene:** el cambio se adapta a la regla anterior.
   - **Se aplaza:** el tema queda abierto y el cambio no depende de él.
5. **Registrar:** una decisión que reemplaza a otra recibe un número `DP` nuevo y la anterior queda
   marcada como sustituida, igual que `DP-030` sobre `DP-022`.
6. **Sincronizar:** actualizar alcance, reglas, requisitos, modelo de dominio, specs, glosario,
   trazabilidad y ADR antes de archivar.

Los choques listados abajo son los ya detectados; cada cambio debe buscar si existen otros. Lo legal
y lo tributario se confirman con la norma oficial, un contador o un abogado.

## Regla de independencia del proveedor

Tallkit factura; el proveedor solo es un medio para llegar al SRI. Cambiar de proveedor debe significar
agregar un adaptador y cambiar una configuración, sin tocar ventas, taller, cobros ni pantallas.

1. **Interfaz neutral:** el módulo `fiscal` define qué necesita: emitir, consultar, descargar XML y RIDE,
   y corregir un rechazo. No menciona a ningún proveedor.
2. **Un solo lugar por proveedor:** cada integración vive en su propia carpeta de adaptador. Una prueba
   de fronteras impide importarla o nombrarla desde otro módulo.
3. **Estados propios:** Tallkit usa sus estados: pendiente, en proceso, autorizado, no autorizado y
   error temporal. Cada adaptador traduce los del proveedor.
4. **Datos propios:** el comprobante se arma desde la instantánea fiscal de Tallkit. Los códigos, campos
   y nombres del proveedor no entran al dominio.
5. **Referencia externa aparte:** proveedor, identificador externo y respuesta técnica se guardan
   separados del comprobante. La clave de acceso y el número son los datos oficiales.
6. **Elección por configuración:** el proveedor se elige por entidad fiscal y ambiente. Las credenciales
   van en variables de entorno, fuera del repositorio y del navegador.
7. **Capacidades declaradas:** cada adaptador indica qué hace: enviar correo, asignar numeración, agregar
   `RUC Proveedor`, o emitir notas de crédito sobre originales de otro sistema. Tallkit se adapta a eso.
8. **Copia propia:** el XML autorizado y el RIDE se guardan en el archivo fiscal de Tallkit. Nunca se
   dependerá del proveedor para conservarlos durante 7 años.
9. **Numeración portable:** Tallkit guarda el último número autorizado de cada serie, para continuarla
   con otro proveedor.
10. **Adaptador simulado:** desarrollo, pruebas y E2E usan un adaptador local que no llama a nadie ni
    consume cupo.
11. **Pruebas de contrato:** la misma batería de pruebas valida a cada adaptador.

### Lo que un cambio de proveedor sí exige

- Programar su adaptador y pasar las pruebas de contrato.
- Subir la firma de cada RUC, el logo y los datos del emisor en el proveedor nuevo.
- Terminar los comprobantes en proceso antes de cambiar.
- Fijar en el proveedor nuevo el siguiente número de cada serie.
- Si cambias a Ruxi: hacer antes el cambio 16, porque su API no envía correos.
- Si cambias a Ruxi: corregir en el portal del SRI las facturas emitidas con el proveedor anterior,
  porque solo acepta notas de crédito sobre originales emitidos en Ruxi.

## Antes de empezar

- [x] Registrar en Git el archivo de `redisenar-pagina-de-inicio`, los ajustes de proformas y este plan
- [x] Elegir el proveedor: Factuplan
- [x] Confirmar el correo: se usará el de Factuplan por ahora
- [ ] Confirmar las reglas de venta a consumidor final del cambio 6
- [ ] Confirmar si el dueño usará la tablet solo dentro del taller
- [ ] Confirmar si el desarrollador de Tallkit debe registrarse como proveedor ante el SRI (validación V-2 de la [matriz de normas](negocio/requisitos/matriz-normas-facturacion-electronica.md))
- [ ] Preguntar al contador o al SRI qué se hace si no hay Internet al facturar y qué fecha lleva ese comprobante (V-1); el cambio 3 no puede diseñarse sin la respuesta
- [ ] Volumen mensual de facturas de cada RUC
- [ ] Régimen del RUC comercial definitivo: si fuera RIMPE Negocio Popular, antes de activarlo hay que resolver la contradicción entre la ficha y el XSD (`NOR-020`)
- [ ] Último secuencial del Facturador del SRI y su establecimiento y punto de emisión
- [ ] RUC comercial definitivo y firma electrónica vigente de ese RUC

## Proveedor actual: Factuplan

El proveedor genera el XML, lo firma, lo envía al SRI, sigue la autorización, genera el RIDE y envía el
correo. Tallkit reúne los datos, llama a la API, guarda el resultado, muestra el estado, atiende los
errores y conserva su propia copia.

**Comprobado**

- [x] XML firmado y válido contra el esquema oficial, con IVA 15 % y 0 %
- [x] `RUC Proveedor`: Signiadigital S.A. consta en el catastro del SRI
- [x] Emisión por API con clave de pruebas, estado `COMPLETED`
- [x] Correo recibido por el comprador

**Pendiente**

- [ ] Obtener una autorización real del SRI; hasta ahora todas fueron simuladas
- [ ] Probar crédito, pago combinado, rechazo y nota de crédito
- [ ] Confirmar por qué las pruebas consumieron cupo, aunque la documentación dice que no
- [ ] Confirmar que Gold incluye API en producción y que el cupo se comparte entre los dos RUC
- [ ] Confirmar el excedente de Gold: el panel dice $0.0025 y los demás planes $0.025
- [ ] Confirmar el precio anual: el panel dice que ahorra 2 meses y la página pública no
- [ ] Preguntar si el correo puede salir sin la marca de Factuplan
- [ ] Contrato de tratamiento de datos y plazo de exportación al cancelar

El plan Free va hasta el 2026-12-01 y lleva 3 de 25 documentos usados. Conviene reservar los restantes:
el desarrollo debe usar el adaptador simulado.

| Dato técnico | Valor |
|---|---|
| Plan previsto | Gold: $13.80 al mes con IVA, 100 documentos y hasta 4 contribuyentes |
| Plan si superan el cupo | Básico: $19.55 al mes con IVA, 500 documentos y hasta 5 contribuyentes |
| Autenticación | `X-API-Key` y `x-taxpayer-ruc` en cada solicitud |
| Emisión | `POST /v1/developer/invoices` |
| Idempotencia | `devReference` |
| Consulta | `GET /v1/developer/receipts/{id}/status` |
| Archivos | `/xml` y `/pdf`, con enlaces que caducan en 5 minutos |
| Correo | `sendEmail`; con `false`, lo enviaría Tallkit |
| Numeración | `PATCH /v1/developer/invoices/sequential`, con el último número usado |
| `User-Agent` | Obligatorio y propio; Cloudflare rechaza el de Python con error 1010 |
| Webhooks | No se usan: la mini PC no tiene dirección pública |

**Alternativa: Ruxi.** Consta en el catastro y su plan Negocio cuesta $113.85 al año, pero sus dos
facturas de prueba no se autorizaron el 2026-11-01 y su API no envía correos.

## Etapa 1: facturación electrónica

La emisión empieza por el RUC artesanal, porque es lo que pidió el cliente. Sin Internet no se podrá
emitir: la venta u operación queda registrada y el comprobante espera en Tallkit hasta recuperar la
conexión.

### 1. `incorporar-facturacion-electronica-en-v1`

Decisión nueva que incluye la facturación electrónica en V1 y la emisión por proveedor reemplazable.
Actualiza alcance, reglas, requisitos, casos de uso, modelo de dominio y ADR, y crea una matriz de
normas con el texto oficial. No toca código.

**Choques por decidir**

- [x] `DP-018`: V1 emite documentos internos, no facturas autorizadas. Reemplaza en parte (`DP-034`)
- [x] Límites de V1: sin facturación electrónica real ni conexión con el SRI. Reemplaza
- [x] `alcance-v1.md`: secciones 2.2 y 6, y `FUT-001`. Reemplaza
- [x] `RF-FIS-003` y `RF-REP-014`: numeración solo de pruebas y referencia fiscal futura. `RF-FIS-003` se ajusta; `RF-REP-014` se reemplaza
- [x] `ADR-0010`: producción reservada a una integración futura. Se ajusta con una sección «Actualización»
- [x] `RNF-DIS-001`: la operación solo dependía de la red local; emitir necesita Internet. Se ajusta
- [x] `RN-FIS-012`, `RN-FIS-014`, `RF-FIS-006` y la exclusión final de requisitos (no listados al inicio). Se ajustan y se reemplaza la exclusión
- [x] Convivencia del comprobante interno con el RIDE y permisos de emisión. Se aplazan a los cambios 5, 3 y 7

**Pasos**

- [x] Propuesta aprobada
- [x] Specs aprobadas
- [x] Diseño aprobado
- [x] Tareas aprobadas
- [x] Aplicado
- [x] Verificado
- [x] Archivado y registrado en `master` (`openspec/changes/archive/2026-11-01-incorporar-facturacion-electronica-en-v1`)

### 2. `alinear-datos-del-comprobante-con-sri`

Ajusta los datos propios de Tallkit a la ficha técnica 2.34, sin depender de ningún proveedor. Depende
del cambio 1. Registra la decisión `DP-035`.

- Correo del receptor al facturar, porque el envío por correo es obligatorio (`NOR-001`): se exige al preparar la factura de un comprador identificado, sin tocar el registro del cliente.
- Plazo en días para las ventas a crédito con saldo pendiente: solo un dato del comprobante, sin vencimiento ni mora.
- Leyenda de Negocio Popular y condición de gran contribuyente, derivadas del perfil del emisor.
- Formatos del contribuyente especial (3 a 13) y del agente de retención (sin ceros a la izquierda).
- Pantalla para el detalle adicional (hasta 12 datos) y nota por servicio, escrita en el mantenimiento.
- Instantánea de formato 4: nombre comercial, dirección del establecimiento, plazo, detalle y gran contribuyente.

**Pasa a otros cambios**

- Ambiente de pruebas o producción por entidad fiscal: cambio 3, junto con la activación por RUC, porque aquí solo habría una opción posible.
- Comprobación de `RUC Proveedor` en el XML autorizado: cambio 4; aquí solo se reserva su nombre.
- Redondeo del IVA incluido en el precio (`DP-025`, `EXT-002`, `NOR-018`, `V-5`): validación externa. Sigue siendo condición de activación del RUC comercial (`RN-FIS-017`); el artesanal factura a 0 %. Un cambio archivado lo delegó a `alinear-calculo-de-iva-con-el-sri`, que nunca se creó y ya no se creará.
- Preparaciones completadas antes de este cambio, sin correo ni plazo: se conservan; el cambio 3 decide si hay que reemplazarlas antes de emitir.
- Un cliente sin correo no puede recibir factura con sus datos hasta que se lo completa: el cambio 5 revisa la entrega impresa.

**Choques resueltos**

- [x] `DP-008` Cliente: correo opcional al registrar. Se mantiene: ya preveía exigirlo al facturar
- [x] `DP-003`, `DP-027`, `RF-PAG-012` y `RN-VEN-008`: crédito sin plazo frente al `plazo` y `unidadTiempo` del XML. Se ajusta: el plazo existe solo en el comprobante
- [x] `DP-025`: regla de redondeo del IVA incluido frente a la validación del SRI (V-5). Se aplaza
- [x] `DP-031`: la leyenda de Negocio Popular estaba por confirmar; la ficha 2.34 la confirma (`NOR-002`). Se ajusta, y consta la contradicción con el XSD (`NOR-020`)
- [x] `matriz-instantanea-fiscal.md`: campos marcados como no aplicables. Se corrige
- [x] Spec `identidad-y-numeracion-fiscal`: ambiente único de pruebas. Se aplaza al cambio 3
- [x] `DP-031`: contribuyente especial de 1 a 13 y agente de retención con ceros iniciales, frente a la ficha y el XSD. Se ajusta

**Pasos**

- [x] Propuesta aprobada
- [x] Specs aprobadas
- [x] Diseño aprobado
- [x] Tareas aprobadas
- [x] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 3. `emitir-comprobantes-electronicos`

Crea el núcleo independiente del proveedor. Aplica la regla de independencia y deja `ADR-0013`.
Depende del cambio 2.

- Interfaz neutral, capacidades declaradas y adaptador simulado.
- Estados propios, referencia externa y pruebas de contrato.
- Cola de emisión y tarea programada que consulta los pendientes y reintenta.
- Un comprobante en proceso no se reenvía; el SRI puede tardar hasta 24 horas.
- Un fallo de emisión no deshace la venta ni el cobro.
- Botón «Facturar» en ventas y operaciones artesanales, usando el simulado.
- Archivo automático del XML autorizado y del RIDE.
- Antes del diseño: resolver con el titular la fecha, el plazo y la fuerza mayor del comprobante que espera sin Internet. El art. 7 de la `NAC-DGERCGC18-00000233` exige transmitir en el momento de la transacción (fila `NOR-008`, validación V-1).
- Decidir los permisos de emisión por rol y la lista de estados de la referencia fiscal, que el modelo de dominio y la regla de independencia plantean distinta.
- Actualizar `docs/architecture/c4-containers.md` con el adaptador y la conexión de salida.
- Ambiente de pruebas o producción por entidad fiscal, que el cambio 2 dejó aquí.
- Decidir qué pasa con las preparaciones completadas sin correo ni plazo antes del cambio 2.

**Choques por decidir**

- [ ] `NOR-007`: punto de emisión exclusivo para la modalidad electrónica, frente al Facturador del SRI
- [ ] `NOR-008`: transmisión en el momento de la transacción frente a «el comprobante espera en Tallkit» de `DP-034`
- [ ] `RF-FIS-002` y `RF-FIS-003`: estados locales y producción rechazada
- [ ] `ADR-0010`: la emisión debe ocurrir fuera de las transacciones comerciales
- [ ] `DP-006`: los números internos siguen separados de la numeración fiscal
- [ ] Spec `preparacion-y-seguimiento-fiscal`: estados que hoy no admiten resultado oficial
- [ ] `operacion-archivo-fiscal.md`: requisitos del archivo productivo

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 4. `conectar-emision-factuplan`

Agrega el adaptador de Factuplan y pasa las pruebas de contrato, sin cambiar el núcleo. Registra las
credenciales, fija la numeración del Facturador del SRI y empieza por el RUC artesanal. Depende del
cambio 3.

- Prueba real supervisada (`RN-FIS-018`): fijar antes la cantidad y los casos, usar operaciones reales con un comprador que lo acepte y programar la excepción de `xml_archive.py:174`, que hoy bloquea los XML de producción.
- Condiciones de activación por RUC: solicitud de autorización de emisión ante el SRI (`NOR-007`), `RUC Proveedor` en cada comprobante (`NOR-004` y `NOR-005`, con plazo ya vencido), punto de emisión exclusivo y certificado vigente.
- Registro del desarrollador ante el SRI, si corresponde (V-2).
- Comprobación de `RUC Proveedor` en el XML autorizado (`NOR-004`, `NOR-005`); el cambio 2 solo reservó su nombre.
- Confirmar con el proveedor que acepta plazo y detalle por línea.

**Choques por decidir**

- [ ] `RN-FIS-014` y `RF-FIS-006`: excepción de la prueba real, aprobada en `DP-034` y todavía sin programar
- [ ] Spec `configuracion-operativa-y-fiscal`: metadatos del certificado sin custodia de la firma
- [ ] `RNF-SEG-008`: guardar las credenciales fuera del repositorio
- [ ] Protección de datos: el proveedor trata datos de clientes fuera del Ecuador
- [ ] `ADR-0010`: el modelo no debe adoptar los códigos del proveedor

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Cantidad y casos de la prueba real definidos
- [ ] Pruebas con clave de pruebas, cuidando el cupo
- [ ] Primera factura real autorizada y confirmada en el SRI (prueba real supervisada)
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 5. `entregar-comprobantes-al-cliente`

Muestra y descarga el RIDE en Tallkit, y muestra el estado de entrega del correo. Por ahora el correo
lo envía Factuplan; la capacidad queda declarada para poder cambiar. Depende del cambio 4.

**Choques por decidir**

- [ ] `DP-018`: decidir cómo convive el comprobante interno con el RIDE (aplazado a este cambio por `DP-034`)
- [ ] Logotipo: los comprobantes internos ya llevan el de la empresa
- [ ] Cliente sin correo: cómo se le entrega el RIDE impreso, que `NOR-009` permite solo si no se puede enviar (`DP-035`, regla 1)

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 6. `vender-a-consumidor-final-sin-registro`

Permite vender en mostrador sin registrar a la persona. Registrar a un cliente sin vehículo sigue
siendo válido y es lo recomendable cuando quiere factura con sus datos.

Reglas propuestas:

- Hasta 50 dólares: se elige «Consumidor final» y no se piden datos.
- Más de 50 dólares: se identifica al comprador.
- A crédito: no se permite.
- Al facturar: se avisa que no se podrá anular ni corregir con nota de crédito.

**Choques por decidir**

- [ ] `DP-008` y `RN-CLI-003`: V1 no registra clientes sin identificación
- [ ] Spec `ventas-comerciales`: la venta referencia a un cliente registrado
- [ ] `DP-033`: la venta generada desde una proforma exige cliente registrado
- [ ] `DP-014` y `DP-028`: una devolución no podrá corregir esa factura ante el SRI
- [ ] `RF-PAG-009`: cuentas por cobrar por cliente

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 7. `aplicar-notas-de-credito-y-anulaciones`

Convierte las solicitudes locales en efectos reales: nota de crédito por la interfaz neutral y registro
de anulaciones hasta el día 7 del mes siguiente. Las facturas emitidas antes en el SRI se corrigen en el
portal del SRI si el proveedor no las admite. Depende de los cambios 3 y 4. Decide los permisos para corregir por rol. Las filas `NOR-010` y `NOR-011` de la matriz de normas ya verifican el plazo del día 7 y que una factura a consumidor final no admite anulación ni nota de crédito.

**Choques por decidir**

- [ ] Spec `solicitudes-de-correccion-fiscal`: hoy no ejecuta efectos oficiales
- [ ] `DP-014` y `DP-028`: relación entre devolución comercial y nota de crédito
- [ ] `RF-FIS-005`: solicitudes solo locales
- [ ] Consumidor final: no admite anulación ni nota de crédito

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

## Etapa 2: operación pendiente

### 8. `cerrar-caja-diaria-por-ruc`

Cierre diario por entidad fiscal, efectivo y transferencia, con explicación de diferencias.
Cubre `RF-REP-011` y `RF-REP-012`.

**Choques por decidir**

- [ ] `DP-019`: cajas lógicas separadas aunque una persona maneje el dinero
- [ ] `DP-032`: una retención reduce el saldo, pero no es dinero cobrado
- [ ] `DP-028`: reembolsos dentro del cierre

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 9. `cancelar-ordenes-y-reembolsos-artesanales`

Agrega el estado cancelado de un mantenimiento (`RF-TAL-014`) y la devolución de dinero en servicios.

**Choques por decidir**

- [ ] `RN-TAL-005` y `RN-TAL-013`: reglas de cancelación aplazadas
- [ ] `DP-029`: anulación artesanal sin pagos vigentes y venta vinculada confirmada que no se anula
- [ ] `DP-028`: el reembolso solo está definido para ventas comerciales
- [ ] Cancelar una orden que ya tiene una factura autorizada

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 10. `completar-operaciones-de-inventario`

Desarme de kits, consumo interno, devolución a proveedor y reposición por corrección. Cubre
`RF-INV-016` a `RF-INV-019`. Puede dividirse en varios cambios.

**Choques por decidir**

- [ ] `DP-010`, `DP-015`, `DP-016` y `DP-011`: reglas base de cada operación
- [ ] `DP-030`: una entrada sin costo frente a la devolución ligada al ingreso original
- [ ] `EXT-001`: validación contable de consumos internos y reposiciones

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 11. `generar-reportes-y-exportaciones`

Reportes por RUC, operaciones anuladas, margen bruto y exportación. Cubre los `RF-REP` restantes.
Conviene hacerlo después de los cambios 8 y 10.

**Choques por decidir**

- [ ] `RF-REP-009`: el formato de exportación no está aprobado
- [ ] `RF-REP-003` y `DP-030`: reporte por proveedor cuando el proveedor es opcional
- [ ] `RF-REP-013` y `DP-030`: margen de productos sin costo registrado
- [ ] `RNF-DAT-002`: exportaciones con datos personales

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 12. `alertar-stock-bajo`

Umbral por producto y aviso. Cubre `RF-INV-011` y `RF-ACC-013`. Es opcional para salir a producción.

**Choques por decidir**

- [ ] Decisiones confirmadas: las alertas constan como pendientes sin decidir

**Pasos**

- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

## Etapa 3: salida a producción

### 13. `proteger-datos-personales-y-conservacion`

Aviso de privacidad, derechos del titular, política de conservación, purga de auditoría y relación
con el proveedor. Necesita revisión de un abogado.

**Choques por decidir**

- [ ] `RNF-DAT-004` y `RNF-AUD-006`: política de conservación pendiente
- [ ] Conservar comprobantes 7 años frente a solicitudes de eliminación
- [ ] Spec `archivo-de-comprobantes-fiscales`: política requerida por entidad fiscal
- [ ] Transferencia de datos al extranjero: Factuplan declara proveedores en Estados Unidos

**Pasos**

- [ ] Revisión legal hecha
- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`

### 14. `instalar-en-windows-local`

Cierra `DA-003` y deja `ADR-0014`: instalación directa en Windows, HTTPS, respaldos, restauración,
actualización, tarea programada de emisión y cierre de sesión por inactividad. Detalle en el
[plan de instalación](https://claude.ai/artifact/7EnmWRe96e9zeZCG1HvjFB).

**Choques por decidir**

- [ ] `ADR-0003`: Nginx sirve la aplicación; en esta instalación lo haría Caddy
- [ ] `RNF-DIS-002` a `RNF-DIS-007`: respaldo y restauración probados antes de producción
- [ ] Sesiones: hoy duran dos semanas y la computadora es compartida
- [ ] `RF-FIS-006`: política y restauración para el archivo productivo

**Pasos**

- [ ] Piloto en la mini PC aprobado
- [ ] Propuesta aprobada
- [ ] Specs aprobadas
- [ ] Diseño aprobado
- [ ] Tareas aprobadas
- [ ] Aplicado
- [ ] Verificado
- [ ] Archivado y registrado en `master`
- [ ] Instalado en el taller

### 15. `sincronizar-trazabilidad-y-aceptacion`

Corrige la documentación desactualizada y cierra la aceptación final.

- `matriz-trazabilidad.md` dice que solo identidad está implementada.
- `cobertura-modulo-fiscal.md` enlaza rutas de cambios ya archivados.
- La revisión visual humana sigue pendiente en varias capacidades.

**Pasos**

- [ ] Trazabilidad actualizada
- [ ] Enlaces corregidos
- [ ] Revisión visual hecha
- [ ] Criterios de `alcance-v1.md` comprobados

## Diferido

### 16. `enviar-correo-desde-tallkit`

Tallkit envía el XML y el RIDE con el logo del taller, usando su propia cuenta y `sendEmail: false`.
Se hará si el cliente quiere quitar la marca de Factuplan, o si se cambia a un proveedor que no envíe
correos. No afecta a la facturación.

- [ ] Decidir si se hace

## Validaciones externas

- [ ] Contador: tarifas, clasificación tributaria y redondeo (`EXT-002`, `V-5`)
- [ ] Contador: si una venta a crédito sin fecha acordada debe llevar plazo en la factura y qué número (`V-6`)
- [ ] SRI o proveedor de emisión: leyenda de RIMPE Negocio Popular frente al XSD 2.1.0 (`NOR-020`)
- [ ] Contador: consumos internos y reposiciones sin cargo (`EXT-001`)
- [ ] Contador: dejar de registrar el IVA de compras y existencias sin valor (`DP-030`)
- [ ] Contador: calificación artesanal e IVA 0 %
- [ ] Abogado: datos personales y proveedor
- [ ] SRI: texto oficial de las resoluciones `NAC-DGERCGC25-00000014`, `NAC-DGERCGC25-00000017` y `NAC-DGERCGC26-00000027`
