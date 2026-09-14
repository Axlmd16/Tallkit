import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppFrame } from './AppFrame'

describe('AppFrame (C29)', () => {
  it('renders sidebar, header, main content and footer via layout slots', () => {
    render(
      <AppFrame
        footer={<div>Pie de página institucional</div>}
        header={<div>Cabecera con perfil</div>}
        sidebar={<aside>Barra lateral</aside>}
      >
        <h1>Área de trabajo principal</h1>
      </AppFrame>,
    )

    expect(screen.getByText('Barra lateral')).toBeInTheDocument()
    expect(screen.getByText('Cabecera con perfil')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Área de trabajo principal',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Pie de página institucional')).toBeInTheDocument()
  })

  it('renders standalone content without sidebar or header cleanly', () => {
    render(
      <AppFrame>
        <div>Vista fluida limpia</div>
      </AppFrame>,
    )

    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveTextContent('Vista fluida limpia')
  })
})
