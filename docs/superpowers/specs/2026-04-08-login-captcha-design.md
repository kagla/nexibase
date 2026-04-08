# 로그인 시도 기록 + CAPTCHA (Turnstile / reCAPTCHA 이중 지원)

## 목적

- 로그인 시도를 DB에 기록하여 본인/관리자가 이력 확인 가능
- 3회 초과 실패 시 CAPTCHA를 표시하여 봇/무차별 공격 차단
- Cloudflare Turnstile과 Google reCAPTCHA v3 두 가지를 지원하여, 환경 변수로 전환 가능
- 이메일/비밀번호 로그인에만 적용 (소셜 로그인 제외)

## DB 스키마

```prisma
model LoginAttempt {
  id        Int      @id @default(autoincrement())
  email     String   @db.VarChar(255)
  ip        String   @db.VarChar(50)
  success   Boolean
  reason    String?  @db.VarChar(100)
  createdAt DateTime @default(now())

  @@index([email, createdAt])
  @@index([ip, createdAt])
  @@map("login_attempts")
}
```

## CAPTCHA Provider 전환

환경 변수 `NEXT_PUBLIC_CAPTCHA_PROVIDER`로 제어:

- `turnstile` (기본값): Cloudflare Turnstile 사용
- `recaptcha`: Google reCAPTCHA v3 사용
- 미설정 또는 빈값: CAPTCHA 비활성화 (3회 초과해도 위젯 안 나옴)

### 환경 변수

```
# CAPTCHA Provider 선택 ("turnstile" | "recaptcha" | 빈값=비활성화)
NEXT_PUBLIC_CAPTCHA_PROVIDER=turnstile

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Google reCAPTCHA v3
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
```

### 서버 검증

- `turnstile`: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- `recaptcha`: `https://www.google.com/recaptcha/api/siteverify`

## CAPTCHA 표시 로직

- 로그인 폼에서 이메일 입력 후 blur 시 `/api/auth/login-attempts?email=xxx` 호출
- 해당 이메일의 최근 1시간 내 마지막 성공 이후 연속 실패 횟수가 3회 초과면 CAPTCHA 위젯 표시
- 성공 로그인 기록이 남으면 자연스럽게 카운트 리셋

## 로그인 흐름 변경

현재: LoginPage → signIn("credentials") → NextAuth authorize

변경: LoginPage → /api/auth/login (커스텀 API) → 실패 횟수 체크 → CAPTCHA 필요 시 토큰 검증 → 인증 로직 실행 → LoginAttempt 기록 → 응답

### 서버 측 (/api/auth/login)

1. 요청에서 email, password, captchaToken 추출
2. 해당 이메일의 최근 1시간 실패 횟수 조회
3. 3회 초과 시 captchaToken 필수 — 없으면 `{ captchaRequired: true }` 응답
4. captchaToken이 있으면 NEXT_PUBLIC_CAPTCHA_PROVIDER에 따라 해당 검증 API 호출
5. 검증 통과 시 기존 authorize 로직 실행 (유저 조회, 비밀번호 비교 등)
6. 결과를 LoginAttempt에 기록 (성공/실패, 사유, IP)
7. 성공 시 NextAuth JWT 토큰 생성하여 응답

### 클라이언트 측 (LoginPage)

1. 이메일 blur 시 실패 횟수 API 호출 → 3회 초과면 CAPTCHA 위젯 렌더링
2. `NEXT_PUBLIC_CAPTCHA_PROVIDER`에 따라 Turnstile 또는 reCAPTCHA 위젯 표시
3. 로그인 시도 시 `/api/auth/login`으로 POST (captchaToken 포함)
4. 응답에 `captchaRequired: true`가 오면 CAPTCHA 위젯 표시
5. 성공 시 기존 처리 (라우터 이동, 세션 갱신)

## 패키지

- `@marsidev/react-turnstile` — Cloudflare Turnstile 위젯
- `react-google-recaptcha-v3` — Google reCAPTCHA v3 위젯

## 조회 기능

### 본인 (마이페이지)

- 마이페이지에 "로그인 기록" 섹션 추가
- 본인 이메일의 최근 로그인 기록 표시 (날짜, IP, 성공/실패)

### 관리자

- 관리자 페이지에 로그인 기록 메뉴 추가
- 전체 로그인 기록 조회 (필터: 이메일, IP, 성공/실패, 날짜 범위)

## 수정 대상 파일

- `prisma/schema.base.prisma` — LoginAttempt 모델 추가
- `src/app/api/auth/login/route.ts` — 커스텀 로그인 API (신규)
- `src/app/api/auth/login-attempts/route.ts` — 실패 횟수 조회 API (신규)
- `src/components/pages/auth/LoginPage.tsx` — CAPTCHA 위젯 통합, 로그인 흐름 변경
- `src/app/api/me/login-history/route.ts` — 본인 로그인 기록 API (신규)
- `src/app/mypage/page.tsx` — 로그인 기록 섹션 추가
- `src/app/admin/login-logs/page.tsx` — 관리자 로그인 기록 페이지 (신규)
- `src/app/api/admin/login-logs/route.ts` — 관리자 로그인 기록 API (신규)
- `src/components/admin/Sidebar.tsx` — 로그인기록 메뉴 추가
