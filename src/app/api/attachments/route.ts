import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import { getAuthUser } from '@/lib/auth'
import sharp from 'sharp'

// 썸네일 설정
const THUMBNAIL_SIZE = 400 // 썸네일 최대 크기 (px)
const THUMBNAIL_QUALITY = 80 // 썸네일 품질 (1-100)

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
    // Login check
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const boardSlug = formData.get('boardSlug') as string | null

    if (!file) {
      return NextResponse.json(
        { error: '파일을 선택해주세요.' },
        { status: 400 }
      )
    }

    // 게시판 slug 검증 (영문, 숫자, 하이픈만 허용)
    if (boardSlug && !/^[a-z0-9-]+$/.test(boardSlug)) {
      return NextResponse.json(
        { error: '잘못된 게시판 정보입니다.' },
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

    // Validate file size
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

    // 게시판별 년/월 폴더 구조: /uploads/boards/{boardSlug}/{year}/{month}
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    // boardSlug가 있으면 게시판별 폴더, 없으면 기존 files 폴더 사용
    const basePath = boardSlug ? `boards/${boardSlug}` : 'files'
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', basePath, String(year), month)
    const urlPath = `/uploads/${basePath}/${year}/${month}`

    // Create directory
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 파일 저장
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = path.join(uploadDir, storedName)
    writeFileSync(filePath, buffer)

    // Return URL
    const url = `${urlPath}/${storedName}`
    let thumbnailPath: string | null = null

    // 이미지인 경우 썸네일 생성
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      try {
        const thumbnailName = `${timestamp}-${random}_thumb.webp`
        const thumbnailFilePath = path.join(uploadDir, thumbnailName)

        await sharp(buffer)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
            fit: 'cover',
            position: 'center'
          })
          .webp({ quality: THUMBNAIL_QUALITY })
          .toFile(thumbnailFilePath)

        thumbnailPath = `${urlPath}/${thumbnailName}`
        console.log(`썸네일 생성: ${thumbnailName}`)
      } catch (thumbError) {
        console.error('썸네일 생성 실패:', thumbError)
        // 썸네일 생성 실패해도 원본은 업로드됨
      }
    }

    console.log(`파일 업로드: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${storedName}`)

    return NextResponse.json({
      success: true,
      file: {
        filename: file.name,
        storedName,
        filePath: url,
        thumbnailPath,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream'
      }
    })

  } catch (error) {
    console.error('file upload error:', error)
    return NextResponse.json(
      { error: '파일 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
