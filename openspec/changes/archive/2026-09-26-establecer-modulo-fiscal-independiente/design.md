## Context

Diseño propuesto de `establecer-modulo-fiscal-independiente`, sujeto a aprobación antes de crear tareas. La propuesta y las siete specs son las dependencias normativas; las specs revisadas quedaron registradas en `master` mediante `4dc3bca` y coinciden con `develop` (`8e77e4f`). Este documento no autoriza implementación, emisión ni conexión externa.

El sistema mantiene dos contribuyentes y tres roles acumulables. `sales.Sale` y `workshop.ServiceOperation` conservan operaciones económicas diferentes; comparten cálculo decimal en `shared/money.py`. La referencia fiscal podrá apuntar a cualquiera sin unificar sus documentos, pagos o impuestos. El maestro continúa utilizando su facturador externo mientras esta fase permite preparar información y archivar evidencia.

### Fuentes, estado observado y discrepancias

Se consultaron las decisiones confirmadas completas y el modelo conceptual; propuesta, specs y referencias terminológicas del cambio; specs principales de configuración, ventas y operación artesanal; reglas del producto, glosarios y requisitos relacionados citados por las specs. Aplican DP-006/008/017/018/025/027/029, CT-001, RN-FIS, RN-CON, RF-AUD, RNF-INT, RNF-DAT y DA-003 en el alcance acotado del archivo.

Se inspeccionaron `docs/tecnico/arquitectura-inicial.md`, ADR-0001/0003/0004/0006/0007/0008, modelos de configuración, ventas y taller, servicios `configuration_resolver.py`, `numbering.py`, `sales/application/commands.py`, `sales/application/reviews.py`, `workshop/application/service_operations.py`, autorización, `shared/money.py`, `shared/transactions.py`, dependencias, rutas del backend y organización del frontend.

Hallazgos que condicionan este diseño:

- Los encabezados antiguos que dicen «dominio aún no implementado» están desactualizados: existen modelos, servicios y pruebas funcionales. Se reutilizan esas capacidades; el texto antiguo no justifica reescribirlas.
- DM-001 figura pendiente en el modelo conceptual, pero DP-029 y ADR-0008 ya resuelven documentos económicos separados. Prevalece la decisión confirmada.
- Los cálculos inclusivos comerciales y artesanales están aprobados por línea. La afirmación externa de que deben sustituirse por un cálculo global de IVA no es una decisión del proyecto. Las incompatibilidades de representación fiscal bloquearán la preparación, sin alterar valores históricos.
- Los XML, XSD y catálogos oficiales son la referencia de formato; los ejemplos de AutorizadorEC solo aportan evidencia de compatibilidad posible. Sus modos, estados y credenciales no forman el contrato del dominio.
- Las specs mencionan casos de precisión con cantidades fraccionarias; esa cobertura no habilita fracciones de presentaciones en ventas. Se aplica a validación de evidencia externa y casos admitidos por el origen; se preservan DP-009/025.
- No están verificados el perfil real de ambos emisores, los antecedentes de numeración ni la recuperación operativa. Se representan como información pendiente, nunca como valores predeterminados inventados.

## Goals / Non-Goals

**Goals:** completar configuración fiscal, preparar instantáneas verificables, asignar identidad exclusivamente de ensayo, conservar evidencia externa íntegra, preparar correcciones locales y consultar todo ello con permisos por **entidad fiscal**. Mantener autonomía respecto de proveedores, trazabilidad de intentos y continuidad del negocio interno.

**Non-Goals:** generar XML nuevos de emisión, firmar, custodiar P12 o contraseñas, conectar SRI/proveedores, implementar webhooks o trabajadores de emisión, emitir en producción, crear RIDE fiscales o correos, resolver el régimen del futuro RUC, habilitar nuevos medios de cobro, cambiar devoluciones, implementar contabilidad o respaldo integral. No se añaden tablas para futuros proveedores ni interfaces vacías sin consumidor actual.

## Decisions

### D1. Frontera fiscal propia dentro del monolito

Crear en la implementación `backend/src/fiscal/` con `domain/`, `application/`, `infrastructure/` y `api/`. El **monolito modular** conserva un despliegue y PostgreSQL. Dominio contiene valores, reglas de identidad, coherencia, receptor y elegibilidad, sin Django, HTTP ni proveedor. Aplicación coordina comandos y permisos; infraestructura contiene persistencia, lectura segura de XML y esquemas; API traduce entradas y errores.

`workshop_configuration` conserva propiedad del emisor, perfil, establecimientos, puntos, metadatos de certificado y correspondencias tributarias. `fiscal` posee preparación, identidad fiscal, archivo, vínculos y solicitudes. La numeración COM-VEN/ART-SER sigue íntegramente en configuración: no se reutiliza `DocumentSeries` como contador SRI.

Los nuevos servicios públicos de lectura `sales/application/fiscal_source.py` y `workshop/application/fiscal_source.py` devolverán una copia tipada con identidad del origen, emisor, versión, estado, valores históricos y correcciones. También ofrecerán lectura bajo bloqueo dentro de una transacción exterior. Estos archivos son propuestos, no existentes. Fiscal no modifica modelos ajenos ni necesita permiso administrativo para una colaboración interna ya autorizada. Consultas comerciales no importan fiscal: el frontend compone el detalle existente con una consulta fiscal separada.

Alternativas descartadas: incorporar toda la lógica a ventas duplicaría la variante artesanal; hacer documentos comerciales universales contradice ADR-0008; copiar el JSON de un proveedor produciría dependencia innecesaria. Una preparación fiscal común es referencia posterior a operaciones separadas, no sustitución de sus documentos económicos.

### D2. Configuración versionada y desconocidos explícitos

Extender la capacidad de configuración mediante servicios propios, conservando el contrato actual de confirmaciones. Añadir un perfil electrónico por emisor con revisión; condiciones tributarias con aplicabilidad conocida/desconocida, valor, fuente y vigencia; establecimientos y puntos con códigos de tres caracteres; certificado con metadatos declarados, sin material privado.

Las revisiones usadas quedan protegidas. Establecimiento es único por entidad y punto por establecimiento; los códigos utilizados no se renombran. La preparación captura la revisión pertinente y el RUC exacto. Un cambio de identidad del emisor ya utilizado debe ser rechazado también desde el servicio existente de configuración, para evitar que un identificador estable termine representando otro contribuyente; desactivar o corregir datos descriptivos no altera snapshots.

Catalogar las reglas oficiales como versiones inmutables con procedencia y fechas. El Administrador relaciona definiciones tributarias existentes con impuesto, tratamiento y código de porcentaje. No podrá editar el significado oficial de un código: cambiar el catálogo requiere una nueva versión revisada. Se bloquean correspondencias ambiguas, faltantes o incompatibles con la tarifa histórica. La resolución para fiscal se añade como contrato separado; no se exige perfil electrónico a ventas o taller.

La fecha histórica del origen gobierna su tratamiento congelado; la fecha de referencia fiscal gobierna el formato y las reglas documentales aplicables. Un desacuerdo se muestra como impedimento, sin elegir automáticamente tarifas actuales. La versión empleada se conserva en la instantánea.

Alternativa descartada: completar perfiles con régimen general, IVA cero o punto 001 por defecto. Omitir información no significa que no aplique.

### D3. Preparación y snapshot suficientes, con revisión explícita

Crear borrador desde exactamente un origen confirmado vigente. El identificador estable de preparación es UUID. La persistencia mantendrá referencias protegidas explícitas a venta o a operación artesanal, con restricción de exactamente una de ellas para factura ordinaria, en lugar de una referencia genérica sin integridad. Dos restricciones únicas condicionales impedirán más de una preparación activa por origen. Borrador y preparada cuentan como activas; cancelada libera esa exclusividad conservando historia.

El borrador tiene versión optimista. La revisión devuelve impedimentos por campo y un token firmado que incluye usuario, preparación, versión, huella del origen, revisiones de configuración y reglas, y fecha de referencia. Caduca a los 15 minutos; nunca sustituye revalidación al preparar. Una modificación concurrente exige nueva revisión. El reloj de fecha fiscal utiliza `America/Guayaquil`; los instantes de auditoría se conservan con zona, independientemente del navegador.

Al preparar, guardar snapshot versionado e inmutable, con cadenas decimales exactas, y una huella canónica. Columnas separadas sirven para identidad, búsquedas, permisos y restricciones; JSON validado conserva la estructura histórica completa. No almacenar secretos, textos operativos completos ni datos del vehículo salvo información fiscal justificada. La posterior asignación de identidad se conserva como registro inmutable vinculado; no reescribe el snapshot.

Contenido mínimo y correspondencia a documentar en la implementación:

| Grupo fiscal | Origen conservado / regla |
|---|---|
| Emisor, RUC, domicilio y condiciones | Revisión del perfil; leyendas con fundamento y aplicabilidad |
| Establecimiento, punto y ambiente | Selección explícita y revisión usada |
| Receptor y domicilio requerido | Copia revisada; separada del cliente operativo, con procedencia de completados |
| Fecha y moneda | Fecha de referencia local; USD; futura traducción de formato sin cambiar significado |
| Líneas | Identificador/código y descripción históricos; cantidad; precio final; precio unitario sin impuesto; base, código, tarifa e impuesto |
| Totales | Sumas históricas; grupos por código y tratamiento; total exacto |
| Descuento y propina | Cero técnico cuando el esquema lo exija; sin habilitar captura comercial |
| Pagos declarados | Medio fiscal e importe que cubre el total, plazo/unidad cuando corresponda; distintos de cobros efectivos |
| Información adicional | Solo datos pertinentes y límites de la versión soportada |
| Identidad | Referencia a asignación posterior de ensayo; sin número productivo |
| Firma y autorización | Ausentes en preparación local; no se simulan valores para completar campos |

La matriz definitiva deberá cubrir cada campo obligatorio/condicional del XSD soportado, con ubicación, derivación o no aplicabilidad justificada. Es evidencia de suficiencia, no un generador XML. Factura 2.1.0 es el objetivo inicial de preparación; el registro de esquemas enumera expresamente las versiones de archivo admitidas para factura y nota de crédito. Un esquema no incorporado se rechaza con explicación.

Alternativa descartada: consultar el cliente o catálogo actual cada vez que se presente una preparación; rompería la historia.

### D4. Precisión sin modificar la economía

Reutilizar los valores confirmados de `shared/money.py`, no volver a calcular la operación desde los precios actuales. Mantener Decimal durante cálculos y texto decimal en la API propia. La conversión fiscal construye el precio unitario sin impuestos a partir de la base y cantidad históricas, con escala admitida por la versión oficial y redondeo HALF_UP; comprueba que su representación reproduce la base conforme a esas reglas. Las escalas máximas provienen del esquema versionado, no de ejemplos comerciales.

Se verifican base, impuesto y total por línea, sumas agrupadas por impuesto/tratamiento, total del documento y cobertura de medios declarados. Si una igualdad requerida por las reglas soportadas no se cumple, devolver los campos y valores esperados/observados y bloquear. No usar tolerancia arbitraria ni ajustar centavos para conseguir aceptación. Un precio sin impuestos puede precisar más decimales que un importe final; no se pasa por el parser comercial de dos decimales para truncarlo.

La validación del receptor comprueba formato según tipo y regla aplicable. No aplica dígito verificador universal a RUC. Consumidor final es una elección con límites y advertencias de las specs, nunca una sustitución automática del cliente incompleto. Crédito permanece condición: su representación fiscal puede exigir datos adicionales, sin crear cronogramas internos.

Alternativa descartada: un segundo motor comercial que sustituya la base histórica por otra base fiscal. Una incompatibilidad repetida requiere revisar requisitos con evidencia y aprobación, no una corrección silenciosa del diseño.

### D5. Identidad y numeración fiscal exclusivamente de ensayo

El nuevo ámbito fiscal identifica RUC conservado, tipo documental, establecimiento, punto y ambiente. Restricción única por esa combinación y contador propio de 1 a 999999999. Asignación protegida por preparación y por identidad de serie/número; clave de acceso única dentro del archivo de identidades. Código numérico de ocho dígitos se genera una vez durante la asignación y queda conservado, igual que fecha y dígito módulo 11.

El servicio exige transacción exterior, preparación válida en pruebas, coherencia del ámbito y ausencia de asignación previa incompatible. Bloquea el contador; inserta identidad, avanza contador y audita en una sola **transacción atómica**. La cancelación no libera números. Una anulación fiscal solicitada no recibe un nuevo tipo documental; solo una nota de crédito de ensayo admite identidad 04.

La asignación productiva se rechaza en dominio y aplicación, aunque el usuario sea Administrador. Registrar antecedentes o importar XML productivos no mueve contadores. Tampoco hay un interruptor administrativo que active emisión real en esta entrega.

Alternativas descartadas: `MAX()+1`, secuencia no reversible de base y contador compartido con documentos internos. La futura puesta en producción requerirá conciliar series/canales del mismo RUC y acordar un único asignador; no presupone códigos diferentes entre RUC.

### D6. Concurrencia, idempotencia y cambios del origen

Cada comando autoriza antes de recuperar un resultado. Aplicar el patrón de `sales/application/commands.py` en un recibo propio de fiscal, reutilizando utilidades puras de huella/validación sin importar modelos de comandos comerciales. Identidad de transporte por actor, acción y clave; identidad de preparación/sugerencia de corrección estable e independiente. **Idempotencia** incompatible responde conflicto. Dos operaciones reales iguales mantienen UUID y orígenes distintos.

Orden de bloqueos común para comandos fiscales:

1. Recibo del comando fiscal.
2. Origen comercial o artesanal, mediante servicio público; solo uno por preparación. No se solicita bloqueo de la orden después de una operación artesanal.
3. Preparación o solicitud y original fiscal relacionado, ordenados por identificador dentro de cada grupo.
4. Entidad/perfil, definiciones tributarias por ID y revisiones de configuración según ADR-0004; luego ámbito y contador fiscal, si corresponde.
5. Inserciones de evidencia, vínculos, resultado y auditoría.

Para correcciones sin origen interno se omite el paso 2; todas las afectaciones de una misma factura se serializan sobre el original fiscal antes de evaluar remanentes. Cargas sin vínculos no toman bloqueos comerciales. La vinculación se ejecuta como comando posterior, tomando origen antes del expediente; nunca se bloquea primero el archivo para después buscar la venta. Las escrituras de configuración solo toman sus recursos, sin llamar de vuelta a fiscal mientras mantienen bloqueos. La identificación de un emisor usado se consulta desde configuración sin adquirir bloqueos fiscales, protegida por el bloqueo común de entidad.

Las inserciones concurrentes de un primer borrador se resuelven con bloqueo del origen y restricciones únicas. No se mantiene ningún bloqueo durante parseo XML, red o exportación. Conflictos PostgreSQL se traducen después del rollback completo mediante `shared/transactions.py`; no se reintenta solo la numeración. Rechazos esperados se auditan fuera de la transacción revertida; un fallo de base deja únicamente diagnóstico técnico correlacionado.

Una corrección comercial posterior no actualiza fiscal: la consulta compara revisión/huella económica actual con la capturada y muestra discrepancia; las acciones locales revalidan bajo bloqueo. El cobro cambia su estado económico separado, no la instantánea fiscal. No se añaden señales que hagan fallar una venta por perfil fiscal incompleto.

### D7. Tres hechos diferentes: preparación, evidencia y emisión futura

Estados propios de preparación y solicitud: borrador → preparada → cancelada, o borrador → cancelada. Las correcciones de preparada requieren cancelación y reemplazo enlazado. El historial conserva actor, fecha, causa e identidad de cada comando; no se sobrescribe por reintentar.

El XML incorporado es evidencia externa con declaración de estado y procedencia; su nivel de verificación sigue siendo `EXTERNAL_UNVERIFIED`. No hay endpoint para cambiarlo a autorizado. La interfaz muestra separadamente preparación local, declaración del archivo y ausencia de comprobación oficial.

Los futuros intentos de transmisión y resultados oficiales serán recursos relacionados, con su propio ciclo y correlación, no nuevos valores de `Preparation.state`. No se crean aún modelos ni workers para ello. Un timeout futuro deberá conciliarse usando la identidad ya registrada; una integración no podrá borrar nuestro historial al corregir en el proveedor. No hay SDK ni credenciales de proveedor dentro del dominio fiscal.

Alternativa descartada: un único estado que mezcle pago, preparación, respuesta del proveedor y autorización SRI.

### D8. Archivo transaccional de XML en PostgreSQL

Para esta fase, conservar los bytes originales del XML en un registro de contenido separado dentro de PostgreSQL, con tamaño y SHA-256. Identidad documental, declaración de autorización, validación, contenido y auditoría se confirman conjuntamente. Las consultas de listados excluyen los bytes. La descarga autorizada comprueba integridad y devuelve exactamente el original.

El expediente agrupa una identidad y evidencias inmutables; permite añadir un envoltorio compatible sin reemplazar el comprobante previo. Deduplación por identidad fiscal y contenido; mismo archivo devuelve el existente. Identidad igual con contenido diferente produce conflicto, salvo una evidencia adicional expresamente compatible, conservada por separado. Un hash no prueba autenticidad; comparar contenido cuando sea necesario. Se conservan bytes del envoltorio y del documento suministrado, sin reserializar para almacenamiento. Firmas no se verifican criptográficamente en esta fase.

Límites iniciales de seguridad y operación: un XML por carga, máximo 2 MiB incluyendo envoltorio, XML interno extraído máximo 2 MiB, profundidad 64, máximo 50000 elementos y 100 atributos por elemento; sin archivos comprimidos ni importación por URL. Se publican antes de cargar y se aplican mientras se parsea, no después de construir un árbol ilimitado. Un documento mayor se rechaza de forma explícita; ampliar límites requiere revisión de recursos.

El límite propuesto hace viable conservar estos documentos pequeños en base; no se afirma un volumen real todavía desconocido. Se medirán tamaño y tiempo de restauración. La interfaz de repositorio permitirá migrar el contenido después con hashes y reconciliación, sin cambiar identidad ni contrato del dominio.

Alternativas: archivos privados según ADR-0007 ahorran espacio en base, pero exigen coordinar dos almacenamientos y tratar huérfanos; almacenamiento de objetos añade operación que esta fase no necesita. La decisión para XML no reemplaza la de fotografías. Se acepta mayor tamaño de respaldos a cambio de atomicidad y restauración conjunta.

### D9. Validación XML aislada y reglas normativas versionadas

Añadir `lxml` solamente al implementar el archivo, por su uso concreto en validación XSD; fijar versión compatible y actualizar `uv.lock` con auditoría. No está instalado como dependencia del proyecto hoy. Se usará `XMLSchema` con esquemas oficiales locales revisados, manifiesto de URL/versión/hash y resolución limitada a dependencias incluidas. Fuentes técnicas: [validación lxml](https://lxml.de/validation.html) y [opciones del parser](https://lxml.de/parsing.html).

Deshabilitar carga de DTD, resolución de entidades, recuperación tolerante, acceso a red y árboles enormes. Rechazar DOCTYPE y entidades; un resolver deniega también rutas locales externas. No ejecutar XInclude, XSLT ni instrucciones del XML. Ignorar ubicaciones de esquema suministradas por el documento y seleccionar esquema de la lista local por raíz/versión. Validar también el comprobante extraído del envoltorio con las mismas defensas. Los límites D8 se cuentan durante la lectura incremental, con el límite de bytes previo.

Soportar inicialmente las versiones oficiales de factura 1.0.0, 1.1.0, 2.0.0 y 2.1.0 y nota de crédito 1.0.0 y 1.1.0 que se incorporen y prueben con sus dependencias. El manifiesto real es autoridad de disponibilidad: no anunciar una versión hasta incluir y verificar su esquema. Datos no representables por el extractor se rechazan con motivo, sin descartar campos obligatorios. El envoltorio se valida estructuralmente según el contrato oficial, y se comprueban concordancia de clave, ambiente y autorización declarada. Un XML de versión desconocida no se reinterpreta como otra.

Además del XSD se comprueban identidad, totales y consistencia semántica. La validación no consulta SRI ni prueba que el archivo sea genuino. Mensajes de error sanitizados usan códigos y rutas de campo, sin reproducir XML o datos personales en logs.

### D10. Correcciones como solicitudes locales

Solicitud guarda original protegido (archivo externo o preparación de ensayo), acción, motivo, versión normativa y hechos declarados con fuente. Datos jurídicos desconocidos permanecen pendientes; no se deducen del hecho de haber importado un XML. El calendario aplicable identifica cobertura nacional/local y versión; sin cobertura suficiente no se declara elegibilidad. El motor usa las restricciones de las specs, sin convertirlas en constantes ocultas del proveedor.

Para nota de crédito, bloquear el original y contabilizar afectaciones activas por línea, base, impuesto y total. Cada afectación tiene identidad estable; una evidencia compatible vinculada a una solicitud comparte esa afectación y no se suma dos veces. Cancelar una solicitud sin evidencia libera su reserva local; si existe evidencia asociada, se conserva la afectación atribuida al documento externo. Las evidencias no verificadas consumen remanente preventivamente sin certificar ejecución oficial.

Importar una nota de crédito incoherente con otras afectaciones no destruye el archivo: puede conservarse sin vínculo, dejando el remanente pendiente de conciliación y bloqueando nuevas preparaciones sobre el original hasta resolverlo. Se exige declaración administrativa trazable del historial conocido; ausencia de registros no demuestra ausencia de correcciones externas. Importes y cantidades parciales se distribuyen sobre valores históricos con conservación del residuo, sin precios ni tarifas actuales.

Alternativa descartada: reutilizar anulaciones/devoluciones comerciales o marcar una nota como ejecutada por su carga. Ninguna solicitud fiscal crea pagos, deuda o movimientos de inventario.

### D11. API propia, permisos y presentación

Ampliar `backend/src/config/api/urls.py` para el espacio `/api/v1/fiscal/`, manteniendo sesión, CSRF y mismo origen. Propuesta de recursos propios:

| Recurso | Acciones |
|---|---|
| Configuración electrónica del emisor | Consultar/editar perfil, puntos, catálogo de correspondencias y metadatos mediante servicios de configuración |
| `/fiscal/preparations/` | Crear desde origen, listar por ámbito, consultar y editar borrador con versión |
| `/fiscal/preparations/{id}/review/` | Revisión e impedimentos, sin consumir número |
| `/fiscal/preparations/{id}/prepare/`, `cancel/`, `test-identity/` | Comandos explícitos idempotentes |
| `/fiscal/archive/` | Incorporación administrativa y listado paginado filtrado por emisor/ambiente/tipo/fecha |
| `/fiscal/archive/{id}/evidence/{evidence_id}/download/` | Bytes originales con autorización en cada solicitud |
| `/fiscal/archive/{id}/links/` | Vincular o corregir vínculo con motivo y versión |
| `/fiscal/correction-requests/` | Borrador, revisión, preparación y cancelación administrativa |
| `/fiscal/readiness/` | Consulta de requisitos operativos; registro administrativo de política y evidencia de restauración |

La configuración puede conservar su prefijo existente; no duplicar propiedad bajo dos APIs de escritura. Precisar nombres finales en OpenAPI durante implementación. Comandos llevan UUID estable cuando crean hechos, clave de idempotencia y `expected_version` para editar. Importes son cadenas decimales. No aceptar campos de estado oficial, firma ni material privado. Conflictos responden 409; entradas inválidas 400; tamaño 413; permisos 403 y recursos fuera del ámbito 404 conforme al patrón de consulta existente. El backend sigue siendo autoridad incluso para descarga y recuperación de comandos.

Permisos derivados de roles, sin nuevos roles ni permisos asignables manualmente:

- Administrador: configuración, antecedentes, todo archivo, preparación y solicitudes de ambos emisores.
- Vendedor: preparación comercial y evidencias vinculadas a operaciones comerciales consultables.
- Encargado: preparación artesanal y evidencias vinculadas a operaciones artesanales consultables.
- Unión de roles: suma de ámbitos. El resumen comercial de una orden no otorga al Encargado acceso fiscal comercial.

Crear `frontend/src/features/fiscal/` y `frontend/src/pages/fiscal/`; extender la página existente `pages/workshop-configuration/WorkshopConfigurationPage.tsx` y añadir enlaces desde `pages/sales/SaleDetailPage.tsx` y `pages/maintenance/ServiceOperationDetailPage.tsx`. Usar componentes Tallkit y consultas del proyecto. Pantalla de preparación extensa en página; confirmaciones cortas en modal. Mostrar campos pendientes y diferencias junto a su dato, conservar entrada ante error y permitir navegación por teclado. Invalidar consultas fiscales tras comandos; no invalidar saldo como si hubiera cobro.

Separar visualmente documento interno, pago, preparación, evidencia externa y ambiente. Nunca usar «Factura emitida» para preparada. Perfil incompleto es aviso en fiscal, no bloqueo del negocio. El archivo general y acciones administrativas solo aparecen al Administrador; errores relevantes permanecen visibles, no solo en notificaciones temporales.

### D12. Conservación, recuperación y datos personales

El archivo no ofrece edición ni borrado ordinario; claves foráneas históricas usan protección. Retención mínima según specs se calcula desde la fecha de emisión, conservando el documento al vencerla hasta revisión. Los endpoints de descarga usan `Content-Disposition: attachment`, `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`. No servir XML como página activa ni aceptar nombres/rutas del usuario como destino.

Antes de cargar documentos reales, registrar política versionada por responsable fiscal: finalidad, fundamento, plazos por categoría, canal y procedimiento de derechos. No añadir un portal de solicitudes ni inferir consentimiento genérico. Correcciones de contacto no modifican XML. Las respuestas a derechos se tramitan por el procedimiento administrativo, con verificación de legitimación y decisión documentada, sin permisos adicionales para Vendedor/Encargado.

Antes de cargas productivas, exigir además evidencia de respaldo/restauración aplicable a la instalación: fecha, responsable, versión del procedimiento, identificador de copia y resultado de reconciliación. Con XML en PostgreSQL, un respaldo consistente de la base incluye contenidos, identidades y vínculos; una copia en el mismo disco no basta. Documentar copia protegida en destino independiente y prueba de restauración en otra instancia, con comprobación de hashes, permisos y relaciones. Registrar la evidencia no equivale a verificar automáticamente que existe una copia externa; la UI lo expresa como comprobación administrativa respaldada por un informe. Cambiar el procedimiento o almacenamiento invalida la habilitación hasta repetir comprobación.

El procedimiento de restauración debe revisar decisiones de eliminación legítima que sean posteriores al respaldo antes de volver a servir datos. Esta entrega no ejecuta borrados masivos. No se promete respaldo de fotografías ni cierre de DA-003 para todo el taller. Como el contenido queda en base, no necesita el volumen de fotografías y no crea una segunda copia descoordinada del XML.

### D13. Registro de decisión arquitectónica propuesto

Aplicando la guía `architecture-decision-records`, este apartado registra la decisión duradera dentro del único artefacto de diseño. Se trasladará a un ADR dedicado en `docs/adr/` al aplicar el diseño aprobado, con identificador disponible entonces; no se marca aceptada ahora.

**Estado:** propuesta. **Contexto:** necesitamos preparación y evidencia fiscal independientes de quien emita, preservando documentos económicos separados y almacenamiento recuperable. **Decisión:** módulo fiscal propio, snapshot neutral inmutable, numeración local de ensayo, estados de preparación distintos de resultados externos, XML acotados conservados transaccionalmente en PostgreSQL y futura integración fuera de las transacciones comerciales. **Alternativas:** lógica por proveedor dentro de ventas; documento económico universal; archivos XML en volumen privado; emisión anticipada. **Consecuencias:** portabilidad y conservación conjunta, a cambio de más datos en base, validadores oficiales propios y límites explícitos de importación. Complementa ADR-0001/0004/0006/0008; no sustituye ADR-0007 para fotografías.

### D14. Verificación y trazabilidad de implementación

La implementación futura seguirá TDD. No ejecutar llamadas reales al SRI ni usar certificados o datos personales reales en pruebas. Las 34 reglas y 89 escenarios de las specs deben aparecer en la matriz de cobertura, con prueba o evidencia administrativa específica, evitando confundir existencia del archivo con cumplimiento.

| Capacidad | Evidencia prevista |
|---|---|
| Configuración | Desconocidos, vigencia, inmutabilidad de códigos usados, perfiles incompletos y regresión de confirmaciones actuales |
| Identidad | Vectores de 49 dígitos y módulo 11; cambio de fecha UTC/local; límite del contador; carreras, rollback y rechazo productivo |
| Preparación | Matriz XSD completa; datos maestros modificados; revisión caducada/concurrente; montos históricos, consumidor final y pagos declarados |
| Recuperación | Respuesta perdida, misma clave con otro contenido, permiso revocado y dos ventas iguales legítimas |
| Archivo | XML sintético por versión; XXE/red/archivos locales/DOCTYPE/profundidad/tamaño; conflicto de identidad; bytes exactos e integridad |
| Correcciones | Plazo/calendario conocido o pendiente; restricciones; reservas concurrentes del remanente; evidencia vinculada sin doble cómputo |
| Accesos comercial/artesanal | Matriz completa de roles y combinaciones; URLs directas y descarga; ningún efecto monetario o inventario |
| Operación | Migración sobre registros previos sin prepararlos; restauración en instancia distinta; políticas y habilitación bloqueada sin evidencia |

Pruebas puras en `backend/tests/fiscal/`; integración y concurrencia sobre PostgreSQL con conexiones independientes y barreras; pruebas de frontera sin importación de proveedor en dominio ni escritura ajena; frontend con componentes y rutas, y E2E de preparación/archivo. No bastan mocks de persistencia para unicidad y rollback. Regresiones enfocadas de `sales`, `workshop` y `workshop_configuration`.

Cierre de implementación, ajustado por instrucción explícita del usuario: ejecutar solo pruebas de la capacidad modificada y regresiones directamente afectadas, con selección por archivo o caso y justificación en la evidencia. No ejecutar por defecto `make check`, `make test` ni toda la suite: esos agregados incluyen verificaciones y pruebas ajenas. Ampliar la selección únicamente ante fallos o cambios transversales que lo justifiquen. Conservar TDD, concurrencia real, permisos, dinero y seguridad XML en las áreas afectadas; no reducir los escenarios exigidos por las specs.

Usar `uv run` en backend y npm en frontend. En ciclos TDD, ejecutar pytest focalizado con `--no-cov`; al cerrar un grupo medir cobertura del código afectado, sin exigir el umbral global a módulos que no se ejercitaron. Realizar formato/lint sobre archivos modificados; tipos, Django check, chequeo de migraciones, OpenAPI y build una vez al cerrar el cambio cuando corresponda, sin repetirlos tras cambios exclusivamente documentales. Auditar dependencias cuando se incorpore `lxml` o cambie un lockfile. La restauración se comprueba aparte. Documentar comandos, resultados y alcance no ejecutado; no afirmar validación de toda la aplicación. Validar el artefacto con `openspec validate establecer-modulo-fiscal-independiente --strict`. Este diseño no afirma que las pruebas de implementación se hayan ejecutado.

## Risks / Trade-offs

- [Perfil tributario no comprobado] → Campos pendientes y fundamento obligatorio; no otorgar beneficios por etiqueta artesanal.
- [Representación fiscal incompatible con importes históricos] → Bloquear con diferencias y resolver con fuentes oficiales; no tocar el motor comercial sin nuevo acuerdo.
- [Más bytes en base y copias] → Límite por archivo, consultas sin contenido, métricas de tamaño y duración de restauración; migración futura de almacenamiento preservando hashes.
- [XML malicioso] → Parseo sin recursos externos, límites incrementales, esquema local y casos adversos; nunca ejecutar contenido.
- [Documento alterado pero estructuralmente válido] → Etiqueta permanente de evidencia no verificada; el hash solo detecta cambios desde su incorporación.
- [Reglas normativas o calendario desactualizados] → Versiones con fuente/vigencia y evaluación pendiente si falta cobertura; revisión al habilitar emisión futura.
- [Corrección simultánea al preparar] → Bloqueo de raíz de origen, revisión vigente y detección posterior de discrepancias.
- [Proveedor futuro no compatible] → Adaptador posterior o revisión explícita de P4; no prometer compatibilidad universal ni custodiar firma ahora.
- [Retención declarada sin recuperación] → Carga productiva bloqueada hasta procedimiento y restauración evidenciados; copiar archivos no certifica siete años de disponibilidad.

## Migration Plan

1. Después de aprobar diseño y tareas, añadir esquema fiscal y extensiones opcionales de configuración mediante migraciones nuevas. Este documento no crea modelos ni migraciones.
2. Conservar íntegros números, impuestos, pagos y snapshots previos. Crear perfiles adicionales incompletos o permitir ausencia hasta su alta; no inventar RUC, regímenes, puntos, certificados ni códigos SRI para impuestos existentes.
3. Incorporar catálogos/esquemas revisados y sus manifiestos. No activar correspondencias tributarias por coincidencia de porcentaje. Mantener producción sin asignación fiscal.
4. Desplegar API y UI de manera compatible; la confirmación interna sigue funcionando. No crear borradores ni solicitudes por recorrido automático del historial.
5. Ensayar con datos sintéticos; documentar política y respaldo; restaurar una copia en instancia aislada y comprobarla. Solo entonces habilitar la incorporación real según D12, sin habilitar emisión.
6. Actualizar requisitos, producto, glosarios, modelo conceptual, trazabilidad, OpenAPI y ADR dedicado para reflejar únicamente el alcance aprobado. Corregir las notas desactualizadas identificadas en Context durante la implementación, sin modificar decisiones históricas aceptadas.

Rollback: deshabilitar comandos y pantallas fiscales si aparece una incidencia; conservar acceso administrativo de recuperación. Revertir aplicación solo a una versión compatible con la base ampliada. No deshacer migraciones que contengan XML o historia ni borrar preparaciones para volver atrás. Respaldo previo al despliegue y recuperación controlada evitan perder documentos incorporados después; restaurar una copia antigua no es un rollback ordinario aceptable sobre datos nuevos.

## Open Questions

No bloquean redactar tareas, pero condicionan habilitaciones o aceptación de casos concretos:

- Perfil/calificación del maestro y régimen del futuro RUC comercial: completar con evidencia antes de declarar perfiles listos.
- Series actualmente usadas por el facturador del SRI: conciliación previa a futura emisión, sin asumir que 001-002 está disponible.
- Casos reales de redondeo y condiciones fiscales a crédito: validar con fuente vigente; si no admiten representación, conservar impedimento, sin inventar vencimientos.
- Procedimiento operativo, responsable y destino independiente de copias: obligatorios antes de importación productiva; DA-003 general continúa abierta.
- Cobertura territorial de calendario y datos externos de correcciones: evaluación pendiente cuando falten, sin permisos legales presumidos.
- Proveedor, custodia de firma, transporte, reintentos externos, entrega y obligaciones de registro: objeto de otro cambio. La documentación de AutorizadorEC revisada no resuelve disponibilidad contractual, duplicados, conservación remota ni anulación oficial.
