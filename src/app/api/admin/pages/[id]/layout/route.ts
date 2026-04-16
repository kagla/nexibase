import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

interface WidgetUpdate {
  id: number
  zone: string
  sortOrder: number
  colSpan?: number
  rowSpan?: number
  isActive?: boolean
  title?: string
  settings?: string | null
}

export async function PUT(
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
    const { items } = body as { items: WidgetUpdate[] }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.pageWidget.update({
          where: { id: item.id },
          data: {
            zone: item.zone,
            sortOrder: item.sortOrder,
            ...(item.colSpan !== undefined && { colSpan: item.colSpan }),
            ...(item.rowSpan !== undefined && { rowSpan: item.rowSpan }),
            ...(item.isActive !== undefined && { isActive: item.isActive }),
            ...(item.title !== undefined && { title: item.title }),
            ...(item.settings !== undefined && { settings: item.settings }),
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pages] failed to save layout:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
