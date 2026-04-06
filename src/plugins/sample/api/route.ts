import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: '샘플 플러그인 API 작동 중' })
}
