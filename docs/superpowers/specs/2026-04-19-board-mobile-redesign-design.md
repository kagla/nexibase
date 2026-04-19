# 게시판 모바일/데스크탑 모던 리디자인

**브랜치:** `feat/board-mobile-redesign`
**작성일:** 2026-04-19
**범위:** 게시글 상세 페이지 + 목록 페이지 (글쓰기 페이지 제외)
**타겟 파일:**
- `src/plugins/boards/components/BoardPostPage.tsx` (상세)
- `src/plugins/boards/components/BoardListPage.tsx` (목록)

---

## 1. 목표

현재 게시판 UI는 모바일 뷰에서 카드 중첩·테두리·리액션 버튼 크기 등으로 인해 복잡해 보이고, 스크롤 공간이 비효율적으로 사용된다. 이를 모바일 네이티브 앱 수준의 모던한 디자인으로 전환하고, 동일 디자인 언어를 데스크탑까지 반응형으로 확장한다.

비가시 요구사항:
- **노안 사용자 배려**: 본문 16px, 메타 13px, 10–11px 절대 금지
- **코어 무변경 원칙 준수**: plugins/boards 내부만 변경, `@/components/ui/*` 등 코어 컴포넌트 수정 금지
- **기능 불변**: API·데이터·권한 로직은 그대로, 렌더링 트리만 재구성

---

## 2. 디자인 방향

"**B. Social Feed 구조 + A. Minimal 리액션**" 하이브리드.

Threads/Twitter 류의 아바타-우선 헤더 레이아웃을 베이스로 하되, 리액션 칩은 얇은 pill(테두리만) 스타일로 눌러진 상태만 색 배경을 갖는다.

타이포그래피·간격은 노안 가독성 기준을 따른다.

---

## 3. 상세 페이지 (BoardPostPage) 레이아웃

### 3.1 구조 (위→아래)

```
┌──────────────────────────────────┐
│ [← 자유게시판]       [‹ › ☰]   │  상단 바 (hairline 하단)
├──────────────────────────────────┤
│ ⬤ test1                          │  작성자 헤더
│    Apr 17, 10:55 PM · 👁14·👍2·💬6│  (한 라인 메타)
│                                   │
│ write by test1                   │  제목 (22px bold)
│                                   │
│ Im test1 ahahahahaha             │  본문 (16px)
│ ──────────────────────────────── │  hairline
│ [👍 1] [😂 1] [👌] [🙏] [😮]      │  리액션 칩 (모바일: 이모지+카운트)
│                                   │
│               [✎ Edit] [🗑 Delete]│  (작성자/관리자만)
├──────────────────────────────────┤
│ 💬 댓글 6                        │
│ ⬤ test2  · 1h              ⋯   │
│   Im test2 alalalalal             │
│   답글 · 😊                       │
│   │ ⬤ test1 · 30m          ⋯   │  대댓글 (connector 라인)
│   │   @test2 테스트1 이다        │
│   │   답글 · 😊                   │
│                                   │
│ ┌ ⬤ 댓글을 입력하세요...   [➤] ┐│  compose (inline 맨 아래)
└──────────────────────────────────┘
```

### 3.2 핵심 변경 사항 (현재 → 새 디자인)

| 영역 | 현재 | 새 디자인 |
|---|---|---|
| 카드 래퍼 | `<Card>` 2개 (본문/댓글) | 제거, 본문과 댓글이 동일 섹션으로 흐름 |
| 상단 바 | 뒤로가기 + 게시판명 + 이전/다음/목록 | 유지 (아이콘만, 데스크탑은 라벨 포함) |
| 작성자 영역 | 제목 아래, 박스 border-y | 제목 위로, 박스 제거, 한 줄 메타 |
| 제목 | 좌측 정렬, 24px | 좌측 정렬, 22px 모바일 / 28px 데스크탑 |
| 메타 (조회/추천/댓글) | 별도 라인, hairline 2줄 | 작성자 밑 메타 라인에 통합 (`·` 구분) |
| 본문 | prose class 유지 | 동일, padding-bottom 후 hairline |
| 리액션 | variant=default/outline 버튼 크게 | pill chip — 모바일: 이모지+카운트, 데스크탑: 이모지+라벨+카운트. 0인 항목은 카운트 숨김 |
| 편집/삭제 | hairline 상단 분리된 블록 | 리액션 밑에 `variant="ghost"`로 덜 강조 |
| 댓글 헤더 | `<h3>` + MessageSquare 아이콘 | 동일 유지 (폰트만 조정) |
| 댓글 행 | border-b + avatar + 내용 | 유지, connector 라인으로 depth 강조 |
| 대댓글 | padding-left:44px | 유지, `::before` connector 추가 |
| 댓글 입력 | MiniEditor 블록 + 등록 버튼 | MiniEditor는 유지하되, compose 래퍼를 pill 모양 배경(`bg-muted rounded-full`)으로 감싸 통일. 모바일·데스크탑 모두 inline 맨 아래 배치 (sticky 아님) |

### 3.3 리액션 칩 상세

```tsx
// 활성: 블루 pill + 카운트
<button class="rounded-full border border-primary bg-primary/10 text-primary px-2 py-1 text-[13px] inline-flex items-center gap-1">
  <span class="text-[15px]">👍</span>
  <span class="font-semibold">1</span>
</button>

// haha 활성: 엠버 계열
// <button class="border-amber-500 bg-amber-500/10 text-amber-400 …">

// 비활성: 테두리만, 카운트 숨김
<button class="rounded-full border border-border px-2 py-1 text-[13px]">
  <span class="text-[15px]">👌</span>
</button>
```

데스크탑(`sm:`)에서는 라벨 span(`Like` 등) 추가:
```tsx
<span class="hidden sm:inline text-[13px]">{t(`reactions.${type}`)}</span>
```

### 3.4 네스티드 댓글 connector

대댓글은 `pl-11 relative` + 의사 요소:
```css
.reply::before {
  content: "";
  position: absolute;
  left: 19px;
  top: 16px;
  bottom: 16px;
  width: 2px;
  background: hsl(var(--border));
}
```

---

## 4. 목록 페이지 (BoardListPage) 레이아웃

### 4.1 구조

```
┌──────────────────────────────────┐
│ 자유게시판              [✎ 글쓰기]│  헤더 (제목+설명+버튼)
│ 자유롭게 이야기하세요             │
│ ──────────────────────────────── │
│ ╭ 📌 공지  이용 규칙 안내       ╮│  공지 (옅은 빨강 배경)
│ ╰ admin · 4/10 · 👁238·👍12·💬4 ╯│  공지 메타 (일반과 동일 항목)
│ ╭ 📌 공지  이벤트: 4월 베스트 글╮│
│ ╰ admin · 4/15 · 👁102 · 💬8    ╯│
│ ──────────────────────────────── │
│ write by test1                   │  일반 글 제목 (14px bold)
│ test1 · 2h · 👁14 · 👍2 · 💬6   │  메타 (13px)
│ ──────────────────────────────── │
│ 오늘의 잡담 🍕                   │
│ user2 · 5h · 👁42 · 💬3         │
│ ──────────────────────────────── │
│ 주말에 뭐하세요?                  │
│ kim · 1d · 👁88 · 👍5 · 💬12    │
│                                   │
│          [더 보기]                │  pagination 대체
└──────────────────────────────────┘
```

### 4.2 변경 사항

| 영역 | 현재 | 새 디자인 |
|---|---|---|
| 게시판 카드 래퍼 | `<Card>` 감싸기 | 제거, hairline 구분 |
| 공지 블록 | flex 한 줄 (배지+제목+날짜) | 2줄: 배지+제목 / 메타 라인. 배경 `bg-red-500/5 rounded-lg` |
| 공지 메타 | 날짜만 | 일반 글과 동일: 작성자·날짜·👁·👍·💬 (0인 값 숨김) |
| 일반 글 | flex 한 줄 (제목+숫자들) | 2줄: 제목(14px bold) / 메타(13px) |
| 페이지네이션 | 페이지 번호 (1 2 3 …) | **더 보기 버튼** (tap시 다음 페이지 append). 마지막 페이지에서 버튼 숨김 |
| 갤러리 모드 (`displayType==='gallery'`) | 기존 유지 | 기존 유지 (본 리디자인 범위 외) |

### 4.3 메타 라인 렌더링 규칙

```tsx
<div className="flex gap-1.5 text-[13px] text-muted-foreground flex-wrap items-center">
  <span>{post.author.nickname}</span>
  <span className="opacity-50">·</span>
  <span>{formatDate(post.createdAt)}</span>
  <span className="opacity-50">·</span>
  <span>👁 {post.viewCount}</span>
  {post.likeCount > 0 && (<><span className="opacity-50">·</span><span>👍 {post.likeCount}</span></>)}
  {board.useComment && post.commentCount > 0 && (<><span className="opacity-50">·</span><span>💬 {post.commentCount}</span></>)}
</div>
```

### 4.4 "더 보기" 페이지네이션

- 상태: `posts` 배열을 누적(`setPosts(prev => [...prev, ...data.posts])`)
- `page` 증가 후 `fetchPosts()` 재실행, loading 스피너는 버튼 자리에 인라인 표시
- `totalPages` 도달 시 버튼 숨김
- 초기 렌더는 기존과 동일 (page=1)

---

## 5. 반응형 전략 (Tailwind)

기준 breakpoint는 Tailwind 기본 `sm:` (≥640px). 데스크탑은 `sm:` 이상.

| 속성 | 모바일 | 데스크탑 (sm:) |
|---|---|---|
| 컨테이너 max-width | 100% (viewport) | `sm:max-w-3xl` (상세) / `sm:max-w-4xl` (목록) |
| 가로 padding | `px-4` | `sm:px-6` |
| 제목 폰트 | `text-[22px]` | `sm:text-[28px]` |
| 본문 폰트 | `text-base` (16px) | 동일 |
| 메타 폰트 | `text-[13px]` | 동일 |
| 아바타 (헤더) | 40px | `sm:w-11 sm:h-11` |
| 리액션 라벨 | hidden | `sm:inline` |
| 이전/다음/목록 라벨 | hidden | `sm:inline` |
| 댓글 input | 100% | `sm:max-w-xl` 정도 |

---

## 6. 타이포그래피·스페이싱 기준 (a11y)

- **절대 최소 폰트 크기: 12px** (10–11px 금지)
- 본문: 16px / line-height 1.55
- 제목(상세): 22px 모바일 / 28px 데스크탑 / weight 700
- 메타 텍스트: 13px / muted-foreground
- 댓글 본문: 15px
- 버튼·인터랙션 라벨: 13–14px, `py-2` 이상 (탭 타겟 44px 권장)
- 리액션 칩 이모지: 15px, 라벨·카운트 13px

---

## 7. 변경하지 않는 것

- 글쓰기 페이지 (`BoardWritePage.tsx`) — 사용자 요청으로 현재 UI 유지
- 편집 페이지 (`BoardEditPage.tsx`) — 글쓰기와 동일하므로 제외
- API / DB / 권한 로직 — 일체 무변경
- 갤러리 뷰 (`displayType === 'gallery'`) 본체 — 본 범위 외
- 첨부파일 블록 로직 — 유지 (다만 타이포그래피만 규격 적용)
- i18n 메시지 키 — 추가 없음 (기존 재사용)

---

## 8. 구현 단계 (하이레벨)

1. 브랜치 생성 (`feat/board-mobile-redesign`)
2. `BoardPostPage.tsx` 리팩토링
   - 상단 바 유지
   - 작성자 헤더 + 메타 통합 라인 구축
   - 제목 위치 이동
   - 리액션 칩 → pill 스타일
   - 편집/삭제 ghost 버튼화
   - 댓글 connector 라인 추가
   - compose 래퍼 pill 배경
3. `BoardListPage.tsx` 리팩토링
   - Card 래퍼 제거
   - 공지 2줄 메타 구조
   - 일반 글 2줄 메타 구조
   - 페이지네이션 → "더 보기" 버튼 + 누적 로딩
4. 반응형 클래스 적용 (`sm:` 분기)
5. 접근성·가독성 검증 (모바일 Chrome DevTools, 실제 디바이스 or 375×667 viewport)
6. 기존 기능 회귀 확인 (댓글 작성/수정/삭제, 리액션, 이전/다음 이동, 비밀글, 관리자 권한)

---

## 9. 열린 이슈 / 후속 작업

- 갤러리 뷰(`displayType==='gallery'`) 리디자인 — 별도 스펙에서 다룸
- 편집 페이지 재디자인 — 필요 시 별도 스펙
- 댓글 리액션(`CommentReactions` 컴포넌트) — 현재 그대로. 본 리디자인에서 칩 스타일과의 시각적 정합성은 최소화(현 상태 유지)
- 첨부파일 UI 고도화 — 현 구조 유지, 스펙에 포함하지 않음
