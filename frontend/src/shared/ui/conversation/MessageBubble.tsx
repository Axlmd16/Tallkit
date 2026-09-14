export type MessageDirection = 'incoming' | 'outgoing'
export type MessageGroupPosition = 'single' | 'start' | 'middle' | 'end'

export interface MessageBubbleProps {
  text: string
  time: string
  direction: MessageDirection
  sender?: string | undefined
  groupPosition?: MessageGroupPosition | undefined
  className?: string | undefined
}

const groupClasses: Record<MessageGroupPosition, string> = {
  single: 'rounded-[18px]',
  start: 'rounded-[18px] rounded-b-md',
  middle: 'rounded-md',
  end: 'rounded-[18px] rounded-t-md',
}

export function MessageBubble({
  className = '',
  direction,
  groupPosition = 'single',
  sender,
  text,
  time,
}: MessageBubbleProps) {
  const incoming = direction === 'incoming'
  const accessibleOrigin = incoming
    ? (sender ?? 'Mensaje entrante')
    : 'Mensaje saliente'

  return (
    <article
      aria-label={`${accessibleOrigin}, ${time}`}
      className={`flex ${incoming ? 'justify-start' : 'justify-end'} ${className}`.trim()}
      data-direction={direction}
      data-group-position={groupPosition}
    >
      <div
        className={`max-w-[min(34rem,85%)] px-4 py-2.5 ${groupClasses[groupPosition]} ${
          incoming ? 'bg-surface-muted text-ink' : 'bg-primary text-white'
        }`}
      >
        {incoming && sender && groupPosition !== 'middle' && (
          <p className="mb-1 text-xs font-extrabold">{sender}</p>
        )}
        <p className="break-words text-sm leading-relaxed">{text}</p>
        <time
          className={`mt-1 block text-right text-[11px] ${incoming ? 'text-ink-muted' : 'font-semibold text-white'}`}
        >
          {time}
        </time>
      </div>
    </article>
  )
}
