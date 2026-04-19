"use client"

import { useLocale } from "next-intl"
import { formatDistanceToNow } from "date-fns"
import { ko, enUS } from "date-fns/locale"

export interface ThreadAuthor {
  id: number | string
  nickname: string
  image: string | null
}

export interface ThreadItemData {
  id: number | string
  author: ThreadAuthor
  content: string
  createdAt: string // ISO date string
}

interface Props {
  item: ThreadItemData
  /** When true, align right and tint primary (viewer's own entry). */
  isMine?: boolean
  /** Optional label rendered next to the nickname (e.g. "관리자", "답변"). */
  badge?: React.ReactNode
  /**
   * When true, align items by sender (mine right / others left).
   * When false, render all items full-width stacked (good for Q&A where
   * there is no "mine" concept). Defaults to true.
   */
  alignBySender?: boolean
}

export function ThreadItem({ item, isMine, badge, alignBySender = true }: Props) {
  const locale = useLocale()
  const dfLocale = locale === 'ko' ? ko : enUS
  const relative = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: dfLocale })
  const absolute = new Date(item.createdAt).toLocaleString(locale)

  const cardColor = isMine ? 'bg-primary/10 border-primary/30' : 'bg-muted/40 border-border'
  const rowJustify = alignBySender
    ? (isMine ? 'justify-end' : 'justify-start')
    : 'justify-start'
  const cardWidth = alignBySender ? 'max-w-[85%] md:max-w-[75%]' : 'w-full'

  return (
    <div className={`flex ${rowJustify}`}>
      <div className={`${cardWidth} border rounded-lg p-3 ${cardColor}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {item.author.image ? (
              <img src={item.author.image} alt={item.author.nickname} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-primary">
                {(item.author.nickname || '?').charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{item.author.nickname}</span>
            {badge && <span className="text-xs">{badge}</span>}
          </div>
          <span className="text-xs text-muted-foreground shrink-0" title={absolute}>
            {relative}
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {item.content}
        </div>
      </div>
    </div>
  )
}
