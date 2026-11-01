# Cobertura de los datos del comprobante

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `openspec/changes/alinear-datos-del-comprobante-con-sri`; deltas de `preparacion-y-seguimiento-fiscal`, `configuracion-operativa-y-fiscal`, `servicios-aplicados-al-mantenimiento` y `operacion-artesanal-de-servicios` |
| Estado | En aplicación: ningún escenario verificado todavía |
| Fecha | 2026-11-01 |
| Alcance | Correo del comprador, plazo del comprobante, detalle adicional, detalle de servicio, emisor completo y condición de gran contribuyente. No emite comprobantes ni cambia dinero, inventario o secuencias. |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | De ellos, regresión | Cumplidos | Pendientes |
|---|---|---|---|---|---|
| `preparacion-y-seguimiento-fiscal` | 7 | 57 | 18 | 0 | 57 |
| `configuracion-operativa-y-fiscal` | 2 | 26 | 18 | 0 | 26 |
| `servicios-aplicados-al-mantenimiento` | 1 | 10 | 0 | 0 | 10 |
| `operacion-artesanal-de-servicios` | 1 | 6 | 0 | 0 | 6 |
| **Total** | **11** | **99** | **36** | **0** | **99** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el escenario. «Regresión» marca un escenario que ya existía en la spec principal y que la delta conserva dentro de un requisito modificado: su prueba actual debe seguir en verde, o actualizarse si la regla cambió. Las rutas de backend son relativas a `backend/` y las de frontend, a `frontend/`.

## 2. Pruebas actuales que afirman lo contrario de las specs nuevas

Revisión hecha en la tarea 1.3 (2026-11-01). Cada fila nombra la prueba actual, la regla nueva que la contradice y qué se hace con ella. Ninguna se borra a ciegas: se actualiza en el grupo indicado.

| Prueba actual | Afirma hoy | Cambia por | Grupo |
|---|---|---|---|
| `tests/workshop_configuration/profile_helpers.py` (`workshop_profile`) | El perfil base declara cinco condiciones | Debe incluir `large_taxpayer` como *No aplica*; sin eso, casi todas las pruebas de preparación quedarían en «Falta completar» | 2 |
| `tests/workshop_configuration/test_electronic_profile.py::test_regime_legend_is_derived_from_the_closed_value` | Negocio Popular no tiene leyenda | Tiene `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE` | 2 |
| `tests/workshop_configuration/test_electronic_profile.py` (`test_withholding_agent_accepts_one_to_eight_digits`, contribuyente especial) | Agente: 1 a 8 dígitos; especial: 1 a 13 | Agente sin ceros a la izquierda; especial de 3 a 13 | 2 |
| `tests/workshop_configuration/test_electronic_profile_services.py` (resolución `NAC-0012` y similares) | Rechazos por formato | Se conservan; se agregan los casos de ceros y de longitud mínima | 2 |
| `tests/workshop_configuration/test_fiscal_resolver.py::test_popular_business_regime_prepares_without_a_regime_legend_yet` | Negocio Popular prepara sin leyenda | Prepara con la leyenda derivada | 2 |
| `tests/workshop_configuration/test_electronic_status.py` | Estados sin la condición nueva | Revisar los perfiles de prueba que la omiten | 2 |
| `tests/fiscal/test_payment_declaration.py` (línea 57) | Una forma de pago con `term_days` se rechaza | Se conserva a nivel de forma: el plazo viaja en `payments.term_days` | 5 |
| `tests/sales/test_fiscal_prepare_flow.py` (líneas 509 y 627) | Enviar plazo y unidad en una forma se rechaza o se ignora | Se conservan para las formas; se agregan casos del plazo único | 6 |
| `tests/sales/test_fiscal_prepare_flow.py` (línea 877) y `tests/fiscal/test_snapshot.py` (línea 172) | Una instantánea no conserva `term_days` | Solo cuando no corresponde; con crédito pendiente sí lo conserva | 6 |
| `tests/fiscal/test_receiver.py::test_email_optional_but_validated_when_present` | El correo es opcional | Se conserva: `parse_receiver` guarda un borrador sin correo; la exigencia está en la instantánea | 5 |
| `tests/sales/test_fiscal_prepare_flow.py::_fill_draft` y receptores de esa suite | El receptor se completa sin correo | Deben incluir un correo, salvo los casos de consumidor final | 6 |
| `tests/workshop/test_fiscal_preparation.py`, `tests/sales/test_fiscal_identity.py`, `tests/fiscal/test_api.py` | Preparan con receptores sin correo | Igual que la fila anterior | 6 |
| `tests/sales/test_fiscal_prepare_flow.py` (línea 458) | `draft_format == 2` | `draft_format == 3` | 6 |
| `tests/sales/test_fiscal_prepare_flow.py` (línea 917) y `tests/fiscal/test_snapshot.py` (líneas 162, 277 y 278) | `snapshot_format == 3` | `snapshot_format == 4` | 6 |
| `tests/sales/test_fiscal_prepare_flow.py` (línea 1134) | Lectura de instantáneas de formatos 1 y 2 | Se conserva y se agrega el formato 3 | 6 |

Las pruebas de `tests/workshop` que preparan operaciones artesanales y las de `tests/proformas` que convierten a venta no tocan estas reglas, salvo por el correo del receptor y el perfil base.

## 3. Escenarios

### `preparacion-y-seguimiento-fiscal`

| Id | Requisito | Escenario | Origen | Prueba | Resultado |
|---|---|---|---|---|---|
| P-01 | Receptor fiscal sin mutación del cliente histórico | Completar dirección fiscal faltante | Regresión | Pendiente | Pendiente |
| P-02 | Receptor fiscal sin mutación del cliente histórico | RUC sin algoritmo general aplicable | Regresión | Pendiente | Pendiente |
| P-03 | Receptor fiscal sin mutación del cliente histórico | Cliente interno de longitud correcta pero no numérico | Regresión | Pendiente | Pendiente |
| P-04 | Receptor fiscal sin mutación del cliente histórico | Receptor identificado sin correo | Nuevo o ajustado | Pendiente | Pendiente |
| P-05 | Receptor fiscal sin mutación del cliente histórico | Correo completado en la preparación | Nuevo o ajustado | Pendiente | Pendiente |
| P-06 | Receptor fiscal sin mutación del cliente histórico | Guardar un borrador sin correo | Nuevo o ajustado | Pendiente | Pendiente |
| P-07 | Receptor fiscal sin mutación del cliente histórico | Consumidor final sin correo | Nuevo o ajustado | Pendiente | Pendiente |
| P-08 | Receptor fiscal sin mutación del cliente histórico | Correo con formato inválido | Nuevo o ajustado | Pendiente | Pendiente |
| P-09 | Receptor fiscal sin mutación del cliente histórico | Operación de un cliente sin correo | Nuevo o ajustado | Pendiente | Pendiente |
| P-10 | Receptor fiscal sin mutación del cliente histórico | Preparación completada antes de exigir el correo | Nuevo o ajustado | Pendiente | Pendiente |
| P-11 | Solicitud limitada a los datos faltantes | Receptor sin dirección | Regresión | Pendiente | Pendiente |
| P-12 | Solicitud limitada a los datos faltantes | Configuración incompleta | Regresión | Pendiente | Pendiente |
| P-13 | Solicitud limitada a los datos faltantes | Receptor sin correo | Nuevo o ajustado | Pendiente | Pendiente |
| P-14 | Formas de pago habilitadas y combinables | Pago combinado | Regresión | Pendiente | Pendiente |
| P-15 | Formas de pago habilitadas y combinables | Venta a crédito con saldo pendiente | Nuevo o ajustado | Pendiente | Pendiente |
| P-16 | Formas de pago habilitadas y combinables | Intento de enviar plazo | Regresión | Pendiente | Pendiente |
| P-17 | Formas de pago habilitadas y combinables | Sugerencia desde cobros registrados | Regresión | Pendiente | Pendiente |
| P-18 | Formas de pago habilitadas y combinables | Sugerencia con saldo pendiente | Regresión | Pendiente | Pendiente |
| P-19 | Formas de pago habilitadas y combinables | Operación pendiente de pago | Regresión | Pendiente | Pendiente |
| P-20 | Formas de pago habilitadas y combinables | Cobro posterior a la preparación | Regresión | Pendiente | Pendiente |
| P-21 | Formas de pago habilitadas y combinables | Suma distinta del total | Regresión | Pendiente | Pendiente |
| P-22 | Formas de pago habilitadas y combinables | Forma no habilitada | Regresión | Pendiente | Pendiente |
| P-23 | Emisor estructurado en la instantánea | Taller en régimen general | Regresión | Pendiente | Pendiente |
| P-24 | Emisor estructurado en la instantánea | Emisor RIMPE Emprendedor | Regresión | Pendiente | Pendiente |
| P-25 | Emisor estructurado en la instantánea | Cambio posterior del perfil | Regresión | Pendiente | Pendiente |
| P-26 | Emisor estructurado en la instantánea | Preparación anterior al formato estructurado | Regresión | Pendiente | Pendiente |
| P-27 | Emisor estructurado en la instantánea | Perfil pendiente de declarar de nuevo | Regresión | Pendiente | Pendiente |
| P-28 | Emisor estructurado en la instantánea | Emisor RIMPE Negocio Popular | Nuevo o ajustado | Pendiente | Pendiente |
| P-29 | Emisor estructurado en la instantánea | Emisor gran contribuyente | Nuevo o ajustado | Pendiente | Pendiente |
| P-30 | Emisor estructurado en la instantánea | Nombre comercial y dirección del establecimiento | Nuevo o ajustado | Pendiente | Pendiente |
| P-31 | Emisor estructurado en la instantánea | Entidad sin nombre comercial | Nuevo o ajustado | Pendiente | Pendiente |
| P-32 | Plazo del comprobante en operaciones a crédito | Crédito sin cobros | Nuevo o ajustado | Pendiente | Pendiente |
| P-33 | Plazo del comprobante en operaciones a crédito | Crédito sin plazo declarado | Nuevo o ajustado | Pendiente | Pendiente |
| P-34 | Plazo del comprobante en operaciones a crédito | Abono parcial | Nuevo o ajustado | Pendiente | Pendiente |
| P-35 | Plazo del comprobante en operaciones a crédito | Crédito ya saldado | Nuevo o ajustado | Pendiente | Pendiente |
| P-36 | Plazo del comprobante en operaciones a crédito | Crédito saldado con una retención recibida | Nuevo o ajustado | Pendiente | Pendiente |
| P-37 | Plazo del comprobante en operaciones a crédito | Contado pendiente de cobro | Nuevo o ajustado | Pendiente | Pendiente |
| P-38 | Plazo del comprobante en operaciones a crédito | Plazo inválido | Nuevo o ajustado | Pendiente | Pendiente |
| P-39 | Plazo del comprobante en operaciones a crédito | Unidad enviada por el usuario | Nuevo o ajustado | Pendiente | Pendiente |
| P-40 | Plazo del comprobante en operaciones a crédito | Cobro que salda antes de completar | Nuevo o ajustado | Pendiente | Pendiente |
| P-41 | Plazo del comprobante en operaciones a crédito | Sin efecto en la cobranza | Nuevo o ajustado | Pendiente | Pendiente |
| P-42 | Plazo del comprobante en operaciones a crédito | Cobro posterior a completar | Nuevo o ajustado | Pendiente | Pendiente |
| P-43 | Plazo del comprobante en operaciones a crédito | Borrador anterior con plazo antiguo | Nuevo o ajustado | Pendiente | Pendiente |
| P-44 | Detalle adicional del comprobante | Agregar detalle adicional | Nuevo o ajustado | Pendiente | Pendiente |
| P-45 | Detalle adicional del comprobante | Preparación sin detalle adicional | Nuevo o ajustado | Pendiente | Pendiente |
| P-46 | Detalle adicional del comprobante | Nombre reservado | Nuevo o ajustado | Pendiente | Pendiente |
| P-47 | Detalle adicional del comprobante | Más pares de los admitidos | Nuevo o ajustado | Pendiente | Pendiente |
| P-48 | Detalle adicional del comprobante | Nombre repetido | Nuevo o ajustado | Pendiente | Pendiente |
| P-49 | Detalle adicional del comprobante | Valor excedido | Nuevo o ajustado | Pendiente | Pendiente |
| P-50 | Detalle adicional del comprobante | Preparación completada | Nuevo o ajustado | Pendiente | Pendiente |
| P-51 | Detalle adicional del comprobante | Borrador anterior fuera de las reglas | Nuevo o ajustado | Pendiente | Pendiente |
| P-52 | Detalle de servicio en la preparación | Detalle precargado | Nuevo o ajustado | Pendiente | Pendiente |
| P-53 | Detalle de servicio en la preparación | Ajuste sin efecto en la operación | Nuevo o ajustado | Pendiente | Pendiente |
| P-54 | Detalle de servicio en la preparación | Línea sin detalle | Nuevo o ajustado | Pendiente | Pendiente |
| P-55 | Detalle de servicio en la preparación | Detalle excedido | Nuevo o ajustado | Pendiente | Pendiente |
| P-56 | Detalle de servicio en la preparación | Línea de venta comercial | Nuevo o ajustado | Pendiente | Pendiente |
| P-57 | Detalle de servicio en la preparación | Reemplazo de una preparación cancelada | Nuevo o ajustado | Pendiente | Pendiente |

### `configuracion-operativa-y-fiscal`

| Id | Requisito | Escenario | Origen | Prueba | Resultado |
|---|---|---|---|---|---|
| C-01 | Perfil fiscal adicional sin alterar la configuración operativa | Nuevo contribuyente aún no definido | Regresión | Pendiente | Pendiente |
| C-02 | Perfil fiscal adicional sin alterar la configuración operativa | Entidad sin perfil guardado | Regresión | Pendiente | Pendiente |
| C-03 | Perfil fiscal adicional sin alterar la configuración operativa | Perfil listo sin certificado | Regresión | Pendiente | Pendiente |
| C-04 | Perfil fiscal adicional sin alterar la configuración operativa | Condición vencida | Regresión | Pendiente | Pendiente |
| C-05 | Perfil fiscal adicional sin alterar la configuración operativa | Artesanal no equivale a beneficio comprobado | Regresión | Pendiente | Pendiente |
| C-06 | Perfil fiscal adicional sin alterar la configuración operativa | Usuario operativo intenta configurar otro emisor | Regresión | Pendiente | Pendiente |
| C-07 | Perfil fiscal adicional sin alterar la configuración operativa | Perfil real del taller | Regresión | Pendiente | Pendiente |
| C-08 | Perfil fiscal adicional sin alterar la configuración operativa | Leyenda derivada del régimen | Regresión | Pendiente | Pendiente |
| C-09 | Perfil fiscal adicional sin alterar la configuración operativa | Contabilidad con texto libre | Regresión | Pendiente | Pendiente |
| C-10 | Perfil fiscal adicional sin alterar la configuración operativa | Resolución de agente de retención con formato inválido | Regresión | Pendiente | Pendiente |
| C-11 | Perfil fiscal adicional sin alterar la configuración operativa | Agente de retención sin número | Regresión | Pendiente | Pendiente |
| C-12 | Perfil fiscal adicional sin alterar la configuración operativa | Revisión anterior en texto libre | Regresión | Pendiente | Pendiente |
| C-13 | Perfil fiscal adicional sin alterar la configuración operativa | Régimen de negocio popular | Regresión | Pendiente | Pendiente |
| C-14 | Perfil fiscal adicional sin alterar la configuración operativa | Leyenda derivada de Negocio Popular | Nuevo o ajustado | Pendiente | Pendiente |
| C-15 | Perfil fiscal adicional sin alterar la configuración operativa | Contribuyente especial demasiado corto | Nuevo o ajustado | Pendiente | Pendiente |
| C-16 | Perfil fiscal adicional sin alterar la configuración operativa | Gran contribuyente declarado | Nuevo o ajustado | Pendiente | Pendiente |
| C-17 | Perfil fiscal adicional sin alterar la configuración operativa | Gran contribuyente sin número | Nuevo o ajustado | Pendiente | Pendiente |
| C-18 | Perfil fiscal adicional sin alterar la configuración operativa | Revisión anterior sin gran contribuyente | Nuevo o ajustado | Pendiente | Pendiente |
| C-19 | Perfil fiscal adicional sin alterar la configuración operativa | Ventas durante el perfil por completar | Nuevo o ajustado | Pendiente | Pendiente |
| C-20 | Perfil fiscal adicional sin alterar la configuración operativa | Valor guardado que ya no cumple el formato | Nuevo o ajustado | Pendiente | Pendiente |
| C-21 | Correspondencia fiscal de las formas de pago | Pago combinado declarado | Regresión | Pendiente | Pendiente |
| C-22 | Correspondencia fiscal de las formas de pago | Crédito con plazo declarado | Nuevo o ajustado | Pendiente | Pendiente |
| C-23 | Correspondencia fiscal de las formas de pago | Catálogo completo visible | Regresión | Pendiente | Pendiente |
| C-24 | Correspondencia fiscal de las formas de pago | Catálogo sin fuente | Regresión | Pendiente | Pendiente |
| C-25 | Correspondencia fiscal de las formas de pago | Intento de habilitar tarjeta de crédito | Regresión | Pendiente | Pendiente |
| C-26 | Correspondencia fiscal de las formas de pago | Deshabilitar la forma predeterminada | Regresión | Pendiente | Pendiente |

### `servicios-aplicados-al-mantenimiento`

| Id | Requisito | Escenario | Origen | Prueba | Resultado |
|---|---|---|---|---|---|
| S-01 | Detalle de servicio en la línea | Agregar una línea con detalle | Nuevo o ajustado | Pendiente | Pendiente |
| S-02 | Detalle de servicio en la línea | Línea sin detalle | Nuevo o ajustado | Pendiente | Pendiente |
| S-03 | Detalle de servicio en la línea | Escribir el detalle después | Nuevo o ajustado | Pendiente | Pendiente |
| S-04 | Detalle de servicio en la línea | Detalle excedido o con saltos de línea | Nuevo o ajustado | Pendiente | Pendiente |
| S-05 | Detalle de servicio en la línea | Línea documentada | Nuevo o ajustado | Pendiente | Pendiente |
| S-06 | Detalle de servicio en la línea | Orden finalizada | Nuevo o ajustado | Pendiente | Pendiente |
| S-07 | Detalle de servicio en la línea | Servicio repetido | Nuevo o ajustado | Pendiente | Pendiente |
| S-08 | Detalle de servicio en la línea | Catálogo sin cambios | Nuevo o ajustado | Pendiente | Pendiente |
| S-09 | Detalle de servicio en la línea | Edición simultánea | Nuevo o ajustado | Pendiente | Pendiente |
| S-10 | Detalle de servicio en la línea | Vendedor intenta escribir el detalle | Nuevo o ajustado | Pendiente | Pendiente |

### `operacion-artesanal-de-servicios`

| Id | Requisito | Escenario | Origen | Prueba | Resultado |
|---|---|---|---|---|---|
| O-01 | Detalle de servicio conservado en la operación | Confirmar conserva el detalle | Nuevo o ajustado | Pendiente | Pendiente |
| O-02 | Detalle de servicio conservado en la operación | Comprobante interno con detalle | Nuevo o ajustado | Pendiente | Pendiente |
| O-03 | Detalle de servicio conservado en la operación | Detalle cambiado después de revisar | Nuevo o ajustado | Pendiente | Pendiente |
| O-04 | Detalle de servicio conservado en la operación | Intento de cambiar una línea documentada | Nuevo o ajustado | Pendiente | Pendiente |
| O-05 | Detalle de servicio conservado en la operación | Volver a documentar después de anular | Nuevo o ajustado | Pendiente | Pendiente |
| O-06 | Detalle de servicio conservado en la operación | Operación anterior | Nuevo o ajustado | Pendiente | Pendiente |

## 4. Notas

_Se completan al cerrar el cambio (tarea 11.7)._

Referencia terminológica: [cobertura-datos-del-comprobante-glossary-reference.md](cobertura-datos-del-comprobante-glossary-reference.md).
