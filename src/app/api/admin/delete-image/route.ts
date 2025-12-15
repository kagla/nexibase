import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { unlink } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // 관리자 확인
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { imageUrl } = await request.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 })
    }

    // URL 검증: /uploads/ 로 시작해야 함
    if (!imageUrl.startsWith('/uploads/')) {
      return NextResponse.json({ error: '잘못된 이미지 경로입니다.' }, { status: 400 })
    }

    // 파일 경로 생성
    const filePath = path.join(process.cwd(), 'public', imageUrl)
    // 썸네일 경로: xxx.webp -> xxx-thumb.webp
    const thumbPath = filePath.replace(/(\.(webp|gif))$/i, '-thumb.webp')

    // 원본 이미지 삭제
    try {
      await unlink(filePath)
      console.log(`이미지 삭제: ${imageUrl}`)
    } catch (err) {
      // 파일이 없어도 무시
      console.log(`이미지 삭제 실패 (파일 없음): ${imageUrl}`)
    }

    // 썸네일 이미지 삭제
    try {
      await unlink(thumbPath)
      console.log(`썸네일 삭제: ${thumbPath}`)
    } catch {
      // 썸네일이 없어도 무시
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('이미지 삭제 에러:', error)
    return NextResponse.json({ error: '이미지 삭제에 실패했습니다.' }, { status: 500 })
  }
}
