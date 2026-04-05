# 레이아웃 시스템 설계 — 기본/커스텀 레이아웃 전환

## 개요

관리자 환경설정에서 "기본 레이아웃"과 "커스텀 레이아웃" 중 선택할 수 있는 시스템.
개발자가 `src/layouts/` 폴더에 커스텀 테마를 만들어 넣으면, 빌드 시 자동 인식되어 관리자가 선택할 수 있다.

## 핵심 개념

### 두 가지 모드

1. **기본 레이아웃 (`default`)**: 현재 Header, HomePage(위젯 시스템 기반), Footer. 관리자가 위젯으로 홈페이지를 구성.
2. **커스텀 레이아웃**: 개발자가 만든 테마 폴더의 컴포넌트를 사용. Header, HomePage, Footer 각각을 부분 오버라이드 가능.

### 부분 오버라이드

커스텀 폴더에 3개 파일(Header, HomePage, Footer)이 모두 없어도 됨.
존재하는 파일만 커스텀으로 사용하고, 없는 파일은 `default/` 폴더에서 폴백.

예시:
- `custom-theme-a/HomePage.tsx`만 있으면 → 홈만 커스텀, Header/Footer는 default 사용
- `premium-theme/`에 3개 다 있으면 → 전체 커스텀

---

## 폴더 구조

```
src/layouts/
  default/                 ← 기본 폴더 (필수, 항상 존재)
    Header.tsx             ← 현재 src/components/layout/Header.tsx 이동
    HomePage.tsx           ← 현재 src/components/pages/HomePage.tsx 이동
    Footer.tsx             ← 현재 src/components/layout/Footer.tsx 이동
  custom-theme-a/          ← 개발자가 만든 커스텀 테마 예시
    HomePage.tsx           ← 홈만 오버라이드
  premium-theme/           ← 또 다른 테마 예시
    Header.tsx
    HomePage.tsx
    Footer.tsx
```

---

## 빌드 타임 자동 스캔

### 스캔 스크립트: `scripts/scan-layouts.js`

`src/layouts/` 하위 폴더를 스캔하여 사용 가능한 레이아웃 목록과 각 폴더의 파일 존재 여부를 `src/layouts/_generated.ts`로 자동 생성.

**동작:**
1. `src/layouts/` 하위 디렉토리 목록 조회 (`_`로 시작하는 폴더 제외)
2. 각 디렉토리에서 `Header.tsx`, `HomePage.tsx`, `Footer.tsx` 존재 여부 확인
3. 결과를 `src/layouts/_generated.ts`로 출력

**생성 결과 예시:**

```typescript
// src/layouts/_generated.ts (자동 생성 — 직접 수정하지 마세요)
export const layoutManifest = {
  'default': {
    name: 'default',
    files: { Header: true, HomePage: true, Footer: true },
  },
  'custom-theme-a': {
    name: 'custom-theme-a',
    files: { Header: false, HomePage: true, Footer: false },
  },
  'premium-theme': {
    name: 'premium-theme',
    files: { Header: true, HomePage: true, Footer: true },
  },
} as const

export type LayoutFolder = keyof typeof layoutManifest
```

### package.json 연동

```json
{
  "scripts": {
    "dev": "node scripts/scan-layouts.js && next dev --turbopack -p 3200 -H 0.0.0.0",
    "build": "node scripts/scan-layouts.js && next build"
  }
}
```

개발자가 할 일: 폴더에 파일 넣기 → `npm run dev` 또는 `npm run build` → 자동 인식.

---

## 레이아웃 로더

### `src/lib/layout-loader.ts`

관리자가 설정한 `layout_folder` 값을 기반으로 컴포넌트를 로드하는 함수.

**로직:**
```
loadLayoutComponent(folder, componentName)
  1. manifest에서 folder의 componentName 존재 여부 확인
  2. 있으면 → next/dynamic으로 해당 폴더/파일 로드
  3. 없으면 → next/dynamic으로 default/파일 로드
```

**컴포넌트별 dynamic import 맵:**
빌드 타임에 모든 가능한 경로를 미리 정의해야 하므로, manifest 기반으로 import 맵을 생성.

```typescript
// 예시 구조
const componentMap = {
  'default/Header': dynamic(() => import('@/layouts/default/Header')),
  'default/HomePage': dynamic(() => import('@/layouts/default/HomePage')),
  'default/Footer': dynamic(() => import('@/layouts/default/Footer')),
  'custom-theme-a/HomePage': dynamic(() => import('@/layouts/custom-theme-a/HomePage')),
  // ...
}
```

이 맵도 `scan-layouts.js` 스크립트에서 `_generated.ts`에 함께 생성한다.

---

## 관리자 설정

### DB 저장

기존 `Setting` 테이블 활용:
- key: `layout_folder`
- value: `"default"` (기본값)

### 관리자 UI

기존 `/admin/settings` 페이지에 "레이아웃 설정" 섹션 추가:

- 드롭다운: 사용 가능한 레이아웃 폴더 목록
- 각 폴더별 파일 존재 여부 시각적 표시:
  - `default` — Header ✅ HomePage ✅ Footer ✅
  - `custom-theme-a` — Header ❌(default 사용) HomePage ✅ Footer ❌(default 사용)
- 저장 버튼

### API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/settings` | 기존 API에 `layout_folder` 포함 (이미 존재) |
| GET | `/api/admin/layouts` | 사용 가능한 레이아웃 목록 + 파일 정보 (manifest 기반) |
| PUT | `/api/admin/settings` | 기존 API로 `layout_folder` 저장 (이미 존재) |

---

## 컴포넌트 로딩 흐름

```
1. 페이지 요청 (예: 홈페이지)
2. API에서 layout_folder 설정값 조회 → "custom-theme-a"
3. 레이아웃 로더가 판단:
   - Header: custom-theme-a/Header.tsx 있나? → 없음 → default/Header.tsx 사용
   - HomePage: custom-theme-a/HomePage.tsx 있나? → 있음 → 사용
   - Footer: custom-theme-a/Footer.tsx 있나? → 없음 → default/Footer.tsx 사용
4. next/dynamic으로 해당 컴포넌트 로드 → 렌더링
```

---

## 기존 코드 변경 범위

### 파일 이동

| 원본 | 이동 후 |
|------|---------|
| `src/components/layout/Header.tsx` | `src/layouts/default/Header.tsx` |
| `src/components/layout/Footer.tsx` | `src/layouts/default/Footer.tsx` |
| `src/components/pages/HomePage.tsx` | `src/layouts/default/HomePage.tsx` |

### 수정 대상

| 파일 | 변경 내용 |
|------|----------|
| `src/components/layout/UserLayout.tsx` | Header/Footer를 직접 import → 레이아웃 로더에서 로드 |
| `src/components/layout/index.ts` | export 경로 수정 |
| `src/app/page.tsx` | HomePage를 직접 import → 레이아웃 로더에서 로드 |
| `src/app/admin/settings/page.tsx` (또는 해당 컴포넌트) | 레이아웃 설정 섹션 추가 |
| `package.json` | dev/build 스크립트에 scan-layouts.js 추가 |

### 신규 생성

| 파일 | 설명 |
|------|------|
| `scripts/scan-layouts.js` | 레이아웃 폴더 자동 스캔 → _generated.ts 생성 |
| `src/layouts/_generated.ts` | 스캔 결과 (자동 생성, git에 포함) |
| `src/lib/layout-loader.ts` | 레이아웃 로더 (폴백 로직 포함) |
| `src/layouts/default/Header.tsx` | 기존 Header 이동 |
| `src/layouts/default/HomePage.tsx` | 기존 HomePage 이동 |
| `src/layouts/default/Footer.tsx` | 기존 Footer 이동 |
| `src/app/api/admin/layouts/route.ts` | 사용 가능한 레이아웃 목록 API |

### import 경로 업데이트

Header, Footer, HomePage를 import하는 모든 파일에서 경로를 `@/layouts/default/...` 또는 레이아웃 로더로 변경해야 한다. 주요 대상:

- `src/components/pages/*.tsx` 중 Header/Footer를 직접 import하는 파일들
- `src/components/layout/UserLayout.tsx`
- `src/app/page.tsx`

---

## 에러 처리

- `layout_folder` 설정값이 없으면 → `"default"` 사용
- 설정된 폴더가 manifest에 없으면 → `"default"` 폴백 + 관리자에게 경고
- `default/` 폴더에 필수 파일이 없으면 → 빌드 에러 (스캔 스크립트에서 검증)
- 컴포넌트 로드 실패 시 → default 폴백 + 콘솔 에러

---

## 새 테마 추가 가이드 (개발자용)

1. `src/layouts/my-theme/` 폴더 생성
2. 오버라이드할 컴포넌트 작성 (Header.tsx, HomePage.tsx, Footer.tsx 중 원하는 것만)
3. `npm run dev` 실행 → 자동 인식
4. 관리자 환경설정에서 `my-theme` 선택
5. 프로덕션: `npm run build` → 배포
