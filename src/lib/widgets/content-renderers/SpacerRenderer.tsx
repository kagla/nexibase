'use client'

export default function SpacerRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const height = (settings?.height as number) ?? 40
  return <div style={{ height }} aria-hidden />
}
