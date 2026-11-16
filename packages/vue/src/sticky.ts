import type { VisibleRange } from '@anchorlist/core'
import { stickyState } from '@anchorlist/core/sticky'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  shallowRef,
  type PublicProps,
  type SetupContext,
  type SlotsType,
  type VNode,
  type VNodeChild,
} from 'vue'

/** Props of {@link StickyItem}. */
export interface StickyItemProps<T> {
  /** The visible range passed to the `sticky` slot of `AnchorList`. */
  range: VisibleRange
  /** The list's items (the same array as `AnchorList`'s `items`). */
  items: readonly T[]
  /**
   * Whether an item sticks to the viewport start once scrolled past (for
   * example a group header). Keep it stable (module scope): the walk back to
   * the previous sticky item is remembered while it and `items` stay the same.
   */
  isSticky: (item: T) => boolean
}

/** Slots of {@link StickyItem}. */
export interface StickyItemSlots<T> {
  /** Renders the stuck copy. Usually the list's row content. Give it a background. */
  default?: (props: { item: T }) => VNodeChild
}

/**
 * Sticky items (for example group headers) for `AnchorList`: the last sticky
 * item scrolled past stays at the top of the viewport until the next one
 * pushes it out. Render it in the `sticky` slot:
 *
 * ```vue
 * <AnchorList :items="rows" :get-key="(r) => r.id">
 *   <template #default="{ item }"><Row :row="item" /></template>
 *   <template #sticky="range">
 *     <StickyItem :range="range" :items="rows" :is-sticky="isHeader" v-slot="{ item }"><Row :row="item" /></StickyItem>
 *   </template>
 * </AnchorList>
 * ```
 *
 * The rows themselves stay in normal flow and are never `position: sticky`;
 * this renders an `aria-hidden`, `inert` copy of the stuck item over them, so
 * screen readers read each header once, in its place, and keyboard focus never
 * lands in the copy. Being inert, the copy does not receive clicks either: they
 * reach whatever is under it (the header row itself while it is in view).
 */
export const StickyItem: <T>(
  props: StickyItemProps<T> & PublicProps,
  ctx?: Omit<SetupContext<never[], SlotsType<StickyItemSlots<T>>>, 'expose'>,
) => VNode & {
  /** Types for template tooling (the shape `vue-tsc` uses for generic components). */
  __ctx?: { props: StickyItemProps<T>; slots: StickyItemSlots<T>; expose(exposed: unknown): void; attrs: Record<string, unknown>; emit: unknown }
} = /*#__PURE__*/ defineComponent(
  (props: StickyItemProps<unknown>, { slots }) => {
    let el: HTMLElement | undefined
    const index = shallowRef(-1)
    // The index-based predicate, new whenever `items` or `isSticky` change (see stickyState).
    let memo: [readonly unknown[], (item: never) => boolean, (i: number) => boolean] | undefined
    // The `sticky` overlay sits directly inside the scroll container.
    const container = (): HTMLElement => el!.parentElement!.parentElement!
    const update = (): void => {
      const { items, isSticky } = props
      if (!memo || memo[0] !== items || memo[1] !== isSticky) memo = [items, isSticky, (i) => i < items.length && isSticky(items[i])]
      const s = stickyState(container(), props.range, memo[2], el!.offsetHeight)
      el!.style.transform = `translateY(${s.offset}px)`
      index.value = s.index
    }
    onMounted(() => {
      // Set here rather than as a prop: Vue would assign `el.inert = ''`, which is false.
      el!.setAttribute('inert', '')
      // `scroll` cannot be cancelled, so the listener is passive anyway.
      container().addEventListener('scroll', update)
      update()
    })
    onUpdated(update)
    onBeforeUnmount(() => container().removeEventListener('scroll', update))
    return () => {
      const item = props.items[index.value]
      return h('div', { ref: (e: unknown) => void (el = (e as HTMLElement | null) ?? el), 'aria-hidden': 'true' }, item === undefined ? undefined : slots.default?.({ item }))
    }
  },
  { props: ['range', 'items', 'isSticky'] },
) as never
