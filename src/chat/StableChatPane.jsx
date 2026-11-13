import { useLayoutEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { btnPrimary, inputClass } from '../components/ui'
import { useI18n } from '../i18n'
import { chatT } from './i18n.js'

const NEAR_BOTTOM_PX = 48

/**
 * Message list stays in a fixed-height scroller. The composer is pinned to the
 * bottom of this pane, so sending a message does not reflow the page around it.
 * The scroller sticks to the bottom only when the reader was already there.
 */
export function StableChatPane({
  messages = [],
  renderMessage,
  draft = '',
  onDraftChange,
  onSend,
  busy = false,
  disabled = false,
  threadKey = '',
  placeholder,
  sendLabel,
  emptyLabel,
  hint,
}) {
  const { lang } = useI18n()
  const scrollerRef = useRef(null)
  const stickRef = useRef(true)
  const text = typeof draft === 'string' ? draft : ''
  const placeholderText = placeholder || chatT(lang, 'placeholder')
  const sendText = sendLabel || chatT(lang, 'send')
  const emptyText = emptyLabel || chatT(lang, 'empty')
  const hintText = hint || chatT(lang, 'hint')
  const tail = messages.length ? messages[messages.length - 1]?.id || messages.length : 0

  const rememberStick = () => {
    const el = scrollerRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
  }

  useLayoutEffect(() => {
    stickRef.current = true
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [threadKey])

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el || !stickRef.current) return
    el.scrollTop = el.scrollHeight
  }, [tail, messages.length, threadKey])

  const send = () => {
    if (busy || disabled || !text.trim()) return
    onSend?.()
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent?.isComposing || event.keyCode === 229) return
    event.preventDefault()
    send()
  }

  return (
    <div className="flex h-[min(32rem,calc(100dvh-14rem))] w-full shrink-0 flex-col overflow-hidden [overflow-anchor:none]">
      <div
        ref={scrollerRef}
        onScroll={rememberStick}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 xx-scroll [overflow-anchor:none] md:px-5"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-sage-500">{emptyText}</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={message?.id || index}>
                {renderMessage ? renderMessage(message, index) : <p className="whitespace-pre-wrap text-sm">{message?.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <form
        className="shrink-0 border-t border-sage-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            className={inputClass + ' max-h-24 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto'}
            rows={2}
            value={text}
            onChange={(event) => onDraftChange?.(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholderText}
            maxLength={4000}
            disabled={disabled}
            aria-label={placeholderText}
          />
          <button
            type="submit"
            className={btnPrimary + ' min-w-11 shrink-0 !px-4'}
            disabled={busy || disabled || !text.trim()}
            aria-label={sendText}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-sage-500">{hintText}</p>
      </form>
    </div>
  )
}
