'use client'

function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo' | null; id: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { provider: 'youtube', id: ytMatch[1] }
  const vmMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vmMatch) return { provider: 'vimeo', id: vmMatch[1] }
  return { provider: null, id: '' }
}

const ASPECT_RATIO: Record<string, string> = { '16:9': '56.25%', '4:3': '75%' }

export default function VideoEmbedRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const url = (settings?.url as string) ?? ''
  const aspectRatio = (settings?.aspectRatio as string) ?? '16:9'
  const { provider, id } = parseVideoUrl(url)
  if (!provider || !id) return null
  const embedUrl = provider === 'youtube'
    ? `https://www.youtube.com/embed/${id}`
    : `https://player.vimeo.com/video/${id}`
  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: ASPECT_RATIO[aspectRatio] ?? '56.25%' }}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
