/** Doble de prueba de los cuadros de dinero: expone apertura, cierre y foco de retorno. */
export const dialogStub =
  (name: string) =>
  (props: {
    open: boolean
    onClose: () => void
    onDone: () => void
    returnFocusRef?: { current: HTMLElement | null }
  }) =>
    props.open ? (
      <div
        aria-label={name}
        data-opener={props.returnFocusRef?.current?.textContent}
        role="dialog"
      >
        <button onClick={props.onClose} type="button">
          Cerrar {name}
        </button>
        <button onClick={props.onDone} type="button">
          Terminar {name}
        </button>
      </div>
    ) : null
