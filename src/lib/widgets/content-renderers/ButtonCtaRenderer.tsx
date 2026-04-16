'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Variant = 'default' | 'outline' | 'destructive'
type Size = 'sm' | 'default' | 'lg'
type Align = 'left' | 'center' | 'right'

const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export default function ButtonCtaRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const text = (settings?.text as string) ?? 'Click here'
  const href = (settings?.href as string) ?? '#'
  const variant = (settings?.variant as Variant) ?? 'default'
  const size = (settings?.size as Size) ?? 'default'
  const align = (settings?.align as Align) ?? 'center'
  return (
    <div className={ALIGN_CLASS[align]}>
      <Button asChild variant={variant} size={size}>
        <Link href={href}>{text}</Link>
      </Button>
    </div>
  )
}
