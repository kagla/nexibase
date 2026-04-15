import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getGaClient } from '@/lib/gaClient'

export const dynamic = 'force-dynamic'

/**
 * 관리자 전용 — 저장된 GA4 설정으로 실제 API 호출 1회 실행하여 연결 검증.
 * 성공 시 propertyId와 오늘 사용자 수를 함께 반환한다.
 * 설정 누락 / JSON 파싱 실패 / GA 인증 실패 / 권한 미부여 등 모든 실패는
 * 200 OK + { ok: false, error } 로 응답 (프론트가 에러 메시지 그대로 표시).
 */
export async function POST() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 401 })
  }

  try {
    const client = await getGaClient()
    if (!client) {
      return NextResponse.json({
        ok: false,
        error: 'GA4 설정(Property ID + Service Account JSON)이 완료되지 않았거나 JSON 형식이 올바르지 않습니다.',
      })
    }

    const { propertyId, dataClient } = client

    // Minimal query to verify the connection: today's activeUsers
    const [report] = await dataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    })

    const todayUsers = Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0)

    return NextResponse.json({
      ok: true,
      propertyId,
      todayUsers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analytics/test] GA API call failed:', err)
    return NextResponse.json({ ok: false, error: msg })
  }
}
