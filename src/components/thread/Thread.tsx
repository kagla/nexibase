"use client"

import { forwardRef, Ref } from "react"
import { ThreadItem, ThreadItemData } from "./ThreadItem"

export { ThreadItem } from "./ThreadItem"
export type { ThreadAuthor, ThreadItemData } from "./ThreadItem"

interface Props {
  items: ThreadItemData[]
  /** Predicate for marking an item as belonging to the viewer. */
  isMine?: (item: ThreadItemData) => boolean
  /** Optional per-item badge renderer (e.g. "답변" for admin replies). */
  renderBadge?: (item: ThreadItemData) => React.ReactNode
  /** Slot above the list — e.g. a top sentinel div for "load earlier" observers. */
  header?: React.ReactNode
  /** Empty-state content shown when items.length === 0. */
  emptyState?: React.ReactNode
  /**
   * Align items left/right based on isMine (DM style, default true).
   * Set to false for Q&A-style full-width stacked rendering.
   */
  alignBySender?: boolean
}

/**
 * Thread — generic timestamped list of authored entries.
 * Shared primitive for DM, shop Q&A, order inquiries, etc. Comments
 * (nested, public, with reactions) have different requirements and
 * keep their own dedicated component.
 *
 * The outer container forwards a ref so host components can attach
 * scroll behavior (auto-scroll to bottom, etc.). The header slot is
 * rendered above the first item — callers place IntersectionObserver
 * sentinels for "load earlier" pagination there.
 */
export const Thread = forwardRef<HTMLDivElement, Props>(function Thread(
  { items, isMine, renderBadge, header, emptyState, alignBySender = true },
  ref: Ref<HTMLDivElement>,
) {
  if (items.length === 0) {
    return (
      <div ref={ref} className="flex-1 overflow-y-auto px-4 py-3">
        {header}
        {emptyState}
      </div>
    )
  }
  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      {header}
      {items.map(item => (
        <ThreadItem
          key={item.id}
          item={item}
          isMine={isMine?.(item)}
          badge={renderBadge?.(item)}
          alignBySender={alignBySender}
        />
      ))}
    </div>
  )
})
