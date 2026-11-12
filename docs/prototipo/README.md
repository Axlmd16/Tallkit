# Prototipo U2 · Tallkit

Copia de las fuentes del lienzo de diseño **«Tallkit · Prototipo U2»**, aprobado por el titular el
2026-11-12 (`docs/cambios-pendientes.md`, U2). El lienzo interactivo está en
<https://claude.ai/artifact/Xdc8YNnWYq5UyC3QFzLai8>; para abrirlo hay que tener acceso a él.

Estos archivos no forman parte del sistema ni se compilan: cada `*.dc.html` es una pantalla del
lienzo y `canvas.json` guarda su posición y las notas. El script `support.js` que cargan lo pone el
lienzo, por eso no se abren directamente en el navegador. La dirección visual que se deriva de este
prototipo está en [`DESIGN.md`](../../DESIGN.md) y se aplica en U3.

## Pantallas

| Archivo | Pantalla |
|---|---|
| `Main.dc.html` | 1 · Inicio |
| `NuevoMantenimiento.dc.html` | 1a · Nuevo mantenimiento |
| `Mantenimiento.dc.html` | 2 · Ficha del mantenimiento |
| `Cobrar.dc.html` | 3 · Cobrar y facturar |
| `VentaRapida.dc.html` | 4 · Venta rápida |
| `Cliente.dc.html` | 5 · Ficha del cliente |
| `Buscar.dc.html` | 6 · Búsqueda global |
| `Menu.dc.html` | Menú lateral (componente común) |
| `MantenimientosLista.dc.html` | 7 · Mantenimientos |
| `Ventas.dc.html` | 8 · Ventas y proformas |
| `Facturas.dc.html` | 9 · Facturas |
| `Clientes.dc.html` | 10 · Clientes |
| `Productos.dc.html` | 11 · Productos |
| `Producto.dc.html` | 11a · Ficha del producto |
| `Entrada.dc.html` | 11b · Entrada de mercadería |
| `Servicios.dc.html` | 12 · Servicios |
| `Cuentas.dc.html` | 13 · Cuentas |
| `Ajustes.dc.html` | 14 · Ajustes |
| `ConfigInicial.dc.html` | 14a · Configuración inicial |

## Qué es de ejemplo

- Clientes, vehículos, productos, importes y números de documento son inventados.
- Los nombres comerciales son reales: «Transmisiones y Embragues Jimenez» (taller) y
  «Transmisiones y Embragues Repuestos Automotrices» (almacén). Sus logos (TJ y RA) son provisionales.
- La razón social, el RUC, la calificación artesanal y los nombres de las personas aparecen como «[…]».
- Las facturas quedan solicitadas, nunca autorizadas, porque la emisión real no está habilitada (`DP-034`, regla 8).
- El selector «Prototipo» de cada pantalla solo existe para cambiar de escenario durante la revisión.
