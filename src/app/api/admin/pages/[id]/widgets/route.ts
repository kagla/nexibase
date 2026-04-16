import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const pageId = parseId(raw)
  if (!pageId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const body = await request.json()
    const { widgetKey, widgetType, zone, title, settings } = body as {
      widgetKey: string; widgetType?: string; zone: string; title: string; settings?: string | null
    }

    if (!widgetKey || !zone || !title) {
      return NextResponse.json({ error: 'widgetKey, zone, and title are required' }, { status: 400 })
    }

    const widget = await prisma.pageWidget.create({
      data: {
        pageId,
        widgetKey,
        widgetType: widgetType === 'content' ? 'content' : 'registry',
        zone,
        title,
        settings: settings ?? null,
        sortOrder: 99,
      },
    })

    return NextResponse.json({ widget }, { status: 201 })
  } catch (err) {
    console.error('[pages] failed to add widget:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
