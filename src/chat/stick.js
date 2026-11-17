import { useLayoutEffect, useRef } from 'react'

/** Stay pinned only when the reader is already this close to the latest line. */
export const NEAR_BOTTOM_PX = 40

export function isNearBottom(el, threshold = NEAR_BOTTOM_PX) {
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

/**
 * Keep a message pane at the bottom without ever scrolling the window or a parent.
 * The only write is `scrollTop` on `scrollerRef`.
 * Switching `threadKey` jumps to the latest line. Later updates stick only if the
 * reader was already within NEAR_BOTTOM_PX.
 */
export function useStickToBottom(scrollerRef, { threadKey = '', revision = '' } = {}) {
  const stickRef = useRef(true)

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    stickRef.current = isNearBottom(el)
  }

  useLayoutEffect(() => {
    stickRef.current = true
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [threadKey, scrollerRef])

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el || !stickRef.current) return
    el.scrollTop = el.scrollHeight
  }, [revision, threadKey, scrollerRef])

  return onScroll
}
