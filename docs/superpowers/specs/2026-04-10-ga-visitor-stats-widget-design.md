# Google Analytics Visitor Stats Widget — 설계

**Date:** 2026-04-10
**Status:** Approved, ready for implementation
**Scope:** `_nexibase.com` (홈페이지 전용)

## 목표

관리자가 GA4 Data API 연동을 설정하면 홈 위젯에 **현재 접속자 / 오늘 / 어제 / 지난 7일** 방문자 수를 표시한다. 데이터는 자체 DB가 아닌 Google Analytics에서 가져온다.

## 배경 / 동기

이전에 자체 VisitLog 기반 방문자 추적 기능을 만들었으나 DB 부담과 관리 복잡성 때문에 폐기했다. 대신 이미 연동되어 있는 Google Analytics의 데이터를 읽어 위젯에 표시하는 방향으로 전환한다.

현재 상태:
- 관리자 설정에 Measurement ID(`G-***`) 필드만 있어서 GA로 **데이터를 보내는** 것만 가능
- GA에 쌓인 **데이터를 읽어오는** 기능은 없음
- 위젯에 숫자를 표시하려면 GA4 Data API + 인증 정보(Property ID + Service Account)가 필요

## 범위

### 포함
- 관리자 설정 UI 확장: GA4 Property ID + Service Account JSON 입력란 추가
- 연결 테스트 버튼 (저장된 설정으로 실제 GA API 호출 검증)
- `gaClient` 헬퍼 (settings에서 credentials 읽어 `BetaAnalyticsDataClient` 인스턴스 반환)
- `/api/analytics/ga-stats` API: 인메모리 캐시(TTL 120초) + inflight promise guard + 4개 지표 병렬 조회
- `VisitorStats` 위젯: 4개 숫자(현재 접속 / 오늘 / 어제 / 지난 7일) 표시, 120초 폴링, 설정 없으면 숨김
- `@google-analytics/data` npm 의존성 추가

### 제외 (향후 작업)
- **관리자 상세 분석 페이지** (`/admin/analytics`) — 그래프/차트, 페이지별 Top 10, 디바이스/브라우저 등 (별도 PR)
- 다른 GA 지표 (페이지뷰, 세션 시간, 유입 경로 등)
- 자체 DB 로그 저장 (GA가 관리)
- 다중 GA 속성 지원 (하나의 Property만)
- IP 마스킹 옵션

## 아키텍처

```
[관리자 설정 화면]
   │
   ├─ Measurement ID      (기존)
   ├─ Property ID         (신규)
   ├─ Service Account JSON (신규, 변경 버튼 방식)
   └─ [연결 테스트] 버튼
        │
        ▼
   settings 테이블 (key-value)
     - google_analytics_id         (기존)
     - ga4_property_id             (신규)
     - ga4_service_account_json    (신규)

─────────────────────────────────────────────

[홈페이지 렌더]
   │
   ▼
VisitorStats 위젯 (client component)
   │
   ├─ 초기: skeleton UI
   └─ fetch /api/analytics/ga-stats
        │
        ▼
   API Route
     ├─ 인메모리 캐시 (TTL 120s) + inflight guard
     ├─ cache hit → 즉시 반환
     └─ cache miss → GA Data API 호출
              │
              ├─ runRealtimeReport → 현재 접속자 (30 min)
              └─ runReport (3 queries) → 오늘 / 어제 / 지난 7일
                    │
                    ▼
              { online, today, yesterday, sevenDays, configured }
              
   120초 후 위젯 polling으로 재요청
```

## 컴포넌트

### 1. 관리자 설정 UI — `src/app/admin/settings/page.tsx` 수정

기존 "외부 서비스" 섹션 또는 GA ID가 있는 위치를 **"Google Analytics"** 섹션으로 분리. 섹션 상단에 짧은 안내 박스:

```
💡 Google Analytics 연동
방문자 통계 위젯을 사용하려면 GA4 Data API 연동이 필요합니다.
자세한 설정 방법: https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries
```

**필드:**

1. **Measurement ID** (`google_analytics_id`) — 기존 유지
   - placeholder: `G-XXXXXXXXXX`
   - 설명: "방문자 추적 스크립트에 사용됩니다"

2. **GA4 Property ID** (`ga4_property_id`) — 신규
   - placeholder: `412345678`
   - 설명: "GA4 관리 → 속성 설정에서 확인"

3. **Service Account JSON** (`ga4_service_account_json`) — 신규
   - **변경 버튼 방식**:
     - 저장값 있음: `✓ 저장됨 (Service Account 키)` 텍스트 + `[변경]` 버튼
     - 변경 버튼 클릭 시: textarea 활성화 → 새 JSON 붙여넣기 → 저장
   - 설명: "Google Cloud에서 다운로드한 JSON 키 전체 내용"

4. **[연결 테스트]** 버튼 (저장 버튼 옆)
   - 클릭: 저장된 설정으로 `POST /api/admin/analytics/test` 호출
   - 성공: 초록색 메시지 "✓ 연결됨" (가능하면 속성 이름도 표시)
   - 실패: 빨간 메시지 + GA 에러 원문

**타입 변경:**

```ts
interface SettingsData {
  // ... 기존 필드 ...
  google_analytics_id: string
  ga4_property_id: string        // 신규
  ga4_service_account_json: string  // 신규
}
```

**기본값:**

```ts
const DEFAULT_SETTINGS: SettingsData = {
  // ...
  google_analytics_id: '',
  ga4_property_id: '',
  ga4_service_account_json: '',
}
```

### 2. 설정 저장 API — 기존 경로 재사용

기존 관리자 settings 저장 API가 이미 `google_analytics_id`를 저장하므로, **코드 변경 없이** 새 두 키도 저장된다. 확인 필요 사항:

- 저장 API가 받는 settings 객체를 특정 키로 필터링하지 않고 전체를 upsert 하는지 확인
- 필터링한다면 새 키 2개를 허용 목록에 추가

### 3. 연결 테스트 API — `src/app/api/admin/analytics/test/route.ts` (신규)

```ts
export async function POST() {
  // 관리자 권한 체크
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 401 })

  try {
    const client = await getGaClient()
    if (!client) {
      return NextResponse.json({ ok: false, error: 'GA 설정이 완료되지 않았습니다.' })
    }
    const { propertyId, dataClient } = client

    // 최소 쿼리로 연결만 검증
    const [report] = await dataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    })

    return NextResponse.json({ 
      ok: true, 
      propertyId,
      todayUsers: Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg })
  }
}
```

### 4. GA Client 헬퍼 — `src/lib/gaClient.ts` (신규)

```ts
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { prisma } from '@/lib/prisma'

interface GaClient {
  propertyId: string
  dataClient: BetaAnalyticsDataClient
}

// 모듈 스코프 캐시: 한 번 생성한 클라이언트를 프로세스 동안 재사용
let cachedClient: { credentialsHash: string; client: GaClient } | null = null

/**
 * settings 테이블에서 ga4_property_id + ga4_service_account_json을 읽어
 * BetaAnalyticsDataClient 인스턴스를 반환한다.
 * 설정이 없거나 JSON 파싱이 실패하면 null을 반환한다.
 */
export async function getGaClient(): Promise<GaClient | null> {
  const [propRow, jsonRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ga4_property_id' } }),
    prisma.setting.findUnique({ where: { key: 'ga4_service_account_json' } }),
  ])

  const propertyId = propRow?.value?.trim()
  const jsonStr = jsonRow?.value?.trim()
  if (!propertyId || !jsonStr) return null

  // 설정이 바뀌면 새 클라이언트 생성
  const hash = `${propertyId}:${jsonStr.length}`
  if (cachedClient && cachedClient.credentialsHash === hash) {
    return cachedClient.client
  }

  try {
    const credentials = JSON.parse(jsonStr)
    const dataClient = new BetaAnalyticsDataClient({ credentials })
    cachedClient = { credentialsHash: hash, client: { propertyId, dataClient } }
    return cachedClient.client
  } catch (err) {
    console.error('[gaClient] Service Account JSON 파싱 실패:', err)
    return null
  }
}
```

### 5. Stats API — `src/app/api/analytics/ga-stats/route.ts` (신규)

```ts
import { NextResponse } from 'next/server'
import { getGaClient } from '@/lib/gaClient'

export const dynamic = 'force-dynamic'

interface Stats {
  online: number
  today: number
  yesterday: number
  sevenDays: number
  configured: boolean
}

// 인메모리 캐시 + inflight guard
let cache: { data: Stats; expires: number } | null = null
let inflight: Promise<Stats> | null = null
const CACHE_TTL_MS = 120 * 1000

async function fetchStats(): Promise<Stats> {
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
      // 오늘 포함 7일: 6일 전부터 오늘까지
      dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  ])

  const getValue = (r: { rows?: Array<{ metricValues?: Array<{ value?: string | null }> }> | null }) =>
    Number(r.rows?.[0]?.metricValues?.[0]?.value ?? 0)

  return {
    online: getValue(realtime[0]),
    today: getValue(today[0]),
    yesterday: getValue(yesterday[0]),
    sevenDays: getValue(sevenDays[0]),
    configured: true,
  }
}

export async function GET() {
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  if (inflight) {
    try {
      const data = await inflight
      return NextResponse.json(data)
    } catch {
      return NextResponse.json(
        { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: false },
        { status: 200 }
      )
    }
  }

  inflight = fetchStats()
    .then((data) => {
      // configured=true일 때만 캐시 (설정 변경 즉시 반영 위해)
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
```

### 6. VisitorStats 위젯 — `src/widgets/VisitorStats.tsx` + `.meta.ts` (신규)

**Meta:**
```ts
export default {
  title: '방문자 통계',
  description: '현재 접속자, 오늘/어제/7일간 방문자 수 (Google Analytics)',
  defaultZone: 'sidebar',
  defaultColSpan: 1,
  defaultRowSpan: 1,
  settingsSchema: null,
}
```

**컴포넌트:**
- `"use client"` 클라이언트 컴포넌트
- state: `useState<Stats | null>(null)`
- useEffect:
  - 초기 fetch
  - `setInterval(fetch, 120_000)`
  - unmount 시 cleanup
- 렌더 분기:
  - `stats === null` → 스켈레톤 UI (얇은 회색 바)
  - `stats.configured === false` → `return null` (위젯 자체 숨김)
  - 그 외 → 숫자 4개 표시
- 숫자 포매팅: `Intl.NumberFormat('ko-KR')`
- UI 구성: 현재 접속(녹색 ping 애니메이션) + 오늘 / 어제 / 지난 7일 리스트 형식

## 데이터 플로우

### 설정 저장

1. 관리자가 Property ID / Service Account JSON 입력
2. 저장 버튼 클릭 → 기존 `/api/admin/settings` PUT 호출
3. settings 테이블에 3개 key upsert
4. `gaClient`의 모듈 캐시는 다음 호출에서 해시 불일치로 자동 무효화

### 연결 테스트

1. 관리자가 [연결 테스트] 클릭
2. `POST /api/admin/analytics/test`
3. API Route가 `getGaClient()` 호출 → 실제 `runReport` 1회 실행
4. 성공: 초록색 메시지 + Property ID + 오늘 사용자 수
5. 실패: 빨간 메시지 + GA 에러 메시지 원문

### 위젯 데이터 조회

1. 홈 페이지 방문 → VisitorStats 마운트 (`stats = null`, 스켈레톤 표시)
2. `GET /api/analytics/ga-stats`
3. API Route 처리:
   - 캐시 hit (120초 이내) → 즉시 반환
   - inflight 있음 → 기존 promise 공유
   - cache miss → `getGaClient()` → GA Data API 4개 병렬 호출 → 캐시 저장 → 반환
4. 설정이 없으면 `{ configured: false }` 반환
5. 위젯:
   - `configured: false` → `return null` (위젯 숨김)
   - 그 외 → 숫자 업데이트 → 표시
6. 120초 후 폴링 재실행

## 에러 처리

| 위치 | 실패 케이스 | 대응 |
|------|-----------|------|
| `gaClient` | 설정 없음 | `null` 반환 |
| `gaClient` | JSON 파싱 실패 | `console.error` + `null` 반환 |
| 연결 테스트 API | GA API 실패 | `{ ok: false, error }` 반환 (200 OK) |
| 연결 테스트 API | 설정 없음 | `{ ok: false, error: 'GA 설정이 완료되지 않았습니다.' }` |
| stats API | 설정 없음 | `{ configured: false, ... }` (200) |
| stats API | GA API 실패 | `console.error` + `{ online: 0, ..., configured: true }` (200) |
| 위젯 fetch 실패 | 네트워크 에러 | 기존 값 유지, 다음 폴링에서 재시도 |
| 위젯 응답 `configured: false` | 설정 안 됨 | `return null` (위젯 숨김) |

## 성능 고려

### GA Data API 할당량

GA4 Data API (Standard, 무료):
- 일 200,000 토큰
- 요청당 1~10 토큰 예상

캐시 120초 기준:
- 최대 `86400 / 120 = 720` 회/일
- 지표 4개 × 10 토큰 × 720 ≈ **28,800 토큰/일**
- 할당량 대비 여유 충분 (약 14%)

### inflight guard

캐시 만료 시 동시에 여러 요청이 들어와도 GA API는 **1회만** 호출된다. 트래픽이 많은 사이트에서 할당량/응답 시간 절약 효과 큼.

### GA Client 재사용

`BetaAnalyticsDataClient` 인스턴스 생성은 비용이 있으므로 모듈 스코프에 캐시. settings가 바뀌면 credentials hash 변경으로 자동 갱신.

## 보안

- Service Account JSON은 **settings 테이블 평문** 저장 (관리자만 접근)
- 관리자 UI는 **변경 버튼 방식**으로 원문 노출 최소화 (저장된 JSON은 화면에 다시 표시하지 않음)
- 연결 테스트 API는 관리자 권한 필수 (`getAdminUser()`)
- Service Account는 GA4 **뷰어(읽기) 권한만** 가지므로 유출 시에도 영향 제한적
- 위젯 자체는 public API (`/api/analytics/ga-stats`)를 호출하지만, 반환 값이 집계 숫자 4개뿐이라 노출 문제 없음

## 테스트 계획

수동 검증 중심 (NexiBase 전반 테스트 패턴):

1. **빌드 통과**: `npx next build`
2. **패키지 설치 확인**: `@google-analytics/data` in package.json
3. **관리자 설정 UI**:
   - 새 필드 2개 표시 (Property ID, Service Account JSON)
   - Service Account JSON은 저장 후 "저장됨" 표시 + 변경 버튼 노출
   - 변경 버튼 클릭 시 textarea 활성화
4. **연결 테스트 버튼**:
   - 설정 없이 클릭 → "GA 설정이 완료되지 않았습니다" 표시
   - 잘못된 JSON → 파싱 에러 메시지
   - 잘못된 Property ID → "Property not found" 등 GA 에러
   - 올바른 설정 → 초록색 "연결됨" + 오늘 사용자 수
5. **위젯 동작**:
   - 설정 없음 → 홈화면관리에서 배치해도 위젯 안 보임
   - 설정 완료 → 숫자 4개 표시
   - 첫 렌더 시 스켈레톤 UI → 데이터 도착 후 숫자
6. **캐시 확인**:
   - 2분 내 반복 호출 시 두 번째 호출이 빠름
   - 설정 변경 후 다음 호출에서 새 값 반영
7. **폴링 확인**:
   - 위젯 배치 후 2분 기다려서 네트워크 탭에 재요청 확인
8. **숨김 처리**:
   - 설정 삭제 후 위젯이 null 렌더되는지

## 향후 작업 (별도 PR)

1. **관리자 분석 페이지** (`/admin/analytics`):
   - 일별 방문자 추이 (선 그래프, 30일)
   - 시간대별 분포
   - 인기 페이지 Top 10
   - 디바이스/브라우저 비율
   - 유입 채널

2. **추가 지표**:
   - 페이지뷰
   - 평균 세션 시간
   - 이탈률
   - 신규 vs 재방문

3. **다중 속성 지원**:
   - 관리자가 여러 GA Property 등록
   - 위젯에서 선택

4. **위젯 스파크라인**:
   - 숫자 옆에 미니 추이 차트
