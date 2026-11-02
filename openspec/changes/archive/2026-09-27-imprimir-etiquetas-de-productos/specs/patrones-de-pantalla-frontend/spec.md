## ADDED Requirements

### Requirement: PPF-10 Preparación e impresión de hoja de etiquetas

Las impresiones repetitivas de piezas pequeñas SHALL prepararse en un modal especializado sobre su pantalla de origen. El modal SHALL reunir, sin navegar durante la preparación:

- el resumen y total de registros incluidos;
- las cantidades por registro, con botones para sumar o restar una copia, y una acción para aplicar una cantidad a todos;
- el tamaño físico fijo y la cuadrícula resultante, como información no editable;
- un selector visual de la posición inicial sobre una hoja en miniatura que distingue posiciones ya usadas, inicio y posiciones que se imprimirán;
- una vista previa paginada de todas las hojas;
- las acciones «Cancelar» e «Imprimir».

El modal SHALL conservar el contexto de la lista o ficha, contener el foco y adaptarse a teléfono permitiendo desplazar su cuerpo. La vista previa podrá reducirse para caber en pantalla, pero la salida SHALL conservar medidas físicas. Errores de datos o composición SHALL permanecer en línea y bloquear la impresión; el éxito de abrir el diálogo del navegador SHALL NOT mostrarse como una notificación temporal ni cerrar el modal.

La lista de cantidades SHALL tener desplazamiento interno acotado para que un lote numeroso no empuje la posición ni las acciones fuera del área útil. «Cancelar» e «Imprimir» SHALL permanecer visibles en un pie fijo del modal. La vista previa SHALL ofrecer controles de visor para reducir y aumentar el zoom en varios pasos, comunicar el porcentaje vigente, ajustar la hoja al ancho disponible y mostrarla completa; el zoom SHALL afectar solo a la presentación en pantalla. Al señalar un registro de la lista, la vista previa SHALL resaltar sus etiquetas sin alterar la salida impresa. Con varias hojas, SHALL ofrecer miniaturas de página para saltar a cualquiera.

La vista de impresión SHALL ser una superficie separada de `DocumentSheet`: reutiliza sus tokens, preparación de marca y disciplina de CSS, pero SHALL NOT presentar metadatos, aviso fiscal ni pie de documento económico. Trazabilidad: propuesta; PPF-04/07/08/09; RNF-USA-001/004/006/007/012; `experiencia-adaptable-frontend`.

#### Scenario: Preparación desde una lista filtrada
- **DADO** una lista con productos seleccionados o el alcance «Todos los del filtro actual»
- **CUANDO** el usuario abre «Imprimir etiquetas»
- **ENTONCES** SHALL permanecer visible el contexto de origen detrás del modal y SHALL poder completar cantidades, posición y revisión sin navegar.

#### Scenario: Modal en teléfono
- **DADO** un ancho de 360 px
- **CUANDO** se abre la preparación de etiquetas
- **ENTONCES** el modal SHALL usar el ancho disponible, mantener cierre y acción principal accesibles y permitir desplazar su contenido sin mover la página de fondo.

#### Scenario: Lote numeroso y zoom de la hoja
- **DADO** un lote de cincuenta productos
- **CUANDO** el usuario revisa cantidades y amplía dos veces la hoja
- **ENTONCES** SHALL desplazarse solo la lista de productos, la posición y las acciones SHALL seguir accesibles y la vista previa SHALL reflejar dos incrementos de zoom sin cambiar las medidas de impresión.

#### Scenario: Señalar un registro del lote
- **DADO** un lote con varios productos en la vista previa
- **CUANDO** el usuario pasa el puntero o enfoca la fila de un producto
- **ENTONCES** la vista previa SHALL resaltar solo las etiquetas de ese producto y el resaltado SHALL NOT aparecer en la impresión.

#### Scenario: Regreso después de imprimir o cancelar
- **CUANDO** el usuario cancela el modal o vuelve del diálogo de impresión
- **ENTONCES** SHALL conservarse la lista o ficha de origen con sus filtros, página y posición de desplazamiento.
