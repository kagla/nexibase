import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; widgetId: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { widgetId: rawWidgetId } = await params
  const widgetId = parseId(rawWidgetId)
  if (!widgetId) return NextResponse.json({ error: 'Invalid widgetId' }, { status: 400 })

  try {
    await prisma.pageWidget.delete({ where: { id: widgetId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[pages] failed to remove widget:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
