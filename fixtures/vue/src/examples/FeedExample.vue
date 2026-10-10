<script setup lang="ts">
import { AnchorList } from '@anchorlist/vue'
import { computed, ref } from 'vue'
import { createPosts, delay, type Post } from '../../../react/src/examples/data'

// Feed example: pinned to the top, next pages appended near the end.
const posts = ref<Post[]>(createPosts(20))
const hasMore = computed(() => posts.value.length < 200)
let loading = false

async function loadMore(): Promise<void> {
  if (loading) return
  loading = true
  await delay(300)
  posts.value = [...posts.value, ...createPosts(20)]
  loading = false
}
</script>

<template>
  <section class="example">
    <h1>Feed example</h1>
    <AnchorList
      id="scroller"
      style="height: 500px"
      aria-label="Posts"
      :items="posts"
      :get-key="(p) => p.id"
      :has-more-end="hasMore"
      @end-reached="loadMore"
    >
      <template #default="{ item }">
        <article class="post">
          <h2>{{ item.title }}</h2>
          <p>{{ item.body }}</p>
        </article>
      </template>
      <template #footer>
        <div class="loader">{{ hasMore ? 'Loading…' : 'The end' }}</div>
      </template>
    </AnchorList>
  </section>
</template>
