import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 최근 게시글 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')

    const where = {
      isSecret: false,
      board: {
        isActive: true
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          createdAt: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          author: {
            select: {
              nickname: true
            }
          },
          board: {
            select: {
              slug: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.post.count({ where })
    ])

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('최근 게시글 조회 에러:', error)
    return NextResponse.json(
      { error: '게시글을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
