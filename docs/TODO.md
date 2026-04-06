# NexiBase 다음 작업 목록

## 기능 추가
- [ ] 로그인 이력 기록 — `LoginHistory` 테이블, 로그인 시 IP/UA/시간 INSERT, 마이페이지에서 이력 표시
- [ ] 비밀번호 변경 (/mypage/password)
- [ ] 회원 탈퇴 (/mypage/withdraw)
- [ ] 프로필 이미지 업로드/변경 (/mypage/profile/edit에서)
- [ ] 이메일 알림 설정 (수신 여부 on/off)
- [ ] 404/에러 페이지 커스터마이징
- [ ] 관리자 로그 (누가 어떤 설정을 변경했는지)

## 마이페이지 개선
- [ ] 내가 쓴 글/댓글 "더보기" + 페이지네이션
- [ ] 내가 좋아요 한 글 목록
- [ ] 내 활동 통계 (글 N개, 댓글 N개, 좋아요 N개)

## 플러그인 시스템 개선
- [ ] 플러그인 버전 업데이트 감지 (git submodule 최신 체크)
- [ ] 플러그인 설치/제거 UI (git submodule add/remove를 관리자 UI에서)
- [ ] 플러그인 의존성 체크 (A 플러그인이 B를 필요로 할 때)
- [ ] 플러그인 설정 페이지 (plugin.ts에 settingsSchema 추가)

## 보안
- [ ] API Rate Limiting (로그인 시도 제한 등)
- [ ] CSRF 토큰 강화
- [ ] 관리자 2FA (이중 인증)

## 성능
- [ ] 이미지 CDN 연동 (Cloudflare, AWS S3 등)
- [ ] API 응답 캐싱 전략
- [ ] 정적 페이지 ISR 적용

## 국제화
- [ ] 다국어 지원 (i18n) — 한국어, 영어
