## ADDED Requirements

### Requirement: Administración del logotipo en modal

Desde la fila «Logo» de cada entidad fiscal, el Administrador SHALL poder:

- **Subir logo**, cuando la entidad no tiene logotipo;
- **Cambiar** el logotipo vigente;
- **Quitar** el logotipo vigente.

Subir y cambiar SHALL abrir un modal conforme a PPF-04 con un selector de archivo, la vista previa del archivo elegido antes de guardar y el nombre de la entidad afectada. Los formatos admitidos (PNG, JPEG o WebP) y los límites (2 MiB y 25 megapíxeles) SHALL mostrarse como un aviso desplegable, no como texto permanente. Una advertencia previa de la interfaz sobre el formato o el tamaño SHALL NOT sustituir la validación del servidor.

Al guardar, el modal SHALL cerrarse, la fila SHALL mostrar la nueva vista previa y SHALL aparecer una notificación temporal conforme a PPF-08. Un rechazo del servidor SHALL mantener el modal abierto, con el motivo junto al selector y el archivo elegido, sin notificación de éxito.

Quitar SHALL pedir una confirmación explícita conforme a PPF-06, que indique que los comprobantes de esa entidad mostrarán solo su nombre. Al confirmar, la fila SHALL mostrar «Sin logo» y SHALL aparecer una notificación temporal.

Trazabilidad: propuesta §6; spec `configuracion-operativa-y-fiscal` («Logotipo opcional por entidad fiscal», «Validación del archivo del logotipo», «Reemplazo y retiro del logotipo»); PPF-04, PPF-06 y PPF-08; RNF-USA-004/005.

#### Scenario: Subir un logotipo
- **DADO** la entidad comercial sin logotipo
- **CUANDO** el Administrador activa «Subir logo», elige una imagen PNG válida, revisa su vista previa y guarda
- **ENTONCES** el modal SHALL cerrarse, la fila «Logo» SHALL mostrar la imagen y SHALL aparecer una notificación temporal.

#### Scenario: Archivo rechazado por el servidor
- **DADO** el modal de logotipo de la entidad artesanal
- **CUANDO** el Administrador intenta guardar un SVG
- **ENTONCES** el modal SHALL permanecer abierto con el motivo junto al selector, y la ficha SHALL conservar el logotipo anterior.

#### Scenario: Quitar con confirmación
- **DADO** la entidad artesanal con logotipo
- **CUANDO** el Administrador activa «Quitar» y confirma
- **ENTONCES** la fila SHALL mostrar «Sin logo» y SHALL aparecer una notificación temporal.

#### Scenario: Cancelar el retiro
- **DADO** el diálogo de confirmación para quitar el logotipo
- **CUANDO** el Administrador cancela
- **ENTONCES** el logotipo SHALL conservarse y el foco SHALL volver a la acción «Quitar».

## MODIFIED Requirements

### Requirement: Entidades fiscales en fichas de consulta paralelas

La sección *Entidades fiscales* SHALL mostrar las dos entidades en paralelo desde 1280 px y apiladas por debajo de ese ancho, separadas por una línea y no por tarjetas. Cada entidad SHALL mostrar:

- su ámbito, con nombre, icono y tono propios;
- su razón social destacada;
- su RUC en una placa de RUC;
- filas de consulta con nombre comercial (o «Sin nombre comercial»), el uso que corresponde a su ámbito y el estado de facturación electrónica con su causa en texto;
- una fila «Logo» con la vista previa reducida del logotipo vigente, que conserva sus proporciones y tiene como texto alternativo «Logo de» seguido de la razón social, o el texto «Sin logo» cuando no tiene;
- el número de series internas activas, con un enlace a *Series y numeración*.

Cada entidad SHALL ofrecer la acción «Editar» para sus datos. La fila «Logo» SHALL ofrecer sus propias acciones conforme a «Administración del logotipo en modal».

El estado de facturación electrónica SHALL usar los nombres vigentes (*Sin configurar*, *Falta completar*, *Requiere revisión*, *Lista para preparación local*). Cuando no esté listo, SHALL enlazar a la subsección que resuelve su primera causa.

Trazabilidad: propuesta §5; CT-001; separación fiscal confirmada; RN-FIS-001…005; RF-ACC-010; spec `sistema-visual-frontend` («Estados y ámbitos comprensibles sin depender del color»); propuesta `logotipos-por-ruc` §6.

#### Scenario: Entidades en escritorio
- **DADO** un ancho de 1280 px
- **CUANDO** el Administrador abre *Entidades fiscales*
- **ENTONCES** SHALL ver la entidad comercial y la artesanal lado a lado, cada una con su ámbito, su razón social, su placa de RUC, su fila «Logo» y sus demás filas de consulta.

#### Scenario: Entidad con configuración incompleta
- **DADO** la entidad artesanal en estado *Falta completar* por falta de punto predeterminado
- **CUANDO** el Administrador consulta su ficha
- **ENTONCES** SHALL ver «Falta completar» con la causa en texto y un enlace a *Establecimientos y puntos de emisión*.

#### Scenario: Entidades en teléfono
- **DADO** un ancho de 360 px
- **CUANDO** el Administrador abre *Entidades fiscales*
- **ENTONCES** las dos entidades SHALL mostrarse apiladas en una columna, cada una con su acción «Editar» y las acciones de su logotipo visibles.

#### Scenario: Logotipo con proporciones extremas
- **DADO** la entidad comercial con un logotipo de 2000 × 200 px
- **CUANDO** el Administrador consulta su ficha
- **ENTONCES** la vista previa SHALL mostrarse completa, sin deformarse ni desbordar la fila.
