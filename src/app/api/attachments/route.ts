import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import { getAuthUser } from '@/lib/auth'

// 허용 파일 타입 및 크기
const ALLOWED_EXTENSIONS = [
  // 문서
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv',
  // 압축
  '.zip', '.rar', '.7z',
  // 이미지
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  // 기타
  '.hwp', '.hwpx'
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    // 로그인 확인
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: '파일을 선택해주세요.' },
        { status: 400 }
      )
    }

    // 파일 확장자 검증
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `허용되지 않는 파일 형식입니다. (허용: ${ALLOWED_EXTENSIONS.join(', ')})` },
        { status: 400 }
      )
    }

    // 파일 크기 검증
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 10MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // 파일명 생성 (타임스탬프 + 랜덤)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const storedName = `${timestamp}-${random}${ext}`

    // 년/월 폴더 구조
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'files', String(year), month)
    const urlPath = `/uploads/files/${year}/${month}`

    // 디렉토리 생성
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 파일 저장
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = path.join(uploadDir, storedName)
    writeFileSync(filePath, buffer)

    // URL 반환
    const url = `${urlPath}/${storedName}`

    console.log(`파일 업로드: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${storedName}`)

    return NextResponse.json({
      success: true,
      file: {
        filename: file.name,
        storedName,
        filePath: url,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream'
      }
    })

  } catch (error) {
    console.error('파일 업로드 에러:', error)
    return NextResponse.json(
      { error: '파일 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
