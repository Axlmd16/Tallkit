interface HappyDomWindow {
  happyDOM?: { setViewport(viewport: { width: number; height: number }): void }
}

/** happy-dom evalúa las media queries contra su viewport. */
export function setViewport(width: number, height = 900) {
  ;(window as unknown as HappyDomWindow).happyDOM?.setViewport({
    width,
    height,
  })
}

export const desktopWidth = 1440
export const tabletWidth = 1024
