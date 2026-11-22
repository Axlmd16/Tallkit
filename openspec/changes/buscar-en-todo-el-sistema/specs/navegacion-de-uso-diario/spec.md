## ADDED Requirements

### Requirement: Acceso a la búsqueda global desde cualquier pantalla

El marco autenticado SHALL ofrecer en cualquier pantalla un disparador visible y un atajo de teclado para abrir el diálogo de **búsqueda global** sin abandonar la pantalla actual hasta elegir un resultado. En la página de inicio, el campo de búsqueda principal SHALL abrir o alimentar la búsqueda global en lugar de redirigir a una sola lista filtrada. Este requisito sustituye la restricción previa de operar sin búsqueda global en `interfaz-y-navegacion.md` §2.1.

Trazabilidad: `DP-036`, reglas 5 y 8; `interfaz-y-navegacion.md` §2.1 (reemplaza la restricción «sin búsqueda global hasta U5»); `RNF-USA-011`; `busqueda-global`; propuesta, decisión 1.

#### Scenario: Apertura desde cualquier pantalla y con atajo de teclado
- **DADO** un usuario autenticado ubicado en cualquier pantalla del sistema (por ejemplo, Mantenimientos, Ventas, Productos o Ajustes)
- **CUANDO** activa el disparador de búsqueda en el marco o pulsa el atajo de teclado de búsqueda global
- **ENTONCES** SHALL abrirse el diálogo de búsqueda global con el foco en el campo de texto, manteniendo la pantalla actual debajo hasta que seleccione un resultado o cierre el diálogo.

#### Scenario: Buscador principal de Inicio
- **DADO** un usuario autenticado en la página de inicio
- **CUANDO** activa o escribe en el buscador principal de la banda superior
- **ENTONCES** SHALL abrirse la búsqueda global con el texto ingresado para localizar placas, clientes, productos o facturas autorizadas a su sesión.
