import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 상품 Q&A 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Q&A 조회
    const [qnas, total] = await Promise.all([
      prisma.productQna.findMany({
        where: {
          productId: product.id,
          isActive: true
        },
        include: {
          user: {
            select: { id: true, nickname: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.productQna.count({
        where: {
          productId: product.id,
          isActive: true
        }
      })
    ])

    // 비밀글 처리: 본인 또는 관리자만 내용 볼 수 있음
    const currentUserId = session ? session.id : null
    const processedQnas = qnas.map(qna => {
      const isOwner = currentUserId !== null && currentUserId === qna.userId
      const isAdmin = session && session.role === 'admin'
      const canView = !qna.isSecret || isOwner || isAdmin

      return {
        ...qna,
        question: canView ? qna.question : '비밀글입니다.',
        answer: canView ? qna.answer : (qna.answer ? '비밀 답변입니다.' : null),
        user: {
          ...qna.user,
          name: maskName(qna.user.nickname || qna.user.name || '익명')
        },
        canView,
        isOwner
      }
    })

    return NextResponse.json({
      qnas: processedQnas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Q&A 목록 조회 에러:', error)
    return NextResponse.json({ error: 'Q&A를 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

// Q&A 작성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const { question, isSecret } = body

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 })
    }

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Q&A 생성
    const qna = await prisma.productQna.create({
      data: {
        productId: product.id,
        userId: session.id,
        question: question.trim(),
        isSecret: !!isSecret
      },
      include: {
        user: {
          select: { id: true, nickname: true, name: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      qna: {
        ...qna,
        user: {
          ...qna.user,
          name: maskName(qna.user.nickname || qna.user.name || '익명')
        },
        canView: true,
        isOwner: true
      }
    })
  } catch (error) {
    console.error('Q&A 작성 에러:', error)
    return NextResponse.json({ error: 'Q&A 작성에 실패했습니다.' }, { status: 500 })
  }
}

// 이름 마스킹
function maskName(name: string): string {
  if (name.length <= 1) return '*'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}
