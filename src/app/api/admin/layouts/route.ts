import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getAvailableLayouts } from '@/lib/layout-loader'

// GET /api/admin/layouts — list available layout folders
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const layouts = getAvailableLayouts()

    return NextResponse.json({ layouts })
  } catch (error) {
    console.error('레이아웃 목록 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
