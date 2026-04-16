'use client'

export default function HtmlEmbedRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const code = (settings?.code as string) ?? ''
  if (!code) return null
  return <div dangerouslySetInnerHTML={{ __html: code }} />
}
