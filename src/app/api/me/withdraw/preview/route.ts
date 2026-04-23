import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { buildWithdrawalPreview } from '@/lib/withdrawal/preview'

export async function GET() {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const preview = await buildWithdrawalPreview(user.id)
  return NextResponse.json(preview)
}
