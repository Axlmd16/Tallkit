## 1. Inventario y precedencia documental

- [x] 1.1 Revisar nuevamente todos los documentos no históricos aplicables y registrar las afirmaciones que contradicen decisiones confirmadas o el modelo aprobado.
- [x] 1.2 Preparar una matriz de decisiones adoptadas, recomendaciones no aprobadas, contradicciones, pendientes e información insuficiente.

## 2. Modelo conceptual

- [x] 2.1 Crear `docs/arquitectura/modelo-dominio.md` con propósito, alcance, fuentes, contextos, glosario, entidades, objetos de valor, agregados, estados, invariantes, eventos, decisiones y pendientes.
- [x] 2.2 Incorporar un único diagrama de clases Mermaid completo, agrupado por contextos y con relaciones y cardinalidades.
- [x] 2.3 Añadir la referencia de glosario correspondiente al nuevo documento y comprobar consistencia terminológica.

## 3. Decisiones y documentación de producto

- [x] 3.1 Actualizar `docs/negocio/decisiones/decisiones-confirmadas.yaml` con las decisiones de dominio aprobadas y sin asuntos tributarios no validados.
- [x] 3.2 Actualizar visión y alcance V1 para reflejar el modelo aprobado y retirar capacidades descartadas o contradictorias.
- [x] 3.3 Actualizar reglas de negocio y glosario con presentaciones, kits, reservas, consumos internos, intervenciones correctivas, precios y cierres.

## 4. Requisitos coherentes

- [x] 4.1 Actualizar actores y autorizaciones para solicitudes de consumo, reservas, reaperturas y reposiciones por corrección.
- [x] 4.2 Actualizar requisitos funcionales y no funcionales afectados, preservando atomicidad, idempotencia, historia económica y separación fiscal.
- [x] 4.3 Actualizar casos de uso para kits, reserva de mantenimiento, finalización coherente, pagos simples, consumo interno y correcciones sin cargo.
- [x] 4.4 Actualizar interfaz y navegación solo a nivel documental, sin diseñar ni implementar componentes.
- [x] 4.5 Actualizar la matriz de trazabilidad para relacionar decisiones, reglas, requisitos, casos de uso y el nuevo modelo de dominio.

## 5. Arquitectura y decisiones duraderas

- [x] 5.1 Revisar la documentación arquitectónica vigente y actualizar únicamente referencias o contradicciones afectadas por el modelo conceptual.
- [x] 5.2 Registrar que las reglas de negocio no requieren ADR propio y dejar la coordinación transaccional de inventario como candidata para una futura decisión técnica.

## 6. Verificación documental

- [x] 6.1 Validar la sintaxis del único diagrama Mermaid y revisar manualmente su legibilidad, relaciones y cardinalidades.
- [x] 6.2 Buscar referencias obsoletas a descuentos en V1, decisiones ya confirmadas marcadas como pendientes y finalización con repuestos pendientes.
- [x] 6.3 Verificar que ningún documento presente el sistema histórico como arquitectura objetivo ni confunda documento interno con factura electrónica.
- [x] 6.4 Verificar enlaces, rutas, terminología, trazabilidad y formato de todos los documentos modificados.
- [x] 6.5 Confirmar mediante diferencias de Git que no se modificaron código, modelos de datos, migraciones, endpoints, componentes ni pruebas de software.
