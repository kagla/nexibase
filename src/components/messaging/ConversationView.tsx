"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, EyeOff, Eye, Send } from "lucide-react"
import { Thread, ThreadItemData } from "@/components/thread/Thread"

interface Message {
  id: number
  senderId: number
  content: string
  createdAt: string
}

interface ConversationMeta {
  id: number
  opponent: { id: number; nickname: string; image: string | null }
  hiddenByMe: boolean
}

interface Self {
  id: number
  nickname: string
  image: string | null
}

interface Props {
  conversationId: number
  self: Self
}

export function ConversationView({ conversationId, self }: Props) {
  const t = useTranslations('mypage.messagesThread')
  const tMessages = useTranslations('mypage.messages')
  const tc = useTranslations('common')
  const router = useRouter()

  const [meta, setMeta] = useState<ConversationMeta | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const topSentinelRef = useRef<HTMLDivElement | null>(null)

  const markRead = useCallback(() => {
    fetch(`/api/messages/${conversationId}/read`, { method: 'PUT' }).catch(() => {})
  }, [conversationId])

  // initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/messages/${conversationId}`)
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) router.replace('/mypage/messages')
        return
      }
      const data = await res.json()
      if (cancelled) return
      setMeta(data.conversation)
      setMessages(data.messages)
      setHasMore(data.hasMore)
      setLoading(false)
      markRead()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el) el.scrollTo({ top: el.scrollHeight })
        })
      })
    })()
    return () => { cancelled = true }
  }, [conversationId, markRead, router])

  // No polling — traditional 쪽지 style. New messages appear only on
  // page mount or after the user sends one (see send()). Header Bell
  // notification count updates on route change, which is the cue that
  // a new message has arrived.

  // load earlier when the top sentinel appears
  useEffect(() => {
    if (loading || !hasMore) return
    const sentinel = topSentinelRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return
      if (loadingEarlier || messages.length === 0) return
      setLoadingEarlier(true)
      const firstId = messages[0].id
      const el = scrollRef.current
      const prevScrollHeight = el?.scrollHeight ?? 0
      const res = await fetch(`/api/messages/${conversationId}?before=${firstId}`)
      setLoadingEarlier(false)
      if (!res.ok) return
      const data = await res.json()
      setMessages(prev => [...data.messages, ...prev])
      setHasMore(data.hasMore)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!el) return
          const diff = el.scrollHeight - prevScrollHeight
          el.scrollTop = diff
        })
      })
    })
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [loading, hasMore, messages, conversationId, loadingEarlier])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    const content = draft.trim()
    if (content.length === 0 || content.length > 2000) return
    setSending(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: meta!.opponent.id, content }),
      })
      if (!res.ok) return
      setDraft('')
      // One-shot refetch to pick up the canonical server row (with id +
      // createdAt) for the message we just sent. Not polling.
      setTimeout(async () => {
        const lastId = messages[messages.length - 1]?.id ?? 0
        const r2 = await fetch(`/api/messages/${conversationId}?after=${lastId}`)
        if (r2.ok) {
          const d2 = await r2.json()
          if (d2.messages.length > 0) {
            setMessages(prev => [...prev, ...d2.messages])
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const el = scrollRef.current
                if (el) el.scrollTo({ top: el.scrollHeight })
              })
            })
          }
        }
      }, 300)
    } finally {
      setSending(false)
    }
  }

  async function toggleHide() {
    if (!meta) return
    const next = !meta.hiddenByMe
    await fetch(`/api/messages/${conversationId}/hide`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: next }),
    })
    setMeta({ ...meta, hiddenByMe: next })
  }

  if (loading || !meta) {
    return <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
  }

  // Map Message → ThreadItemData for the generic Thread component.
  const threadItems: ThreadItemData[] = messages.map(m => ({
    id: m.id,
    author: m.senderId === self.id
      ? { id: self.id, nickname: self.nickname, image: self.image }
      : { id: meta.opponent.id, nickname: meta.opponent.nickname, image: meta.opponent.image },
    content: m.content,
    createdAt: m.createdAt,
  }))

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[70vh] md:max-h-[720px] md:border md:rounded-lg md:overflow-hidden md:my-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/mypage/messages')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {meta.opponent.image ? (
              <img src={meta.opponent.image} alt={meta.opponent.nickname} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-primary">{(meta.opponent.nickname || '?').charAt(0)}</span>
            )}
          </div>
          <span className="font-medium truncate">{meta.opponent.nickname}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleHide} title={meta.hiddenByMe ? tMessages('unhideAction') : tMessages('hideAction')}>
          {meta.hiddenByMe ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
      </div>

      {/* Message list — rendered by the shared Thread primitive */}
      <Thread
        ref={scrollRef}
        items={threadItems}
        isMine={item => item.author.id === self.id}
        header={hasMore ? (
          <div ref={topSentinelRef} className="text-center text-xs text-muted-foreground py-2">
            {tc('loading')}
          </div>
        ) : null}
      />

      {/* Input */}
      <form onSubmit={send} className="p-3 border-t flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              send(e as unknown as React.FormEvent)
            }
          }}
          placeholder={t('placeholder')}
          rows={1}
          maxLength={2000}
          className="resize-none"
        />
        <Button type="submit" disabled={sending || draft.trim().length === 0}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <div className="px-3 py-1 text-[10px] text-muted-foreground text-right">
        {draft.length}/2000
      </div>
    </div>
  )
}
