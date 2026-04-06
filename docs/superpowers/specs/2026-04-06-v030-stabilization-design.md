# NexiBase v0.3.0 — 안정화 및 정리

## 개요

v0.2.x에서 구축한 플러그인 아키텍처, 위젯 시스템, 레이아웃/테마 시스템의 안정화. 빌드 에러 수정, 데이터 불일치 해결, 플러그인 관리 UI 정리, 활성 체크 로직 통합.

---

## 1. 빌드 에러 수정 (CRITICAL)

### 1-1. 위젯 zone 타입 불일치

**문제:** `scan-plugins.js`가 생성하는 `_generated-registry.ts`에서 WidgetDefinition의 `defaultZone` 타입이 `'hero' | 'main' | 'sidebar' | 'bottom'`으로 정의되어 있지만, 실제 값은 `'top'`, `'center'`, `'right'` 등 변경된 zone명을 사용.

**수정:** `scan-plugins.js`의 WidgetDefinition 인터페이스에서 `defaultZone`의 타입을 `string`으로 변경. zone명은 유동적이므로 엄격한 유니온 타입 대신 `string` 사용.

```typescript
// 수정 전
defaultZone: 'hero' | 'main' | 'sidebar' | 'bottom'

// 수정 후
defaultZone: string
```

### 1-2. 경매 결제 errorRedirect 스코프 에러

**파일:** `src/plugins/auction/api/payment/return/route.ts`

**문제:** `errorRedirect` 함수가 POST 함수의 try 블록 안에서 정의되어 있어 catch 블록에서 접근 불가.

**수정:** `errorRedirect`를 try 블록 밖 (POST 함수 최상위 스코프)으로 이동.

### 1-3. 쇼핑 주문 productId nullable 처리

**파일들:**
- `src/plugins/shop/admin/api/orders/[id]/route.ts` (6곳)
- `src/plugins/shop/api/orders/[orderNo]/route.ts` (1곳)

**문제:** DB에서 `productId`가 `Int?` (nullable)인데, 코드에서 `where: { id: item.productId }` 등으로 non-null을 가정.

**수정:** 각 위치에 null 체크 추가:
```typescript
if (item.productId) {
  await tx.product.update({
    where: { id: item.productId },
    data: { soldCount: { decrement: item.quantity } }
  })
}
```

### 1-4. 대시보드 API null aggregate 처리

**파일:** `src/app/api/admin/dashboard/route.ts`

**문제:** Prisma `_sum.finalPrice`가 null을 반환할 수 있는데 number로 사용.

**수정:** `?? 0` null 병합 연산자 적용:
```typescript
const totalRevenueValue = totalRevenue._sum?.finalPrice ?? 0
```

---

## 2. 위젯 키 불일치 수정

### 문제

`scan-plugins.js`가 위젯 키를 생성할 때 `{pluginFolder}-{widgetName}` 형식으로 생성 (예: `boards-latest-posts`). 하지만 관리자 위젯 페이지의 `WIDGET_META`와 기존 DB의 시드 데이터는 `latest-posts` 형식을 사용.

| 위치 | 키 형식 |
|------|---------|
| DB (시드) | `latest-posts` |
| 관리자 페이지 하드코딩 | `latest-posts` |
| 자동생성 레지스트리 | `boards-latest-posts` |

### 수정

`scan-plugins.js`의 위젯 키 생성 규칙을 변경. 플러그인 prefix를 붙이지 않고 원래 파일명 기반으로 생성:

```
AuctionLive.tsx → auction-live (현재: auction-auction-live)
LatestPosts.tsx → latest-posts (현재: boards-latest-posts)
ShopShortcut.tsx → shop-shortcut (현재: shop-shop-shortcut)
```

PascalCase → kebab-case 변환만 적용하고 플러그인 prefix는 제거. 키 충돌 시에만 prefix 추가.

관리자 위젯 페이지의 하드코딩 `WIDGET_META`는 자동생성 레지스트리에서 가져오도록 변경:
```typescript
import { widgetRegistry } from '@/lib/widgets/registry'
// WIDGET_META를 widgetRegistry에서 동적으로 구성
```

---

## 3. 플러그인 관리 UI 정리

### 현재 상태

모든 플러그인이 한 목록에 혼재. 기본 제공 플러그인과 추가 플러그인의 구분 없음.

### 수정

`/admin/plugins` 페이지를 두 섹션으로 분리:

```
── 기본 제공 ─────────────────────────────────
게시판     v1.0.0  활성 🔘
콘텐츠     v1.0.0  활성 🔘
약관       v1.0.0  활성 🔘

── 추가 플러그인 ──────────────────────────────
경매       v1.0.0  비활성 🔘
쇼핑몰     v1.0.0  비활성 🔘
```

- `plugin.ts`의 `defaultEnabled: true` → "기본 제공" 섹션
- `defaultEnabled: false` → "추가 플러그인" 섹션
- 모든 플러그인의 토글 동작은 동일
- 기본 제공 플러그인 비활성화 시 경고: "이 기능을 비활성화하면 관련 페이지와 메뉴가 숨겨집니다"

---

## 4. 활성 체크 로직 정리

### 현재 상태

- 대시보드 API: `isPluginEnabled('boards')`, `isPluginEnabled('shop')` 개별 호출
- 메뉴 API: `getDisabledSlugs()` 호출
- 위젯 API: `isPluginEnabled(folder)` 반복 호출
- 프론트엔드: 각 컴포넌트가 개별적으로 설정 API 호출

### 수정

백엔드 로직은 현재대로 유지 (서버사이드 체크가 맞음). 프론트엔드만 정리:

공개 설정 API (`/api/settings`) 응답에 `enabledPlugins` 배열 추가:
```json
{
  "settings": { ... },
  "enabledPlugins": ["boards", "contents", "policies"]
}
```

프론트엔드 컴포넌트에서 이 값을 활용하여 불필요한 개별 API 호출 제거.

---

## 수정 대상 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `scripts/scan-plugins.js` | 위젯 키 생성 규칙 변경 (prefix 제거), WidgetDefinition zone 타입 변경 |
| `src/plugins/auction/api/payment/return/route.ts` | errorRedirect 스코프 수정 |
| `src/plugins/shop/admin/api/orders/[id]/route.ts` | productId null 체크 (6곳) |
| `src/plugins/shop/api/orders/[orderNo]/route.ts` | productId null 체크 |
| `src/app/api/admin/dashboard/route.ts` | null aggregate 처리 |
| `src/lib/widgets/_generated-registry.ts` | 재생성 (scan 스크립트 수정 후) |
| `src/app/admin/home-widgets/page.tsx` | WIDGET_META 하드코딩 제거, 레지스트리에서 동적 로드 |
| `src/app/admin/plugins/page.tsx` | 기본 제공/추가 플러그인 섹션 분리 |
| `src/app/api/settings/route.ts` | enabledPlugins 배열 추가 |
