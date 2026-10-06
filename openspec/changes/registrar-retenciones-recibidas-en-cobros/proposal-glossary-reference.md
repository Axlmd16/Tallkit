# Referencia de glosario de la propuesta

| Término | Glosario de origen | Contexto |
|---|---|---|
| Entidad fiscal | `docs/negocio/producto/glosario.md` | Cada uno de los dos RUC; una retención pertenece a una sola entidad y nunca cruza de una a otra. |
| SRI | `docs/negocio/producto/glosario.md` | Autoridad fiscal que obliga a ciertos clientes a retener; sin conexión en este cambio. |
| Pago | `docs/arquitectura/modelo-dominio.md` | Aplicación de dinero a una operación mediante efectivo o transferencia; la retención no es un pago. |
| Saldo pendiente | `docs/arquitectura/modelo-dominio.md` | Importe exigible menos lo aplicado; pasa a descontar también las retenciones vigentes. |
| Estado de pago | `docs/negocio/producto/glosario.md` | Pendiente, parcial o pagado, derivado del saldo; ahora considera las retenciones. |
| Cuentas por cobrar | `docs/negocio/producto/glosario.md` | Deuda cobrable por entidad fiscal; deja de mostrar como deuda lo que el cliente retuvo. |
| Cliente | `docs/arquitectura/modelo-dominio.md` | Identidad compartida por los dos RUC; recibe la marca opcional de agente de retención. |
| Operación artesanal | `docs/arquitectura/modelo-dominio.md` | Cobro de servicios del RUC artesanal sobre el que puede registrarse una retención. |
| Reembolso | `docs/arquitectura/modelo-dominio.md` | Devolución de dinero cobrado en exceso; nunca incluye un valor retenido. |
| Preparación fiscal | `docs/negocio/producto/glosario.md` | Expediente local de la factura; sus formas de pago no cambian por una retención. |
| Agente de retención | `docs/negocio/producto/glosario.md` | Contribuyente obligado por el SRI a retener al pagar; aquí describe al cliente, no al emisor. |
| Retención recibida | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Parte del total de una operación que el cliente no paga porque la entrega al SRI a nombre del emisor; reduce el saldo sin ser dinero cobrado. |
| Comprobante de retención | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Documento electrónico que emite el cliente por el valor retenido, con número de serie y secuencial. |
| Comprobante pendiente | Nuevo; se incorporará a `docs/negocio/producto/glosario.md` | Situación de una retención registrada cuyo número de comprobante todavía no se completó. |
