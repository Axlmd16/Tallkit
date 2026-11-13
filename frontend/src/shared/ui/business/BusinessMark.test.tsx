import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BusinessMark, businessInitials } from './index'

const taller = 'Transmisiones y Embragues Jimenez'
const almacen = 'Transmisiones y Embragues Jimenez Repuestos Automotrices'

describe('BusinessMark', () => {
  it('distingue por iniciales, forma y tono a dos negocios cuyo nombre empieza igual', () => {
    render(
      <>
        <BusinessMark name={taller} scope="artesanal" />
        <BusinessMark name={almacen} scope="commercial" />
      </>,
    )

    const workshop = screen.getByRole('img', { name: taller })
    const store = screen.getByRole('img', { name: almacen })
    expect(workshop).toHaveTextContent('TJ')
    expect(store).toHaveTextContent('TA')
    expect(workshop).toHaveClass('rounded-full', 'bg-scope-artisan')
    expect(store).toHaveClass('rounded-control', 'bg-scope-commercial')
  })

  it('muestra el logotipo configurado con el nombre de la entidad como nombre accesible', () => {
    render(<BusinessMark logoUrl="/logo.png" name={taller} scope="artesanal" />)

    const mark = screen.getByRole('img', { name: taller })
    expect(mark.querySelector('img')).toHaveAttribute('src', '/logo.png')
    expect(mark).not.toHaveTextContent('TJ')
  })

  it('no se anuncia dos veces cuando el nombre ya está escrito al lado', () => {
    render(<BusinessMark decorative name={taller} scope="artesanal" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('calcula iniciales sin letras de enlace y con nombres de una palabra', () => {
    expect(businessInitials('Tienda de la Esquina')).toBe('TE')
    expect(businessInitials('Álvarez')).toBe('ÁL')
    expect(businessInitials('   ')).toBe('?')
  })
})
