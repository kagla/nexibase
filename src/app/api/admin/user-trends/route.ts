import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 })
  }

  const period = request.nextUrl.searchParams.get("period") || "30" // 7, 30, 90
  const days = parseInt(period)

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  // 일별 가입자 수 집계
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: startDate }, deletedAt: null },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  // 날짜별 집계
  const dateMap = new Map<string, number>()

  // 기간 내 모든 날짜 초기화
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().split("T")[0]
    dateMap.set(key, 0)
  }

  // 실제 가입자 집계
  for (const user of users) {
    const key = user.createdAt.toISOString().split("T")[0]
    dateMap.set(key, (dateMap.get(key) || 0) + 1)
  }

  const trends = Array.from(dateMap.entries()).map(([date, count]) => ({
    date,
    count,
  }))

  // 총 가입자 수
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } })
  const periodUsers = users.length

  return NextResponse.json({
    success: true,
    trends,
    totalUsers,
    periodUsers,
    period: days,
  })
}
