import { NextResponse } from 'next/server'
import { getGaClient } from '@/lib/gaClient'
import type { protos } from '@google-analytics/data'
import type { VisitorStatsData } from '@/lib/gaTypes'

export const dynamic = 'force-dynamic'

// 모듈 스코프 인메모리 캐시 (TTL 120초)
let cache: { data: VisitorStatsData; expires: number } | null = null
const CACHE_TTL_MS = 120 * 1000

// 캐시 스탬피드 방지: 동시 요청은 동일한 promise를 공유
let inflight: Promise<VisitorStatsData> | null = null

type GaReportResponse =
  | protos.google.analytics.data.v1beta.IRunReportResponse
  | protos.google.analytics.data.v1beta.IRunRealtimeReportResponse

function getValue(report: GaReportResponse): number {
  return Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0)
}

async function fetchStats(): Promise<VisitorStatsData> {
  const client = await getGaClient()
  if (!client) {
    return { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: false }
  }

  const { propertyId, dataClient } = client
  const property = `properties/${propertyId}`

  const [realtime, today, yesterday, sevenDays] = await Promise.all([
    dataClient.runRealtimeReport({
      property,
      metrics: [{ name: 'activeUsers' }],
    }),
    dataClient.runReport({
      property,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    }),
    dataClient.runReport({
      property,
      dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
      metrics: [{ name: 'activeUsers' }],
    }),
    dataClient.runReport({
      property,
      // 오늘 포함 지난 7일 (6일 전 ~ 오늘)
      dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  ])

  return {
    online: getValue(realtime[0]),
    today: getValue(today[0]),
    yesterday: getValue(yesterday[0]),
    sevenDays: getValue(sevenDays[0]),
    configured: true,
  }
}

/**
 * 홈 위젯용 GA4 방문자 통계.
 * - online: 현재 접속자 (Realtime API, 지난 30분)
 * - today: 오늘 activeUsers
 * - yesterday: 어제 activeUsers
 * - sevenDays: 오늘 포함 지난 7일 activeUsers
 *
 * 설정 미완 시 configured: false 로 응답 (위젯이 자신을 숨김).
 * GA API 실패 시 configured: true + 모든 값 0 (위젯은 0으로 표시).
 * 인메모리 캐시(TTL 120s) + inflight promise guard로 GA 할당량/응답 시간 절약.
 */
export async function GET() {
  // 캐시 히트 시 DB/외부 호출 없이 즉시 반환
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  // 이미 진행 중인 조회가 있으면 그 promise를 공유
  if (inflight) {
    try {
      const data = await inflight
      return NextResponse.json(data)
    } catch {
      return NextResponse.json(
        { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: true },
        { status: 200 }
      )
    }
  }

  // 첫 요청자가 실제 조회 실행
  inflight = fetchStats()
    .then((data) => {
      // configured=true일 때만 캐시 (설정 변경을 다음 요청에서 즉시 반영)
      if (data.configured) {
        cache = { data, expires: Date.now() + CACHE_TTL_MS }
      }
      return data
    })
    .finally(() => {
      inflight = null
    })

  try {
    const data = await inflight
    return NextResponse.json(data)
  } catch (err) {
    console.error('[ga-stats] GA API 호출 실패:', err)
    return NextResponse.json(
      { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: true },
      { status: 200 }
    )
  }
}
