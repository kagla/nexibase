import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 세션 토큰 가져오기
    const sessionToken = request.cookies.get('session-token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 세션 조회 및 사용자 정보 가져오기
    const session = await prisma.userSession.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
            image: true,
            phone: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true
          }
        }
      }
    })

    // 세션이 없거나 만료됨
    if (!session) {
      return NextResponse.json(
        { error: '세션이 유효하지 않습니다.' },
        { status: 401 }
      )
    }

    // 세션 만료 확인
    if (new Date() > session.expires) {
      // 만료된 세션 삭제
      await prisma.userSession.delete({
        where: { id: session.id }
      })

      return NextResponse.json(
        { error: '세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      )
    }

    // 사용자 정보 반환
    return NextResponse.json({
      user: session.user
    })

  } catch (error) {
    console.error('사용자 정보 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
