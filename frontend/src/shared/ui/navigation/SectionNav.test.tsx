import { Gear, MapPin } from '@phosphor-icons/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SectionNav } from './SectionNav'

const items = [
  {
    id: 'entidades',
    label: 'Entidades fiscales',
    href: '?tab=entidades&entidad=2',
    icon: Gear,
    indicator: '2',
  },
  {
    id: 'facturacion',
    label: 'Facturación electrónica',
    href: '?tab=facturacion&entidad=2',
    icon: Gear,
    indicator: '1 pendiente',
    children: [
      {
        id: 'puntos',
        label: 'Establecimientos y puntos de emisión',
        href: '?tab=facturacion&entidad=2&seccion=puntos',
        icon: MapPin,
        indicator: '1 pendiente',
      },
    ],
  },
]

describe('SectionNav', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('presenta enlaces conservando parámetros e indicadores accesibles', () => {
    render(
      <SectionNav
        activeChildId="puntos"
        activeId="facturacion"
        aria-label="Secciones de configuración"
        items={items}
        onSelect={() => {}}
      />,
    )

    expect(
      screen.getByRole('navigation', { name: 'Secciones de configuración' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Entidades fiscales 2/ }),
    ).toHaveAttribute('href', '?tab=entidades&entidad=2')
    expect(
      screen.getByRole('link', { name: /Facturación electrónica 1 pendiente/ }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('link', {
        name: /Establecimientos y puntos de emisión 1 pendiente/,
      }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('activa un enlace sin recargar la página', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <SectionNav
        activeId="entidades"
        aria-label="Secciones"
        items={items}
        onSelect={onSelect}
      />,
    )

    await user.click(
      screen.getByRole('link', { name: /Facturación electrónica/ }),
    )
    expect(onSelect).toHaveBeenCalledWith('facturacion')
  })

  it('lleva el enlace actual a la vista', () => {
    render(
      <SectionNav
        activeId="facturacion"
        aria-label="Secciones"
        items={items}
        onSelect={() => {}}
      />,
    )

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })
  })

  it('muestra las subsecciones solo bajo la sección actual', () => {
    render(
      <SectionNav
        activeId="entidades"
        aria-label="Secciones"
        items={items}
        onSelect={() => {}}
      />,
    )

    expect(
      screen.queryByRole('link', { name: /Establecimientos/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Entidades fiscales/ }),
    ).toHaveAttribute('aria-current', 'page')
  })
})
