<script lang="ts">
  import { AnchorList } from '@anchorlist/svelte'
  import { createPosts, delay, type Post } from '../../../react/src/examples/data'

  // Feed example: pinned to the top, next pages appended near the end.
  let posts: Post[] = $state.raw(createPosts(20))
  const hasMore = $derived(posts.length < 200)
  let loading = false

  async function loadMore(): Promise<void> {
    if (loading) return
    loading = true
    await delay(300)
    posts = [...posts, ...createPosts(20)]
    loading = false
  }
</script>

<section class="example">
  <h1>Feed example</h1>
  <AnchorList
    id="scroller"
    style="height: 500px"
    aria-label="Posts"
    items={posts}
    getKey={(p) => p.id}
    hasMoreEnd={hasMore}
    onEndReached={loadMore}
  >
    {#snippet children(post)}
      <article class="post">
        <h2>{post.title}</h2>
        <p>{post.body}</p>
      </article>
    {/snippet}
    {#snippet footer()}
      <div class="loader">{hasMore ? 'Loading…' : 'The end'}</div>
    {/snippet}
  </AnchorList>
</section>
