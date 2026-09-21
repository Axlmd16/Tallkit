/**
 * Selector de clientes y productos de ventas. Reutiliza el selector de referencias con
 * búsqueda en servidor y paginación explícita: recorre todas las páginas necesarias,
 * conserva la selección tras un error y etiqueta las referencias inactivas explicando
 * por qué bloquean la confirmación.
 */
export {
  ReferencePicker,
  type PickerOption,
  type PickerResults,
} from '@/features/purchases/ReferencePicker'
