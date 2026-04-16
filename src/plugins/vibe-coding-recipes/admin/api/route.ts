import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const difficulty = searchParams.get('difficulty') || ''
    const type = searchParams.get('type') || ''

    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}
    if (difficulty) where.difficulty = difficulty
    if (type) where.type = type

    const [recipes, total] = await Promise.all([
      prisma.vibeRecipe.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          titleEn: true,
          titleKo: true,
          difficulty: true,
          type: true,
          generatedAt: true,
        },
      }),
      prisma.vibeRecipe.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      recipes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Failed to fetch vibe recipes:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    await prisma.vibeRecipe.deleteMany({ where: { id: { in: ids } } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete vibe recipes:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
