import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'
import { isPluginEnabled } from '@/lib/plugins'

// GET /api/home-widgets — backward-compatible: returns Home page widgets grouped by zone
export async function GET() {
  try {
    const homePage = await prisma.widgetPage.findUnique({
      where: { slug: '' },
      include: {
        widgets: {
          where: { isActive: true },
          orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    })

    if (!homePage) {
      return NextResponse.json({ widgets: {} })
    }

    const disabledFolders = new Set<string>()
    for (const [folder] of Object.entries(pluginManifest)) {
      const enabled = await isPluginEnabled(folder)
      if (!enabled) disabledFolders.add(folder)
    }

    const widgets = homePage.widgets.filter(widget => {
      if (widget.widgetType === 'content') return true
      return !Array.from(disabledFolders).some(folder =>
        widget.widgetKey.startsWith(`${folder}-`)
      )
    })

    const grouped: Record<string, typeof widgets> = {}
    for (const widget of widgets) {
      if (!grouped[widget.zone]) grouped[widget.zone] = []
      grouped[widget.zone].push(widget)
    }

    return NextResponse.json({ widgets: grouped })
  } catch (error) {
    console.error('failed to fetch widgets:', error)
    return NextResponse.json({ widgets: {} })
  }
}
