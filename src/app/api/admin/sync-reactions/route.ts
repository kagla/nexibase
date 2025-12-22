import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 리액션 수 동기화 (POST)
export async function POST() {
  try {
    // 관리자 확인
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 모든 게시글의 리액션 수 계산
    const posts = await prisma.post.findMany({
      select: { id: true }
    })

    let updated = 0

    for (const post of posts) {
      // 해당 게시글의 리액션 수 계산
      const reactionCount = await prisma.reaction.count({
        where: { postId: post.id }
      })

      // likeCount 업데이트
      await prisma.post.update({
        where: { id: post.id },
        data: { likeCount: reactionCount }
      })

      updated++
    }

    return NextResponse.json({
      success: true,
      message: `${updated}개 게시글의 리액션 수가 동기화되었습니다.`
    })

  } catch (error) {
    console.error('리액션 동기화 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
