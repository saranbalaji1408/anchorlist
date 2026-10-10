<script lang="ts">
  import type { FollowContext } from '@anchorlist/core'
  import { AnchorList } from '@anchorlist/svelte'
  import { createMessage, createMessages, delay, type Message } from '../../../react/src/examples/data'

  // Chat example: pinned to the bottom, older pages prepended on scroll-up, the user's messages always followed.
  let messages: Message[] = $state.raw(createMessages(30))
  let pages = $state(3)
  let list: ReturnType<typeof AnchorList<Message>> | undefined = $state()
  let loading = false

  async function loadOlder(): Promise<void> {
    if (loading) return
    loading = true
    await delay(300)
    messages = [...createMessages(20), ...messages]
    pages--
    loading = false
  }

  const send = (): void => void (messages = [...messages, createMessage('me', 'a new message from me')])
  const receive = (): void => void (messages = [...messages, createMessage('them', 'a reply')])
  const follow = ({ atEdge, added }: FollowContext): boolean => atEdge || messages.slice(-added).some((m) => m.author === 'me')
</script>

<section class="example">
  <h1>Chat example</h1>
  <AnchorList
    bind:this={list}
    id="scroller"
    class="chat"
    style="height: 500px"
    aria-label="Messages"
    items={messages}
    getKey={(m) => m.id}
    align="end"
    gap={8}
    paddingStart={8}
    paddingEnd={8}
    hasMoreStart={pages > 0}
    onStartReached={loadOlder}
    {follow}
  >
    {#snippet header()}
      {#if pages > 0}<div class="loader">Loading older messages…</div>{/if}
    {/snippet}
    {#snippet children(message)}
      <div class="bubble {message.author}" data-author={message.author}>{message.text}</div>
    {/snippet}
  </AnchorList>
  <button type="button" onclick={send}>Send</button>
  <button type="button" onclick={receive}>Receive</button>
  <button type="button" onclick={() => list?.scrollToEdge()}>Jump to latest</button>
</section>
