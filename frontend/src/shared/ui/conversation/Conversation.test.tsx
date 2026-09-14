import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConversationList } from './ConversationList'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'

const conversations = [
  {
    id: 'a',
    title: 'Hilo A',
    preview: 'Texto neutral A',
    time: '09:00',
    group: 'Recientes',
    unreadCount: 2,
  },
  {
    id: 'b',
    title: 'Hilo B con un título deliberadamente extenso para ajuste',
    preview: 'Texto neutral B',
    time: '08:30',
    group: 'Anteriores',
  },
]

describe('ConversationList y MessageBubble (C63–C64)', () => {
  it('groups supplied threads, announces counters and controls selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ConversationList
        conversations={conversations}
        label="Conversaciones sintéticas"
        onSelect={onSelect}
        selectedId="a"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Recientes' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Anteriores' })).toBeVisible()
    expect(screen.getByLabelText('2 elementos sin leer')).toBeVisible()
    expect(screen.getByRole('button', { name: /Hilo A/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const threadB = screen.getByRole('button', { name: /Hilo B/i })
    threadB.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(conversations[1])
  })

  it('renders incoming and outgoing groups with long text and time in the accessible name', () => {
    render(
      <div>
        <MessageBubble
          direction="incoming"
          groupPosition="start"
          sender="Origen A"
          text="Texto de entrada deliberadamente largo sin datos personales ni referencias de negocio."
          time="09:10"
        />
        <MessageBubble
          direction="outgoing"
          groupPosition="end"
          text="Respuesta neutral B"
          time="09:12"
        />
      </div>,
    )

    expect(screen.getByText(/deliberadamente largo/i)).toBeVisible()
    expect(screen.getByLabelText(/Origen A, 09:10/i)).toHaveAttribute(
      'data-group-position',
      'start',
    )
    expect(screen.getByLabelText(/Mensaje saliente, 09:12/i)).toHaveAttribute(
      'data-direction',
      'outgoing',
    )
  })
})

describe('MessageComposer (C65)', () => {
  it('emits local value changes and submits trimmed text by button or keyboard', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const { rerender } = render(
      <MessageComposer onChange={onChange} onSubmit={onSubmit} value="" />,
    )

    const textbox = screen.getByRole('textbox', { name: 'Mensaje neutral' })
    await user.type(textbox, '  Elemento A  ')
    expect(onChange).toHaveBeenCalled()

    rerender(
      <MessageComposer
        onChange={onChange}
        onSubmit={onSubmit}
        value="  Elemento A  "
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
    expect(onSubmit).toHaveBeenLastCalledWith('Elemento A')

    textbox.focus()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('prevents empty or repeated submission while pending', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { rerender } = render(
      <MessageComposer onChange={() => {}} onSubmit={onSubmit} value="   " />,
    )

    expect(
      screen.getByRole('button', { name: 'Enviar mensaje' }),
    ).toBeDisabled()

    rerender(
      <MessageComposer
        onChange={() => {}}
        onSubmit={onSubmit}
        pending
        value="Elemento A"
      />,
    )
    const pendingButton = screen.getByRole('button', {
      name: 'Enviando mensaje',
    })
    expect(pendingButton).toBeDisabled()
    await user.click(pendingButton)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
