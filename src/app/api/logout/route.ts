import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // 쿠키에서 세션 토큰 가져오기
    const sessionToken = request.cookies.get('session-token')?.value

    // 세션 토큰이 있으면 DB에서 세션 삭제
    if (sessionToken) {
      await prisma.userSession.deleteMany({
        where: { sessionToken }
      })
    }

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그아웃이 완료되었습니다.'
    }, { status: 200 })

    // 쿠키 삭제
    response.cookies.set('session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      path: '/',
    })

    return response

  } catch (error) {
    console.error('로그아웃 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
