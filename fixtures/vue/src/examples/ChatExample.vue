<script setup lang="ts">
import type { FollowContext } from '@anchorlist/core'
import { AnchorList, type AnchorListHandle } from '@anchorlist/vue'
import { ref, useTemplateRef } from 'vue'
import { createMessage, createMessages, delay, type Message } from '../../../react/src/examples/data'

// Chat example: pinned to the bottom, older pages prepended on scroll-up, the user's messages always followed.
const messages = ref<Message[]>(createMessages(30))
const pages = ref(3)
const list = useTemplateRef<AnchorListHandle>('list')
let loading = false

async function loadOlder(): Promise<void> {
  if (loading) return
  loading = true
  await delay(300)
  messages.value = [...createMessages(20), ...messages.value]
  pages.value--
  loading = false
}

const send = (): void => void (messages.value = [...messages.value, createMessage('me', 'a new message from me')])
const receive = (): void => void (messages.value = [...messages.value, createMessage('them', 'a reply')])
const follow = ({ atEdge, added }: FollowContext): boolean =>
  atEdge || messages.value.slice(-added).some((m) => m.author === 'me')
</script>

<template>
  <section class="example">
    <h1>Chat example</h1>
    <AnchorList
      id="scroller"
      ref="list"
      class="chat"
      style="height: 500px"
      aria-label="Messages"
      :items="messages"
      :get-key="(m) => m.id"
      align="end"
      :gap="8"
      :padding-start="8"
      :padding-end="8"
      :has-more-start="pages > 0"
      :follow="follow"
      @start-reached="loadOlder"
    >
      <template v-if="pages > 0" #header>
        <div class="loader">Loading older messages…</div>
      </template>
      <template #default="{ item }">
        <div :class="['bubble', item.author]" :data-author="item.author">{{ item.text }}</div>
      </template>
    </AnchorList>
    <button type="button" @click="send">Send</button>
    <button type="button" @click="receive">Receive</button>
    <button type="button" @click="list?.scrollToEdge()">Jump to latest</button>
  </section>
</template>
