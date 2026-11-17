/** Deterministic fake content for the examples. */
const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ')

let seed = 1
const random = (): number => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}
const sentence = (min: number, max: number): string =>
  Array.from({ length: min + Math.floor(random() * (max - min)) }, () => WORDS[Math.floor(random() * WORDS.length)]).join(' ')

export interface Message {
  id: string
  author: 'me' | 'them'
  text: string
}

let messageId = 0
export const createMessage = (author: Message['author'] = random() < 0.4 ? 'me' : 'them', text = sentence(2, 40)): Message => ({
  id: `msg-${++messageId}`,
  author,
  text,
})
export const createMessages = (count: number): Message[] => Array.from({ length: count }, () => createMessage())

export interface Post {
  id: string
  title: string
  body: string
}

let postId = 0
export const createPosts = (count: number): Post[] =>
  Array.from({ length: count }, () => ({ id: `post-${++postId}`, title: sentence(2, 6), body: sentence(10, 80) }))

export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
