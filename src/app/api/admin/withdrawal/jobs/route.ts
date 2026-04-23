import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const jobs = await prisma.withdrawalJob.findMany({
    orderBy: { id: 'desc' },
    take: 100,
  })
  return NextResponse.json({ jobs })
}
