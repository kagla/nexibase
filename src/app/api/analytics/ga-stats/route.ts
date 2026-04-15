import { NextResponse } from 'next/server'
import { getGaClient } from '@/lib/gaClient'
import type { protos } from '@google-analytics/data'
import type { VisitorStatsData } from '@/lib/gaTypes'

export const dynamic = 'force-dynamic'

// Module-scope in-memory cache (TTL 120 seconds)
let cache: { data: VisitorStatsData; expires: number } | null = null
const CACHE_TTL_MS = 120 * 1000

// Prevent cache stampedes: concurrent requests share the same promise
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
      // Last 7 days including today (6 days ago .. today)
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
  // On cache hit, return immediately without hitting the DB or external APIs
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  // If a lookup is already in flight, share its promise
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

  // The first requester actually runs the lookup
  inflight = fetchStats()
    .then((data) => {
      // Only cache when configured=true (so setting changes take effect on the next request)
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
    console.error('[ga-stats] GA API call failed:', err)
    return NextResponse.json(
      { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: true },
      { status: 200 }
    )
  }
}
