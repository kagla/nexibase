# DB 기반 메뉴 시스템 + 홈페이지 위젯 시스템 설계

## 개요

핵심 엔진(Header, Footer, HomePage)을 건드리지 않고 경매 등 새 기능을 메뉴와 홈페이지에 추가할 수 있도록, DB 기반 메뉴 관리 + 위젯 레지스트리 시스템을 구축한다.

## 스펙 범위

### 1. 메뉴 시스템
- Header/Footer 네비게이션을 DB에서 통합 관리
- 게시판, 경매, 쇼핑 등 모든 링크를 관리자가 추가/제거
- 트리 구조: DB는 무제한 중첩(parentId 자기참조), UI는 2단계까지 렌더링
- 그룹(groupName)으로 Footer 컬럼 유연 구성
- 권한 제어: all(공개) / member(로그인) / admin(관리자)
- 관리자 드래그앤드롭 트리 UI

### 2. 위젯 시스템
- 코드에서 위젯 컴포넌트를 레지스트리에 등록
- 관리자가 홈페이지 4개 영역(hero/main/sidebar/bottom)에 위젯 배치
- 위젯별 settings JSON으로 세부 설정 (표시 개수, 카테고리 등)
- on/off, 순서, 크기(colSpan/rowSpan) 지정
- 새 기능 추가 시 레지스트리에 위젯만 등록하면 관리자 UI에 자동 표시

---

## DB 모델

### Menu 테이블

```prisma
model Menu {
  id         Int      @id @default(autoincrement())
  parentId   Int?                                    // null = 최상위 메뉴
  position   String   @db.VarChar(20)                // "header" | "footer"
  groupName  String?  @db.VarChar(50)                // Footer 컬럼명, Header 섹션명
  label      String   @db.VarChar(100)               // 표시 텍스트
  url        String   @db.VarChar(500)               // 링크 URL
  icon       String?  @db.VarChar(50)                // 이모지 또는 아이콘명
  target     String   @default("_self") @db.VarChar(10) // "_self" | "_blank"
  visibility String   @default("all") @db.VarChar(10)   // "all" | "member" | "admin"
  isActive   Boolean  @default(true)
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  parent     Menu?    @relation("MenuTree", fields: [parentId], references: [id], onDelete: Cascade)
  children   Menu[]   @relation("MenuTree")

  @@index([position, sortOrder])
  @@index([parentId])
  @@map("menus")
}
```

### HomeWidget 테이블

```prisma
model HomeWidget {
  id         Int      @id @default(autoincrement())
  widgetKey  String   @unique @db.VarChar(50)        // 레지스트리 키 (예: "auction-live")
  zone       String   @db.VarChar(20)                // "hero" | "main" | "sidebar" | "bottom"
  title      String   @db.VarChar(100)               // 관리자 표시명
  settings   String?  @db.Text                       // JSON 설정값
  colSpan    Int      @default(1)                    // 그리드 너비
  rowSpan    Int      @default(1)                    // 그리드 높이
  isActive   Boolean  @default(true)
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([zone, sortOrder])
  @@map("home_widgets")
}
```

---

## 위젯 레지스트리

`src/lib/widgets/registry.ts`에서 위젯을 코드로 등록한다.

```typescript
interface WidgetDefinition {
  component: React.ComponentType<{ settings?: Record<string, unknown> }>
  label: string                    // 관리자 UI 표시명
  description: string              // 위젯 설명
  defaultZone: "hero" | "main" | "sidebar" | "bottom"
  defaultColSpan: number
  defaultRowSpan: number
  settingsSchema: Record<string, unknown> | null  // 설정 스키마 (null이면 설정 없음)
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  "welcome-banner":  { component: WelcomeBanner,  label: "환영 배너",       ... },
  "site-stats":      { component: SiteStats,      label: "사이트 통계",     ... },
  "latest-posts":    { component: LatestPosts,     label: "최근 게시글",     ... },
  "popular-boards":  { component: PopularBoards,   label: "인기 게시판",     ... },
  "shop-shortcut":   { component: ShopShortcut,    label: "쇼핑몰 바로가기", ... },
  "auction-live":    { component: AuctionLive,     label: "진행중 경매",     ... },
  "community-guide": { component: CommunityGuide,  label: "커뮤니티 가이드", ... },
  "board-cards":     { component: BoardCards,      label: "게시판 카드",     ... },
}
```

### 기존 HomePage 섹션 → 위젯 분리

현재 `HomePage.tsx`에 하드코딩된 각 섹션을 독립 위젯 컴포넌트로 추출:

| 현재 섹션 | 위젯 키 | 위치 기본값 | settings |
|-----------|---------|------------|----------|
| 환영 배너 + 통계 | `welcome-banner` | hero, colSpan: 2 | 없음 |
| 통계 카드 4개 | `site-stats` | hero | 없음 |
| 최근 게시글 | `latest-posts` | main, colSpan: 2, rowSpan: 2 | `{ limit: 6 }` |
| 인기 게시판 | `popular-boards` | sidebar, rowSpan: 2 | `{ limit: 5 }` |
| 쇼핑몰 바로가기 | `shop-shortcut` | main | 없음 |
| 커뮤니티 가이드 | `community-guide` | sidebar | 없음 |
| 게시판 카드들 | `board-cards` | bottom | `{ limit: 4 }` |
| 진행중 경매 (신규) | `auction-live` | main | `{ limit: 4 }` |

---

## 홈페이지 영역 레이아웃

```
┌─────────────────────────────────────────┐
│              HERO ZONE                  │
│  (전체 너비, 환영 배너 + 통계)            │
├────────────────────────┬────────────────┤
│                        │                │
│     MAIN ZONE          │  SIDEBAR ZONE  │
│  (좌측 넓은 영역)        │  (우측)        │
│  최근 게시글, 경매 등     │  인기 게시판 등  │
│                        │                │
├────────────────────────┴────────────────┤
│             BOTTOM ZONE                 │
│  (전체 너비, 게시판 카드 그리드)           │
└─────────────────────────────────────────┘
```

- hero: 4컬럼 그리드, 전체 너비
- main: main 영역 내 2컬럼 기준
- sidebar: sidebar 영역 내 1컬럼
- bottom: 4컬럼 그리드, 전체 너비

---

## API 엔드포인트

### 메뉴 (공개)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/menus?position=header` | Header 메뉴 트리 반환 |
| GET | `/api/menus?position=footer` | Footer 메뉴 groupName별 그룹핑 반환 |

### 메뉴 (관리자)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/menus` | 전체 메뉴 트리 (position별) |
| POST | `/api/admin/menus` | 메뉴 아이템 추가 |
| PUT | `/api/admin/menus/:id` | 메뉴 아이템 수정 |
| DELETE | `/api/admin/menus/:id` | 메뉴 아이템 삭제 (자식 cascade) |
| PUT | `/api/admin/menus/reorder` | 드래그앤드롭 순서/부모 변경 일괄 저장 |

### 위젯 (공개)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/home-widgets` | 활성 위젯 목록 (zone별 정렬, settings 포함) |

### 위젯 (관리자)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/home-widgets` | 전체 위젯 + 레지스트리에 있지만 미배치된 위젯 목록 |
| PUT | `/api/admin/home-widgets/:id` | 위젯 설정/영역/순서 변경 |
| PUT | `/api/admin/home-widgets/layout` | 전체 레이아웃 일괄 저장 |

---

## 관리자 UI

### 메뉴 관리 (/admin/menus)

- 탭: Header | Footer
- 드래그앤드롭 트리 UI (dnd-kit 사용)
- 각 메뉴 아이템: 인라인 수정 또는 모달
- 필드: label, url, icon, target(_self/_blank), visibility(all/member/admin), isActive
- Footer 탭에서는 groupName 지정 가능
- 추가 버튼으로 새 메뉴 아이템 생성

### 위젯 관리 (/admin/home-widgets)

- 4개 영역(hero/main/sidebar/bottom) 시각적 레이아웃 표시
- 위젯을 영역에 드래그 배치 또는 드롭다운으로 영역 선택
- 위젯 클릭 시 설정 패널 열림 (settingsSchema 기반 폼 렌더링)
- on/off 토글
- colSpan/rowSpan 조정 (숫자 입력 또는 프리셋)
- 레지스트리에 있지만 DB에 없는 위젯은 "미배치 위젯" 섹션에 표시

### 관리자 사이드바 변경

`Sidebar.tsx`에 메뉴 관리, 위젯 관리 항목 추가:

```typescript
menuItems = [
  ...기존 항목,
  { id: "menus", label: "메뉴관리", icon: MenuIcon, path: "/admin/menus" },
  { id: "home-widgets", label: "홈화면관리", icon: LayoutDashboard, path: "/admin/home-widgets" },
]
```

---

## 기존 코드 변경 범위

### 수정 대상

| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | Menu, HomeWidget 모델 추가 |
| `src/components/layout/Header.tsx` | 하드코딩된 메뉴 → `/api/menus?position=header` API 호출로 교체 |
| `src/components/layout/Footer.tsx` | 하드코딩된 링크 → `/api/menus?position=footer` API 호출로 교체 |
| `src/components/pages/HomePage.tsx` | 하드코딩된 섹션 → 위젯 렌더러로 교체 |
| `src/components/admin/Sidebar.tsx` | 메뉴관리, 홈화면관리 항목 추가 |

### 신규 생성

| 경로 | 설명 |
|------|------|
| `src/lib/widgets/registry.ts` | 위젯 레지스트리 |
| `src/lib/widgets/renderer.tsx` | zone별 위젯 렌더러 컴포넌트 |
| `src/components/widgets/` | 각 위젯 컴포넌트 (8개) |
| `src/app/api/menus/route.ts` | 공개 메뉴 API |
| `src/app/api/admin/menus/route.ts` | 관리자 메뉴 CRUD API |
| `src/app/api/admin/menus/reorder/route.ts` | 메뉴 순서 변경 API |
| `src/app/api/admin/menus/[id]/route.ts` | 개별 메뉴 수정/삭제 API |
| `src/app/api/home-widgets/route.ts` | 공개 위젯 API |
| `src/app/api/admin/home-widgets/route.ts` | 관리자 위젯 API |
| `src/app/api/admin/home-widgets/[id]/route.ts` | 개별 위젯 설정 API |
| `src/app/api/admin/home-widgets/layout/route.ts` | 레이아웃 일괄 저장 API |
| `src/app/admin/menus/page.tsx` | 메뉴 관리 페이지 |
| `src/app/admin/home-widgets/page.tsx` | 위젯 관리 페이지 |
| `prisma/seed-menus.ts` | 초기 메뉴 시드 데이터 |

---

## 초기 시드 데이터

### Header 메뉴

| label | url | icon | sortOrder |
|-------|-----|------|-----------|
| 홈 | / | 없음 | 0 |
| 인기 | /popular | 🔥 | 1 |
| 쇼핑 | /shop | 🛒 | 2 |
| 경매 | /auction | 🔨 | 3 |
| (기존 게시판들을 Board 테이블에서 읽어 시드) | /boards/{slug} | 없음 | 10~ |

### Footer 메뉴

| groupName | label | url |
|-----------|-------|-----|
| 커뮤니티 | 홈 | / |
| 커뮤니티 | 인기글 | /popular |
| 커뮤니티 | 전체게시판 | /boards |
| 정보 | 회사소개 | /contents/about |
| 정보 | 자주 묻는 질문 | /contents/faq |
| 정보 | 문의하기 | /contents/contact |
| 정책 | 이용약관 | /policies/terms |
| 정책 | 개인정보처리방침 | /policies/privacy |
| 정책 | 취소/반품 정책 | /shop/policy |

### 기본 위젯 배치

| widgetKey | zone | colSpan | rowSpan | sortOrder |
|-----------|------|---------|---------|-----------|
| welcome-banner | hero | 2 | 2 | 0 |
| site-stats | hero | 2 | 1 | 1 |
| latest-posts | main | 2 | 2 | 0 |
| auction-live | main | 2 | 1 | 1 |
| shop-shortcut | main | 1 | 1 | 2 |
| popular-boards | sidebar | 1 | 2 | 0 |
| community-guide | sidebar | 1 | 1 | 1 |
| board-cards | bottom | 4 | 1 | 0 |

---

## 드래그앤드롭 라이브러리

**@dnd-kit/core + @dnd-kit/sortable** 사용:
- 트리 구조 지원 (@dnd-kit/sortable의 SortableTree 패턴)
- React 18/19 호환
- 접근성 좋음
- 번들 사이즈 작음

---

## 에러 처리

- 메뉴 API 실패 시: 빈 메뉴 표시 (사이트 접근 불가 방지)
- 위젯 API 실패 시: 빈 홈페이지 (각 위젯은 독립적으로 에러 핸들링)
- 레지스트리에 없는 widgetKey가 DB에 있을 경우: 무시 (콘솔 경고만)
- 관리자 API: 401/403 적절히 반환
