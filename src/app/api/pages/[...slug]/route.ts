import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug: segments } = await params
  const slug = segments.join('/')

  try {
    const page = await prisma.widgetPage.findUnique({
      where: { slug },
      include: {
        widgets: {
          where: { isActive: true },
          orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    })

    if (!page || !page.isActive) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const grouped: Record<string, typeof page.widgets> = {}
    for (const widget of page.widgets) {
      if (!grouped[widget.zone]) grouped[widget.zone] = []
      grouped[widget.zone].push(widget)
    }

    return NextResponse.json({
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        layoutTemplate: page.layoutTemplate,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        seoOgImage: page.seoOgImage,
        seoOgTitle: page.seoOgTitle,
        seoOgDescription: page.seoOgDescription,
        seoCanonical: page.seoCanonical,
        seoNoIndex: page.seoNoIndex,
        seoNoFollow: page.seoNoFollow,
      },
      widgets: grouped,
    })
  } catch (error) {
    console.error('failed to fetch page widgets:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
