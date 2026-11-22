## Why

La usuaria diaria (`DP-036`, regla 1) tiene hoy 18 opciones de menú escondidas en 6 grupos plegados, ve «RUC comercial» y «RUC artesanal» en lugar del nombre de cada negocio, no encuentra la deuda ni los vehículos de un cliente en un solo lugar y consulta el stock en otra pantalla. Además, hay errores de lenguaje y de valores que estorban al cobrar. U3 ya renovó el aspecto; U4 ordena el menú y el lenguaje antes de rehacer el flujo de cobro (U6) y la búsqueda (U5).

## What Changes

**Menú (reemplaza §2.2 de `interfaz-y-navegacion.md`, por `DP-036`, regla 1)**

- Nueve entradas siempre visibles, sin grupos plegables: Inicio, Mantenimientos, Ventas, Facturas, Clientes, Productos, Servicios, Cuentas y Ajustes. Cada entrada sigue mostrándose solo si los permisos efectivos del usuario permiten algo dentro de ella.
- **Ventas** reúne ventas y proformas. **Clientes** reúne clientes y vehículos. **Productos** reúne productos, existencias, movimientos (Kardex) y entradas. **Cuentas** reúne las cuentas por cobrar y las retenciones, con una pestaña por negocio. **Ajustes** agrupa lo poco frecuente: proveedores, marcas y demás auxiliares, usuarios, auditoría, configuración y estado técnico.
- Las rutas actuales siguen funcionando o redirigen; no se pierde ninguna pantalla ni permiso.

**Lenguaje y datos visibles (ajusta `RNF-USA-009` y `RNF-USA-010`, por `DP-036`, reglas 1 y 3)**

- El nombre comercial de cada negocio (o su razón social si no lo tiene) sustituye a «RUC comercial» y «RUC artesanal» en las pantallas de uso diario. El RUC sigue visible en facturas, comprobantes y «Ajustes».
- Términos simples: mantenimiento, recibo, total a pagar, movimientos. El glosario de términos visibles se completa con esas equivalencias.
- Errores corregidos: el botón de cobro que dice «Registrar retención», los precios con seis decimales, «Versión de registro» en la ficha del cliente, «IVA 0% · 0.0000 %» y los avisos que tapan el total.
- La configuración inicial pide el nombre comercial de cada negocio. Sigue siendo opcional: si queda vacío, se muestra la razón social.
- Se corrige `frontend/src/shared/ui/states.test.tsx:21`, que fija el texto «RUC comercial» contra `AGENTS.md`.

**Fichas y listas**

- La ficha del cliente muestra sus vehículos, sus compras (ventas de repuestos y mantenimientos) y su deuda, **sin mezclar los dos negocios**: la deuda se presenta por negocio y sin total conjunto.
- La lista y la ficha de productos muestran la existencia real, solo lectura, a quien ya puede consultar inventario.
- Inicio incorpora las columnas «en el taller» y «falta cobrar». «Falta facturar» queda para U6 y el buscador grande para U5.
- Mantenimientos: contador por segmento (Todas, Abiertas…) calculado por el servidor.

**Facturas antes del cambio 3** (decisión abierta, ver abajo): la entrada existe desde U4 y muestra, en solo lectura, las preparaciones locales de ambos negocios con su estado local. Nunca se presentan como autorizadas (`DP-034`, regla 8).

## Capabilities

### New Capabilities

- `navegacion-de-uso-diario`: las nueve entradas, su contenido, el criterio de permisos por entrada, el contenido de «Ajustes» y qué muestra «Facturas» antes del cambio 3.
- `lenguaje-visible-de-uso-diario`: nombre del negocio en lugar del RUC, términos simples, formato de importes y porcentajes y avisos que no tapan el total.

### Modified Capabilities

- `experiencia-adaptable-frontend`: las entradas y los grupos del menú dejan de ser «los vigentes hasta U4»; se retira el requisito «Navegación y densidad en reemplazo» en lo que toca al menú.
- `objetivos-de-uso-diario`: «Ajustes» pasa de futuro a vigente; se retira la condición «cuando se reorganice la navegación (U4)».
- `gestion-de-clientes`: la ficha reúne vehículos, compras y deuda por negocio.
- `catalogo-de-productos-y-categorias`: el catálogo sigue sin escribir stock, pero la lista y la ficha muestran la existencia real de solo lectura; se ajusta «no mostrar cantidades ficticias» para permitir la lectura de la existencia real.
- `configuracion-operativa-y-fiscal`: la configuración inicial pide el nombre comercial, que sigue opcional.
- `pagina-de-inicio`: columnas «en el taller» y «falta cobrar».
- `ordenes-de-mantenimiento`: contador por segmento en la lista (se confirma en specs si la lista vive aquí o en `historial-de-mantenimientos`).
- `preparacion-y-seguimiento-fiscal`: consulta de preparaciones locales en lista, solo si se aprueba la opción A de «Facturas».

## Decisiones por aprobar

| # | Tema | Recomendación | Alternativas |
|---|---|---|---|
| 1 | Sección 2.2 de `interfaz-y-navegacion.md` | **Se reemplaza** (ya decidido en `DP-036`; se registra al archivar) | — |
| 2 | `RF-REP-006` y `UI-062`: cuentas por cobrar separadas por entidad | **Se mantienen** como pestañas dentro de «Cuentas» | Una sola lista: contradice `RN-FIS-009` |
| 3 | Qué muestra «Facturas» antes del cambio 3 | **A.** Lista de solo lectura de las preparaciones locales de ambos negocios, con filtros por negocio y estado | **B.** Entrada con una explicación y sin lista. **C.** Ocultar la entrada hasta el cambio 3 (8 entradas) |
| 4 | Valor inicial «Crédito» en una venta nueva | **Arreglo pequeño aparte, ahora**, con prueba de regresión y valor inicial «Contado»; no espera a U4 | Incluirlo en U4 |
| 5 | Nombre comercial en la configuración inicial | **Se pide, pero sigue opcional**; la razón social es el respaldo | Hacerlo obligatorio: contradice lo decidido en U1 |
| 6 | Existencia visible en Productos | Solo con el permiso de consultar inventario; sin él, la columna no aparece | Mostrarla a todos |

La opción A de la decisión 3 exige un listado nuevo en la API fiscal (hoy solo se consulta por operación). La decisión 3 también condiciona la búsqueda por factura de U5.

## Impact

- **Frontend:** `app/navigation.ts`, menú lateral, rutas y redirecciones; pantallas de clientes, productos, cuentas, inicio y mantenimientos; textos de «RUC comercial» y «RUC artesanal» (`shared/ui/states.tsx`, `StatLink`, `MiniBarChart` y las pantallas del taller y de ventas); formato de importes; botón de cobro de `BillingDialogs.tsx`; `CustomerDetailPage.tsx`.
- **Backend y API:** existencia en la lista y la ficha de productos; resumen de compras y deuda por negocio del cliente, con permisos por negocio; nombres comerciales visibles para cualquier rol autenticado; contador por estado en mantenimientos; listado de preparaciones fiscales (si se aprueba la opción A). Sin cambios de modelo ni migraciones previstos: el diseño debe confirmarlo.
- **Riesgo alto (TDD, por `AGENTS.md`):** permisos de existencia, compras y deuda por negocio y listado fiscal. El resto es lógica de pantalla o texto.
- **Documentación:** glosario de términos visibles, `interfaz-y-navegacion.md` §2.2 y §3, `RNF-USA-009` y `RNF-USA-010`, `DP-036` (qué muestra «Facturas»), matriz de trazabilidad, `DESIGN.md` (menú) y `docs/cambios-pendientes.md`.
- **Dependencias:** U3 archivado. U5 (búsqueda) y U6 (cobrar y facturar) dependen de este menú y de la decisión 3.
- **Riesgos:** mezclar deuda de los dos negocios en la ficha del cliente (`RN-FIS-009`, invariante 2); perder acceso a pantallas hoy escondidas; mostrar una factura preparada como autorizada.

## Fuera de alcance

- Búsqueda global (U5) y la pantalla «Cobrar y facturar», «Venta rápida», «falta facturar» y el correo en la ficha del cliente (U6).
- Emisión real, ambiente por RUC y estados de emisión (cambio 3 y siguientes); habilitar la emisión real (`DP-034`, regla 8).
- Cambiar permisos, roles, reglas de dinero, impuestos, inventario o numeración.
- Cambiar la dirección visual (U3) o el uso de tableta en el taller.
- Registrar o mostrar costos a quien hoy no los ve (`DP-030`).
- Contenido nuevo de los reportes y alertas de stock bajo (`RF-INV-011`).

## Fuentes consultadas

`docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md` (completos); `docs/cambios-pendientes.md` (U1 y U4); `docs/analisis-del-sistema.md` §8; `docs/prototipo/README.md`; `docs/negocio/requisitos/interfaz-y-navegacion.md` §2 y §3; `docs/negocio/producto/glosario.md` (términos visibles); specs `objetivos-de-uso-diario`, `autorizacion-y-navegacion`, `experiencia-adaptable-frontend`, `gestion-de-clientes`, `catalogo-de-productos-y-categorias`, `configuracion-operativa-y-fiscal` y `preparacion-y-seguimiento-fiscal` (requisitos relevantes); y el código de `frontend/src/app/navigation.ts`, `features/sales/draft.ts` y `fiscal/api`.

**Contradicciones registradas:** la spec `autorizacion-y-navegacion` oculta las entradas sin permiso, mientras U4 habla de nueve entradas «siempre visibles»; se resuelve entendiendo «siempre visibles» como «sin grupos plegables», con el filtro por permisos intacto. El requisito del catálogo de productos prohíbe «cantidades ficticias»; la existencia real de solo lectura no lo contradice, pero obliga a reescribirlo. **Información insuficiente:** la ubicación exacta del requisito del contador por segmento y la existencia de un asistente de configuración inicial en el código; el diseño lo verifica.
