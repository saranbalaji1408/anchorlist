import { AnchorList } from 'anchorlist'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPosts, delay, type Post } from './data'

const renderPost = (post: Post): ReactNode => (
  <article className="post">
    <h2>{post.title}</h2>
    <p>{post.body}</p>
  </article>
)

/** Feed example: pinned to the top, next pages appended near the end. */
export function FeedExample(): ReactNode {
  const [posts, setPosts] = useState(() => createPosts(20))
  const loading = useRef(false)
  const hasMore = posts.length < 200

  const loadMore = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    await delay(300)
    setPosts((p) => [...p, ...createPosts(20)])
    loading.current = false
  }, [])

  return (
    <section className="example">
      <h1>Feed example</h1>
      <AnchorList
        style={{ height: 500 }}
        scrollerProps={{ id: 'scroller', 'aria-label': 'Posts' }}
        items={posts}
        getKey={(p) => p.id}
        hasMoreEnd={hasMore}
        onEndReached={loadMore}
        footer={hasMore ? <div className="loader">Loading…</div> : <div className="loader">The end</div>}
        renderItem={renderPost}
      />
    </section>
  )
}
