# Claude Code 규칙

## 프로젝트 정보

### 브랜드명
- **NexiBase** (현재)
- 변경 이력: NexaBase → NexiBase (2025-12)

### 네이밍 의미
- **Next.js + I + Base**
- **I**: Intelligence, Idea, Interface, Individual, Innovation, Initial
- AI 종속 없이 확장 가능한 네이밍

---

## 버전 관리

### 커밋 프로세스
**중요**: 세션 작업이 완료되면 아래 프로세스를 반드시 따라 자동으로 커밋을 수행해야 합니다:
1. 작업 내용에 맞는 새로운 커밋 메시지를 작성 (이전과 다른 메시지여야 함)
2. 한국어로 이모티콘과 함께 한 줄로 설명
3. git add 및 git commit 명령을 자동으로 실행하여 커밋 수행
4. 커밋 메시지는 직접 명령어에 입력:
  ```bash
  git add -A && git commit -m "🎯 작업 내용을 설명하는 메시지"
  ```

**자동 커밋 시점**:
- 세션 작업이 완료되었을 때
- 사용자가 다음 작업을 요청하기 전
- 중요한 기능 구현이나 버그 수정 완료 시

**커밋 메시지 규칙**:
- 이모티콘으로 시작:
  - ✨ 새로운 기능
  - 🐛 버그 수정
  - 🎨 UI/UX 개선
  - ♻️ 리팩토링
  - 📝 문서 수정
  - 🔧 설정 변경
  - 🚀 성능 개선
- 한국어로 작성
- 간결하고 명확하게 한 줄로 설명

**주의**:
- 절대 같은 커밋 메시지를 연속해서 사용하지 않음
- 각 작업의 실제 변경 사항을 정확히 반영하는 메시지 작성
- 매번 다른 커밋 메시지를 사용해야 함 (이전 세션의 메시지와 중복 금지)
- 작업 완료 시점에 즉시 자동 커밋 수행

---

## 코딩 규칙

### 탭/상태 URL 반영
페이지 내 탭이나 상태가 있는 경우, URL 쿼리 파라미터에 반영하여 새로고침 시에도 상태가 유지되도록 구현:

```tsx
import { useSearchParams } from "next/navigation"

// URL에서 탭 상태 읽기
const searchParams = useSearchParams()
const tabParam = searchParams.get('tab')
const activeTab = (tabParam === 'options' || tabParam === 'images') ? tabParam : 'basic'

// 탭 변경 시 URL 업데이트
const setActiveTab = (tab: string) => {
  const params = new URLSearchParams(searchParams.toString())
  if (tab === 'basic') {
    params.delete('tab')
  } else {
    params.set('tab', tab)
  }
  router.replace(`/path/${id}${params.toString() ? `?${params}` : ''}`)
}
```

---

## 설계 결정 기록

### 회원 권한 시스템 단순화 (2025-12)

**변경 내용**: 기존 1~10 레벨 시스템 → 회원/비회원 2단계로 단순화

**변경 이유**:
1. **운영 편의성**: 레벨 1~10까지 세분화된 권한 관리는 실제 운영에서 거의 사용되지 않음
2. **직관적 설정**: "이 게시판은 회원만 글을 쓸 수 있다" vs "레벨 3 이상만 글쓰기 가능"
3. **유지보수 용이**: 복잡한 레벨 비교 로직 제거, 단순 boolean 체크로 변경
4. **실용적 접근**: 대부분의 소규모~중규모 사이트에서 필요한 권한은 "로그인 여부"가 핵심

**권한 체계**:
| 구분 | 설명 |
|------|------|
| 비회원 | 로그인하지 않은 사용자 |
| 회원 | 로그인한 일반 사용자 |
| 관리자 | role이 'admin'인 사용자 (공지 작성, 비밀글 열람 등 관리 권한) |

**게시판 권한 설정**:
- `listLevel`, `readLevel`, `writeLevel`, `commentLevel` → boolean 필드
- `true`: 회원만 가능
- `false`: 모두 가능 (비회원 포함)

**향후 확장**:
- 필요시 role 기반 권한 추가 가능 (예: 'vip', 'premium' 등)
- 레벨 시스템 재도입보다는 역할(role) 기반 권한 권장

---

## 문서

### docs 폴더
프로젝트 관련 기술 문서가 `/docs` 폴더에 저장되어 있습니다:

- `inicis-payment.md` - KG이니시스 결제 연동 가이드 (overlay 모드, iframe 투명화 등)
