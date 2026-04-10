import { createHash } from 'crypto'
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { prisma } from '@/lib/prisma'

export interface GaClient {
  propertyId: string
  dataClient: BetaAnalyticsDataClient
}

// 모듈 스코프 캐시: 한 번 생성한 클라이언트를 프로세스 동안 재사용
let cachedClient: { credentialsHash: string; client: GaClient } | null = null

/**
 * settings 테이블에서 ga4_property_id + ga4_service_account_json을 읽어
 * BetaAnalyticsDataClient 인스턴스를 반환한다.
 *
 * 다음 경우 모두 null을 반환한다 (호출자는 구분할 수 없음):
 * - 두 설정 중 하나라도 비어있음 (미설정)
 * - Service Account JSON 파싱 실패 (형식 오류)
 * - BetaAnalyticsDataClient 생성 중 예외 (인증 라이브러리 에러)
 * - DB 조회 실패
 *
 * 호출자는 "설정 미완 또는 형식 오류" 정도의 통합 메시지를 쓸 것.
 *
 * credentials hash(SHA-256)가 바뀌면 (설정 변경) 캐시를 새로 생성한다.
 */
export async function getGaClient(): Promise<GaClient | null> {
  try {
    const [propRow, jsonRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'ga4_property_id' } }),
      prisma.setting.findUnique({ where: { key: 'ga4_service_account_json' } }),
    ])

    const propertyId = propRow?.value?.trim()
    const jsonStr = jsonRow?.value?.trim()
    if (!propertyId || !jsonStr) return null

    // 설정이 바뀌면 새 클라이언트 생성
    const hash = `${propertyId}:${createHash('sha256').update(jsonStr).digest('hex')}`
    if (cachedClient && cachedClient.credentialsHash === hash) {
      return cachedClient.client
    }

    const credentials = JSON.parse(jsonStr)
    const dataClient = new BetaAnalyticsDataClient({ credentials })
    cachedClient = { credentialsHash: hash, client: { propertyId, dataClient } }
    return cachedClient.client
  } catch (err) {
    console.error('[gaClient] 클라이언트 생성 실패:', err)
    return null
  }
}

/**
 * 테스트 목적으로 캐시를 강제 무효화한다 (현재 사용처 없음, 향후 확장용).
 */
export function invalidateGaClientCache(): void {
  cachedClient = null
}
