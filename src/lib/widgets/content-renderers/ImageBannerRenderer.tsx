'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function ImageBannerRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const src = (settings?.src as string) ?? ''
  const alt = (settings?.alt as string) ?? ''
  const href = (settings?.href as string) ?? ''
  const height = (settings?.height as number) ?? 300
  if (!src) return null
  const img = (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ height }}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="100vw" />
    </div>
  )
  if (href) return <Link href={href}>{img}</Link>
  return img
}
