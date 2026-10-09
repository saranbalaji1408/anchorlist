import { AnchorList, type AnchorListHandle } from 'anchorlist'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createMessage, createMessages, delay, type Message } from './data'

const renderMessage = (message: Message): ReactNode => (
  <div className={`bubble ${message.author}`} data-author={message.author}>
    {message.text}
  </div>
)

/** Chat example: pinned to the bottom, older pages prepended on scroll-up, the user's messages always followed. */
export function ChatExample(): ReactNode {
  const [messages, setMessages] = useState(() => createMessages(30))
  const [pages, setPages] = useState(3)
  const loading = useRef(false)
  const list = useRef<AnchorListHandle>(null)

  const loadOlder = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    await delay(100)
    setMessages((m) => [...createMessages(20), ...m])
    setPages((p) => p - 1)
    loading.current = false
  }, [])

  const send = (): void => setMessages((m) => [...m, createMessage('me', 'a new message from me')])
  const receive = (): void => setMessages((m) => [...m, createMessage('them', 'a reply')])

  return (
    <section className="example">
      <h1>Chat example</h1>
      <AnchorList
        ref={list}
        className="chat"
        style={{ height: 500 }}
        scrollerProps={{ id: 'scroller', 'aria-label': 'Messages' }}
        items={messages}
        getKey={(m) => m.id}
        align="end"
        gap={8}
        paddingStart={8}
        paddingEnd={8}
        hasMoreStart={pages > 0}
        onStartReached={loadOlder}
        follow={({ atEdge, added }) => atEdge || messages.slice(-added).some((m) => m.author === 'me')}
        header={pages > 0 ? <div className="loader">Loading older messages…</div> : null}
        renderItem={renderMessage}
      />
      <button type="button" onClick={send}>
        Send
      </button>
      <button type="button" onClick={receive}>
        Receive
      </button>
      <button type="button" onClick={() => list.current?.scrollToEdge()}>
        Jump to latest
      </button>
    </section>
  )
}
