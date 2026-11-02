## MODIFIED Requirements

### Requirement: Identidad visual Tallkit
La interfaz SHALL aplicar a todas sus pantallas el sistema visual propio **Tallkit · Banco de trabajo**:
- neutros en capas: lienzo gris claro, paneles blancos y cabeceras de sección en gris suave;
- azul Tallkit para la acción principal;
- petróleo para la selección, los enlaces y el foco;
- naranja del logotipo solo como acento de marca;
- bordes finos y radios contenidos;
- elevación reservada a menús, diálogos, notificaciones y la hoja del documento.

La interfaz SHALL mostrar el nombre **Tallkit** con el logotipo del producto y SHALL NOT reproducir marcas, logotipos, ilustraciones, textos ni datos de plantillas de terceros.

El logotipo de Tallkit identifica al sistema, no al emisor de los documentos internos. En la hoja de un documento interno, el encabezado SHALL pertenecer a la entidad fiscal emisora, conforme a PPF-09, y Tallkit SHALL aparecer solo como la mención discreta «Generado con Tallkit». Los logotipos de las entidades fiscales son contenido configurado por el negocio. SHALL NOT sustituir al logotipo de Tallkit en la navegación, la pantalla de acceso ni el resto de la interfaz.

**Trazabilidad:** decisiones 1, 2, 4 y 9 del proposal; `RNF-USA-008`, `RNF-USA-009`, `RNF-MAN-003`; maqueta Tallkit, tablero «Fundamentos»; propuesta `logotipos-por-ruc` §7 y §9.

#### Scenario: Recorrido por pantallas de distintos módulos
- **WHEN** un usuario recorre acceso, inicio, una lista, una ficha, un formulario y el editor de venta
- **THEN** SHALL reconocer en todas la misma paleta, tipografía, geometría, elevación, iconografía y jerarquía de acciones

#### Scenario: Marca visible
- **WHEN** se muestra el marco autenticado o la pantalla de acceso
- **THEN** SHALL aparecer el logotipo y el nombre «Tallkit», sin elementos de la plantilla SAAS Dashboard

#### Scenario: Marca del sistema frente a la del emisor
- **WHEN** las entidades fiscales tienen logotipo y un usuario recorre la navegación y un comprobante interno
- **THEN** la navegación y el acceso SHALL seguir mostrando el logotipo de Tallkit, y el encabezado del comprobante SHALL mostrar el logotipo del emisor con «Generado con Tallkit» solo al pie
